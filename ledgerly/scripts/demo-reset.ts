import { execFileSync, spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { requirePrimaryCheckout } from "./enclosing-worktree";

type SessionEvent = {
  version: 1;
  createdAt: string;
  userRules: Array<{ id?: string; title?: string; path?: string }>;
  personalSkills: Array<{ name: string; path: string }>;
  projectPaths: string[];
  branches: Array<{ name: string; remote?: boolean }>;
  canvases: string[];
  figmaSlides: Array<{ fileKey: string; url?: string }>;
  linear?: {
    teamId: string;
    teamName: string;
    teamKey: string;
    projectId: string;
    issueIds: string[];
  };
};

type RemainingAction = { kind: "cursor-rule" | "figma" | "linear"; detail: string };
type ResetSummary = {
  dryRun: boolean;
  branch: string;
  head: string;
  worktrees: string[];
  localBranches: string[];
  untouchedBranches: string[];
  plantedSuggestedCredit: string;
  suite: string;
  cloudAgents: string[];
  manual: string[];
};
type Report = {
  completed: string[];
  skipped: string[];
  remaining: RemainingAction[];
  manual: string[];
  summary?: ResetSummary;
};

const root = resolve(process.cwd());
const sandboxHome = resolve(process.env.DEMO_RESET_HOME ?? homedir());
const eventFile = resolve(process.env.DEMO_RESET_EVENT_FILE ?? ".cursor/demo-session-events.json");
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipDb = args.includes("--skip-db");
const skipServer = args.includes("--skip-server");
const skipVerify = args.includes("--skip-verify");
const keepBranch = args.includes("--keep-branch");
const confirmLinear = args.includes("--confirm-linear");
const knownProjectPaths = new Set([
  ".cursor/rules/suggested-credit-api-v2.mdc",
  ".cursor/skills/create-api",
  ".cursor/agents/accessibility-manual-reviewer.md",
]);
const PROTECTED_BRANCHES = new Set(["main", "master"]);
// Local rehearsal leftovers use these prefixes. A remote delete also requires a recorded session branch.
const DEMO_BRANCH_PATTERN = /^(cursor|demo)\/[A-Za-z0-9][A-Za-z0-9._/-]*$/;

type WorktreeInfo = {
  path: string;
  head: string;
  branch: string | null;
  locked: boolean;
  prunable: boolean;
};

function projectArtifactRoots() {
  return [
    resolve(root, ".cursor/rules"),
    resolve(root, ".cursor/skills"),
    resolve(root, ".cursor/agents"),
  ];
}

function assertKnownProjectPath(value: string) {
  if (!knownProjectPaths.has(value)) throw new Error(`Unsupported demo project path: ${value}`);
  assertAllowedPath(resolve(root, value), projectArtifactRoots());
}

function command(command: string, commandArgs: string[], options: { allowFailure?: boolean } = {}) {
  try {
    return execFileSync(command, commandArgs, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    if (options.allowFailure) {
      const output = error as { stdout?: string | Buffer };
      return output.stdout?.toString() ?? "";
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${command} ${commandArgs.join(" ")} failed: ${message}`);
  }
}

function defaultEvent(): SessionEvent {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    userRules: [],
    personalSkills: [],
    projectPaths: [],
    branches: [],
    canvases: [],
    figmaSlides: [],
  };
}

function readEvent(required = true): SessionEvent {
  if (!existsSync(eventFile)) {
    if (required) throw new Error(`No session event file at ${eventFile}. Run demo:session start first.`);
    return defaultEvent();
  }

  const event = JSON.parse(readFileSync(eventFile, "utf8")) as SessionEvent;
  if (event.version !== 1) throw new Error(`Invalid session event file: ${eventFile}`);
  return {
    ...defaultEvent(),
    ...event,
  };
}

function writeEvent(event: SessionEvent) {
  mkdirSync(dirname(eventFile), { recursive: true });
  writeFileSync(eventFile, `${JSON.stringify(event, null, 2)}\n`);
}

function assertAllowedPath(candidate: string, allowedRoots: string[]) {
  if (!isAbsolute(candidate)) throw new Error(`Expected absolute path: ${candidate}`);
  const absolute = resolve(candidate);
  if (!allowedRoots.some((allowedRoot) => absolute === allowedRoot || absolute.startsWith(`${allowedRoot}/`))) {
    throw new Error(`Refusing to remove path outside the demo allowlist: ${absolute}`);
  }
  return absolute;
}

function removePath(path: string, report: Report) {
  if (!existsSync(path)) {
    report.skipped.push(`Missing: ${path}`);
    return;
  }
  if (dryRun) {
    report.completed.push(`Would remove: ${path}`);
    return;
  }
  rmSync(path, { recursive: lstatSync(path).isDirectory(), force: true });
  report.completed.push(`Removed: ${path}`);
}

function canvasRoot() {
  const slug = root.replace(/^\//, "").replaceAll("/", "-");
  return resolve(sandboxHome, `.cursor/projects/${slug}/canvases`);
}

function validateRemovablePaths(event: SessionEvent) {
  const projectRulesRoot = resolve(root, ".cursor/rules");
  const userRulesRoot = resolve(sandboxHome, ".cursor/rules");
  const userSkillsRoot = resolve(sandboxHome, ".cursor/skills");
  const projectRule = resolve(root, ".cursor/rules/suggested-credit-api-v2.mdc");

  for (const path of event.projectPaths) assertKnownProjectPath(path);
  for (const rule of event.userRules) {
    if (!rule.path) continue;
    const path = assertAllowedPath(rule.path, [userRulesRoot, projectRulesRoot]);
    if (path !== projectRule && !path.startsWith(`${userRulesRoot}/`)) {
      throw new Error(`Unsupported demo user-rule path: ${path}`);
    }
  }
  for (const skill of event.personalSkills) {
    const path = assertAllowedPath(skill.path, [userSkillsRoot]);
    if (dirname(path) !== userSkillsRoot) {
      throw new Error(`Personal skills must be recorded as direct children of ${userSkillsRoot}.`);
    }
  }
  for (const canvas of event.canvases) assertAllowedPath(canvas, [canvasRoot()]);
}

function record(event: SessionEvent) {
  const kind = args[1];
  const value = args[2];
  if (!kind || !value) throw new Error("Usage: demo:session record <rule|skill|project-path|branch|canvas|figma> <value> [metadata]");

  if (kind === "rule") {
    const path = resolve(value);
    const userRulesRoot = resolve(sandboxHome, ".cursor/rules");
    const projectRule = resolve(root, ".cursor/rules/suggested-credit-api-v2.mdc");
    assertAllowedPath(path, [userRulesRoot, resolve(root, ".cursor/rules")]);
    if (path !== projectRule && !path.startsWith(`${userRulesRoot}/`)) {
      throw new Error(`Only user rules or ${projectRule} can be recorded.`);
    }
    event.userRules.push({ path, title: args[3] });
  } else if (kind === "rule-id") {
    event.userRules.push({ id: value, title: args[3] });
  } else if (kind === "skill") {
    event.personalSkills.push({ name: basename(value), path: resolve(value) });
  } else if (kind === "project-path") {
    assertKnownProjectPath(value);
    event.projectPaths.push(value);
  } else if (kind === "branch") {
    event.branches.push({ name: value, remote: args.includes("--remote") });
  } else if (kind === "canvas") {
    event.canvases.push(resolve(value));
  } else if (kind === "figma") {
    event.figmaSlides.push({ fileKey: value, url: args[3] });
  } else if (kind === "linear") {
    const [teamName, teamKey, projectId, issueIds] = args.slice(3);
    if (!teamName || !teamKey || !projectId || !issueIds) {
      throw new Error("Usage: demo:session record linear <teamId> <teamName> <teamKey> <projectId> <issueId,issueId>");
    }
    event.linear = {
      teamId: value,
      teamName,
      teamKey,
      projectId,
      issueIds: issueIds.split(",").filter(Boolean),
    };
  } else {
    throw new Error(`Unknown event type: ${kind}`);
  }

  writeEvent(event);
  console.log(`Recorded ${kind}: ${value}`);
}

function removeLocalArtifacts(event: SessionEvent, report: Report) {
  const projectRulesRoot = resolve(root, ".cursor/rules");
  const userRulesRoot = resolve(sandboxHome, ".cursor/rules");
  const userSkillsRoot = resolve(sandboxHome, ".cursor/skills");
  const allowedProjectPaths = new Set([...knownProjectPaths].map((path) => resolve(root, path)));

  for (const path of allowedProjectPaths) {
    assertAllowedPath(path, projectArtifactRoots());
    removePath(path, report);
  }

  for (const rule of event.userRules) {
    if (rule.path) {
      const path = assertAllowedPath(rule.path, [userRulesRoot, projectRulesRoot]);
      if (path !== resolve(root, ".cursor/rules/suggested-credit-api-v2.mdc") && !path.startsWith(`${userRulesRoot}/`)) {
        throw new Error(`Unsupported demo user-rule path: ${path}`);
      }
      removePath(path, report);
    } else if (rule.id) {
      report.remaining.push({ kind: "cursor-rule", detail: `Remove Cursor user rule ${rule.id}${rule.title ? ` (${rule.title})` : ""}.` });
    }
  }

  for (const skill of event.personalSkills) {
    const skillPath = assertAllowedPath(skill.path, [userSkillsRoot]);
    if (dirname(skillPath) !== userSkillsRoot) {
      throw new Error(`Personal skills must be recorded as direct children of ${userSkillsRoot}.`);
    }
    removePath(skillPath, report);
  }

  for (const canvas of event.canvases) {
    removePath(assertAllowedPath(canvas, [canvasRoot()]), report);
  }
}

function assertSafeBranchName(name: string) {
  if (
    !name ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name) ||
    name.includes("..") ||
    name.endsWith("/") ||
    name.endsWith(".lock")
  ) {
    throw new Error(`Refusing unexpected branch name: ${name}`);
  }
}

function isDemoPattern(name: string) {
  return DEMO_BRANCH_PATTERN.test(name) && !name.includes("..") && !PROTECTED_BRANCHES.has(name);
}

function isDemoBranch(name: string, recorded: Set<string>) {
  return isDemoPattern(name) || recorded.has(name);
}

function listLocalBranches() {
  return command("git", ["for-each-ref", "--format=%(refname:short)", "refs/heads"])
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function listRemoteDemoBranches() {
  const names: string[] = [];
  for (const line of command("git", ["branch", "-r"]).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.includes(" -> ") || !trimmed.startsWith("origin/")) continue;
    const name = trimmed.slice("origin/".length);
    if (isDemoPattern(name)) names.push(name);
  }
  return names;
}

function listWorktrees(): WorktreeInfo[] {
  const raw = command("git", ["worktree", "list", "--porcelain"]);
  return raw
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const info: WorktreeInfo = { path: "", head: "", branch: null, locked: false, prunable: false };
      for (const line of block.split("\n")) {
        if (line.startsWith("worktree ")) info.path = line.slice("worktree ".length);
        else if (line.startsWith("HEAD ")) info.head = line.slice("HEAD ".length);
        else if (line === "detached") info.branch = null;
        else if (line.startsWith("branch ")) {
          const ref = line.slice("branch ".length);
          if (!ref.startsWith("refs/heads/")) throw new Error(`Refusing unexpected worktree branch ref: ${ref}`);
          info.branch = ref.slice("refs/heads/".length);
        } else if (line === "locked" || line.startsWith("locked ")) info.locked = true;
        else if (line === "prunable" || line.startsWith("prunable ")) info.prunable = true;
        else if (line === "bare") throw new Error("Refusing to reset a bare repository.");
        else throw new Error(`Refusing unexpected worktree list line: ${line}`);
      }
      if (!info.path || !info.head) throw new Error("Refusing incomplete worktree record.");
      return info;
    });
}

function currentBranchName() {
  const name = command("git", ["branch", "--show-current"]).trim();
  if (!name) throw new Error("Refusing to reset a detached primary checkout.");
  assertSafeBranchName(name);
  return name;
}

function remoteHeadExists(name: string) {
  const listed = command("git", ["ls-remote", "--heads", "origin", `refs/heads/${name}`]).trim();
  if (!listed) return false;
  const expected = `refs/heads/${name}`;
  if (!listed.split("\n").every((line) => line.endsWith(`\t${expected}`))) {
    throw new Error(`Refusing unexpected ls-remote result for ${name}: ${listed}`);
  }
  return true;
}

function deleteRemoteBranch(name: string) {
  if (PROTECTED_BRANCHES.has(name) || !isDemoPattern(name)) {
    throw new Error(`Refusing to delete remote branch: ${name}`);
  }
  if (!remoteHeadExists(name)) return false;
  command("git", ["push", "origin", "--delete", name]);
  const tracking = `refs/remotes/origin/${name}`;
  let trackingPresent = false;
  try {
    execFileSync("git", ["show-ref", "--verify", "--quiet", tracking], { cwd: root, stdio: "ignore" });
    trackingPresent = true;
  } catch {
    trackingPresent = false;
  }
  if (trackingPresent) command("git", ["update-ref", "-d", tracking]);
  return true;
}

function assertPlantedClient() {
  const source = readFileSync(resolve(root, "lib/disputes/suggested-credit-api.ts"), "utf8");
  const test = readFileSync(resolve(root, "tests/suggested-credit-api.test.ts"), "utf8");
  if (!source.includes('export const SUGGESTED_CREDIT_API_VERSION = "v1"')) {
    throw new Error("Planted suggested-credit client is not on v1.");
  }
  if (!test.includes('"/api/v2/disputes/dsp_1043/suggested-credit"')) {
    throw new Error("Planted suggested-credit test no longer expects the v2 path.");
  }
  return "v1";
}

function resetGit(event: SessionEvent, report: Report) {
  const worktrees = listWorktrees();
  const primary = requirePrimaryCheckout(root, worktrees);

  for (const recorded of event.branches) {
    assertSafeBranchName(recorded.name);
    if (PROTECTED_BRANCHES.has(recorded.name)) {
      throw new Error(`Refusing to delete protected branch: ${recorded.name}`);
    }
  }
  for (const worktree of worktrees) {
    if (!worktree.branch) throw new Error(`Refusing detached worktree at ${worktree.path}.`);
    assertSafeBranchName(worktree.branch);
  }

  const branch = currentBranchName();
  const recordedNames = new Set(event.branches.map((recorded) => recorded.name));
  if (branch !== "main" && !isDemoBranch(branch, recordedNames) && !keepBranch) {
    throw new Error(
      `Refusing to reset from non-demo branch ${branch}. Switch to main, or pass --keep-branch for an isolated check.`,
    );
  }

  const deleteLocal = new Set<string>();
  for (const name of listLocalBranches()) {
    if (isDemoPattern(name)) deleteLocal.add(name);
  }
  for (const name of recordedNames) deleteLocal.add(name);
  for (const protectedName of PROTECTED_BRANCHES) deleteLocal.delete(protectedName);
  if (keepBranch) deleteLocal.delete(branch);

  const remoteDeletes: string[] = [];
  for (const recorded of event.branches) {
    if (!recorded.remote) continue;
    if (isDemoPattern(recorded.name)) remoteDeletes.push(recorded.name);
    else {
      report.manual.push(
        `Recorded remote ${recorded.name} is outside demo branch patterns (cursor/* and demo/*). The remote was not deleted.`,
      );
    }
  }

  const removableWorktrees = worktrees.filter((worktree) => {
    if (resolve(worktree.path) === resolve(primary.path)) return false;
    if (worktree.prunable) return false;
    if (!worktree.branch || PROTECTED_BRANCHES.has(worktree.branch)) {
      report.manual.push(`Left worktree ${worktree.path} checked out on ${worktree.branch ?? "an unknown branch"}.`);
      return false;
    }
    if (!isDemoBranch(worktree.branch, recordedNames)) {
      report.manual.push(`Left worktree ${worktree.path} on non-demo branch ${worktree.branch}.`);
      return false;
    }
    return true;
  });

  if (keepBranch && branch !== "main") {
    report.skipped.push(`Kept current branch for isolated verification: ${branch}`);
    report.skipped.push("Skipped git reset --hard because --keep-branch is set.");
  } else if (dryRun) {
    if (branch !== "main") report.completed.push(`Would switch ${branch} to main.`);
    report.completed.push("Would run: git reset --hard HEAD");
  } else {
    if (branch !== "main") {
      command("git", ["reset", "--hard", "HEAD"]);
      command("git", ["switch", "main"]);
      report.completed.push("Switched to main.");
    }
    command("git", ["reset", "--hard", "HEAD"]);
    report.completed.push("Restored tracked files with git reset --hard HEAD.");
  }

  for (const worktree of worktrees) {
    if (!worktree.prunable || resolve(worktree.path) === resolve(primary.path)) continue;
    const label = `Stale worktree registration will be pruned: ${worktree.path}`;
    report.completed.push(dryRun ? `Would prune: ${worktree.path}` : label);
  }

  for (const worktree of removableWorktrees) {
    const label = `${worktree.path} (${worktree.branch})`;
    if (dryRun) {
      report.completed.push(`Would remove worktree: ${label}`);
      continue;
    }
    if (worktree.locked) command("git", ["worktree", "unlock", worktree.path]);
    command("git", ["worktree", "remove", "--force", worktree.path]);
    report.completed.push(`Removed worktree: ${label}`);
  }

  if (dryRun) report.completed.push("Would run: git worktree prune");
  else {
    command("git", ["worktree", "prune"]);
    report.completed.push("Pruned stale worktree registrations.");
  }

  const checkedOut = new Set(
    listWorktrees()
      .map((worktree) => worktree.branch)
      .filter((name): name is string => Boolean(name)),
  );
  const plannedToLeave = new Set(
    removableWorktrees.map((worktree) => worktree.branch).filter((name): name is string => Boolean(name)),
  );
  if (dryRun && !keepBranch && branch !== "main") plannedToLeave.add(branch);
  if (dryRun) {
    for (const worktree of worktrees) {
      if (!worktree.prunable || !worktree.branch || resolve(worktree.path) === resolve(primary.path)) continue;
      if (isDemoBranch(worktree.branch, recordedNames)) plannedToLeave.add(worktree.branch);
    }
  }
  const existing = new Set(listLocalBranches());
  for (const name of deleteLocal) {
    assertSafeBranchName(name);
    if (PROTECTED_BRANCHES.has(name)) throw new Error(`Refusing to delete protected branch: ${name}`);
    if (checkedOut.has(name) && !(dryRun && plannedToLeave.has(name))) {
      throw new Error(`Refusing to delete checked-out branch: ${name}`);
    }
    if (!existing.has(name)) {
      report.skipped.push(`Local branch already absent: ${name}`);
      continue;
    }
    if (dryRun) {
      report.completed.push(`Would delete local branch: ${name}`);
      continue;
    }
    command("git", ["branch", "-D", name]);
    report.completed.push(`Deleted local branch: ${name}`);
  }

  for (const name of [...new Set(remoteDeletes)]) {
    if (dryRun) {
      report.completed.push(`Would delete remote branch: ${name}`);
      continue;
    }
    if (deleteRemoteBranch(name)) report.completed.push(`Deleted remote branch: ${name}`);
    else report.skipped.push(`Remote branch absent on origin: ${name}`);
  }
}

function reseedAndStart(report: Report) {
  if (!skipDb) {
    if (dryRun) report.completed.push("Would run: npx prisma db seed");
    else {
      command("npx", ["prisma", "db", "seed"]);
      report.completed.push("Reseeded SQLite.");
    }
  }

  if (skipServer) return;
  const pids = command("lsof", ["-ti", ":43173"], { allowFailure: true })
    .split(/\s+/)
    .filter(Boolean);
  if (dryRun) {
    if (pids.length) report.completed.push(`Would stop port 43173 PIDs: ${pids.join(", ")}`);
    report.completed.push("Would start npm run dev on port 43173.");
    return;
  }
  for (const pid of pids) process.kill(Number(pid), "SIGTERM");
  const child = spawn("npm", ["run", "dev"], {
    cwd: root,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  report.completed.push("Started the dev server on port 43173.");
}

function verifyTests(report: Report) {
  if (skipVerify || dryRun) return "skipped";
  const output = command("npm", ["test"], { allowFailure: true });
  if (!/1 failed[\s\S]*37 passed|37 passed[\s\S]*1 failed/i.test(output)) {
    throw new Error("The reset suite did not report the expected 1 failed / 37 passed result.");
  }
  report.completed.push("Confirmed the expected 1 failed / 37 passed test result.");
  return "1 failed / 37 passed";
}

async function cancelWithLinearApi(event: SessionEvent, report: Report) {
  if (!event.linear || !process.env.LINEAR_API_KEY || !confirmLinear || process.env.DEMO_RESET_DISABLE_LINEAR === "1") return;

  const request = async (query: string, variables: Record<string, unknown>) => {
    const response = await fetch("https://api.linear.app/graphql", {
      method: "POST",
      headers: {
        Authorization: process.env.LINEAR_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables }),
    });
    const body = (await response.json()) as { data?: Record<string, unknown>; errors?: Array<{ message: string }> };
    if (!response.ok || body.errors?.length) throw new Error(body.errors?.map((error) => error.message).join("; ") ?? response.statusText);
    return body.data ?? {};
  };

  try {
    const identity = await request(
      `query ResetIdentity($projectId: String!) {
        viewer { id teams { nodes { id name key } } }
        project(id: $projectId) { id teams { nodes { id } } lead { id } }
      }`,
      { projectId: event.linear.projectId },
    );
    const viewer = identity.viewer as { id: string; teams: { nodes: Array<{ id: string; name: string; key: string }> } };
    const project = identity.project as { id: string; teams: { nodes: Array<{ id: string }> }; lead: { id: string } | null };
    const team = viewer.teams.nodes.find((candidate) => candidate.id === event.linear!.teamId);
    const projectTeams = project.teams.nodes.map((candidate) => candidate.id);
    if (!team || team.name !== event.linear.teamName || team.key !== event.linear.teamKey || projectTeams.length !== 1 || projectTeams[0] !== team.id || project.lead?.id !== viewer.id) {
      throw new Error("Recorded Linear board does not match the operator's exact team.");
    }

    const states = await request(
      `query ResetStates($teamId: String!) { team(id: $teamId) { states { nodes { id type } } } }`,
      { teamId: team.id },
    );
    const nodes = ((states.team as { states: { nodes: Array<{ id: string; type: string }> } }).states.nodes);
    const canceledState = nodes.find((state) => state.type.toLowerCase() === "canceled");
    if (!canceledState) throw new Error("The confirmed Linear team has no Canceled workflow state.");

    for (const issueId of event.linear.issueIds) {
      await request(
        `mutation CancelIssue($id: String!, $stateId: String!) {
          issueUpdate(id: $id, input: { stateId: $stateId }) { success }
        }`,
        { id: issueId, stateId: canceledState.id },
      );
    }
    await request(
      `mutation CancelProject($id: String!) {
        projectUpdate(id: $id, input: { status: "canceled" }) { success }
      }`,
      { id: event.linear.projectId },
    );
    report.completed.push(`Canceled recorded Linear board ${event.linear.projectId} through the Linear API.`);
  } catch (error) {
    report.skipped.push(`Linear API skipped: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function remainingExternalActions(event: SessionEvent, report: Report) {
  for (const slide of event.figmaSlides) {
    report.remaining.push({ kind: "figma", detail: `Empty Figma Slides file ${slide.fileKey} with use_figma.` });
  }
  if (event.linear && !report.completed.some((entry) => entry.includes(`Linear board ${event.linear!.projectId}`))) {
    report.remaining.push({
      kind: "linear",
      detail: `Cancel recorded Linear project ${event.linear.projectId} and issues ${event.linear.issueIds.join(", ")} after confirming team ${event.linear.teamName} (${event.linear.teamKey}).`,
    });
  }
}

function buildSummary(report: Report, suite: string): ResetSummary {
  const branchNow = command("git", ["branch", "--show-current"]).trim() || "(detached)";
  let head = command("git", ["rev-parse", "--short", "HEAD"]).trim();
  let localBranches = listLocalBranches();
  let worktrees = listWorktrees().map((worktree) => `${worktree.path} [${worktree.branch ?? "detached"}]`);
  let branch = branchNow;
  if (dryRun) {
    const deleted = new Set(
      report.completed
        .filter((line) => line.startsWith("Would delete local branch: "))
        .map((line) => line.slice("Would delete local branch: ".length)),
    );
    const removedPaths = new Set(
      report.completed
        .filter((line) => line.startsWith("Would remove worktree: "))
        .map((line) => line.slice("Would remove worktree: ".length).replace(/ \([^)]*\)$/, "")),
    );
    const prunedPaths = new Set(
      report.completed
        .filter((line) => line.startsWith("Would prune: "))
        .map((line) => line.slice("Would prune: ".length)),
    );
    localBranches = localBranches.filter((name) => !deleted.has(name));
    worktrees = worktrees
      .filter((line) => {
        const path = line.slice(0, line.lastIndexOf(" ["));
        return !removedPaths.has(path) && !prunedPaths.has(path);
      })
      .map((line) => {
        if (!report.completed.some((entry) => entry.startsWith("Would switch "))) return line;
        const path = line.slice(0, line.lastIndexOf(" ["));
        if (resolve(path) !== root) return line;
        return `${path} [main]`;
      });
    if (report.completed.some((line) => line.startsWith("Would switch "))) {
      branch = "main";
      head = command("git", ["rev-parse", "--short", "main"]).trim();
    }
  }
  const untouchedBranches = localBranches.filter((name) => !PROTECTED_BRANCHES.has(name) && !isDemoPattern(name));
  const remoteLeft = listRemoteDemoBranches();
  const cloudAgents = [
    "Cloud agent runs cannot be closed from this script. Stop them in Cursor. Deleting a local cursor/* branch does not stop the run.",
  ];
  if (remoteLeft.length) {
    cloudAgents.push(
      `Left these origin branches because this session did not record them for deletion: ${remoteLeft.join(", ")}`,
    );
  }
  return {
    dryRun,
    branch,
    head,
    worktrees,
    localBranches,
    untouchedBranches,
    plantedSuggestedCredit: assertPlantedClient(),
    suite,
    cloudAgents,
    manual: report.manual,
  };
}

function printSummary(summary: ResetSummary) {
  const lines = [
    "Reset summary",
    `  dry run: ${summary.dryRun}`,
    `  branch: ${summary.branch}`,
    `  head: ${summary.head}`,
    `  worktrees: ${summary.worktrees.join("; ") || "(none)"}`,
    `  local branches: ${summary.localBranches.join(", ") || "(none)"}`,
    `  untouched non-demo branches: ${summary.untouchedBranches.join(", ") || "(none)"}`,
    `  planted suggested-credit client: ${summary.plantedSuggestedCredit}`,
    `  suite: ${summary.suite}`,
    `  cloud agents: ${summary.cloudAgents.join(" | ")}`,
    `  still manual: ${summary.manual.join(" | ") || "(none)"}`,
  ];
  console.error(lines.join("\n"));
}

async function reset() {
  const event = readEvent(false);
  const report: Report = { completed: [], skipped: [], remaining: [], manual: [] };
  validateRemovablePaths(event);
  if (!existsSync(eventFile)) {
    report.skipped.push(
      `No session event file at ${eventFile}. Reset tracked files, known demo paths, local cursor/* and demo/* branches, and demo worktrees. Unrecorded personal rules, skills, and Canvas files need manual cleanup.`,
    );
  }
  resetGit(event, report);
  removeLocalArtifacts(event, report);
  reseedAndStart(report);
  await cancelWithLinearApi(event, report);
  remainingExternalActions(event, report);
  const suite = verifyTests(report);
  if (!dryRun) {
    const linearCompleted = report.completed.some((entry) => entry.includes(`Linear board ${event.linear?.projectId}`));
    writeEvent({
      ...defaultEvent(),
      userRules: event.userRules.filter((rule) => !rule.path),
      figmaSlides: event.figmaSlides,
      linear: linearCompleted ? undefined : event.linear,
    });
  }
  report.summary = buildSummary(report, suite);
  printSummary(report.summary);
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
const action = args[0] ?? "status";
if (action === "start") {
  writeEvent(defaultEvent());
  console.log(`Started demo session at ${eventFile}`);
} else if (action === "record") {
  record(readEvent());
} else if (action === "status") {
  console.log(JSON.stringify(readEvent(false), null, 2));
} else if (action === "reset") {
  await reset();
} else {
  throw new Error(`Unknown action: ${action}`);
}
}

void main();
