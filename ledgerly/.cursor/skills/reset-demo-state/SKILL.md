---
name: reset-demo-state
description: Run the scripted Ledgerly demo reset first, then complete only the manual cleanup it reports.
---

# Reset the demo state

Run the script first. It is the source of truth for every step that can be scripted.

```bash
npm run demo:reset
npm run demo:reset -- --dry-run
```

`--dry-run` lists the branches, worktrees, remotes, and files it would remove, then prints the summary without changing anything. The script is `scripts/demo-reset.ts` (`npm run demo:reset`). It is idempotent.

## What the script does

- Restores tracked files with `git reset --hard HEAD` and switches to `main` (`git checkout main` equivalent). It restores `app/invoices/page.tsx` and `app/disputes/page.tsx` along with every other tracked change.
- Removes recorded demo rules, skills, and Canvas files, plus the known paths `.cursor/rules/suggested-credit-api-v2.mdc`, `.cursor/skills/create-api`, and `.cursor/agents/accessibility-manual-reviewer.md`. It does not run `git clean`. Untracked files outside that allowlist stay.
- Deletes local demo branches with `git branch -D`. A demo branch is a branch recorded in the session file, or any local branch named `cursor/*` or `demo/*`. It never deletes `main` or `master`, and it never deletes any other non-demo branch.
- Deletes a remote with `git push origin --delete` only when the session recorded that branch with `--remote` and the name matches `cursor/*` or `demo/*`.
- Removes linked worktrees whose branch is a demo branch, then runs `git worktree prune`. Removal unlocks a locked worktree and runs `git worktree remove --force`, so uncommitted changes and untracked files in that directory are discarded. A lock does not keep the directory. Unpushed commits can remain in the primary reflog until it expires. Worktrees on non-demo branches stay.
- Reseeds SQLite and restarts port 43173.
- Confirms **1 failed / 36 passed**. It leaves the suggested-credit client on v1 and filter pills writing `state=`.

The script exits with an error before it changes anything when the current branch is not `main` and not a demo branch, when the checkout is detached, when it is run from a linked worktree, or when a branch name is `main` or otherwise unsafe. `--keep-branch` stays on the current branch and skips `git reset --hard` for an isolated check.

It prints one JSON report. The `summary` object is the resulting state: branch, head, worktrees, local branches, untouched non-demo branches, the planted client version, the suite line, cloud agent notes, and manual leftovers.

## What stays manual

Read `remaining` for MCP cleanup and `summary.cloudAgents` plus `manual` for everything else. Do only these:

- **Figma:** for each recorded Slides `fileKey`, load `figma-use` and `figma-use-slides`, then remove every slide with `slide.remove()`.
- **Cursor user rule:** use `cursor_dialog` only for a recorded rule ID with no filesystem path. Do not remove unrelated user rules.
- **301 Reviewer automation:** this optional automation is not in the report. Remove it by hand in the Automations tab.
- **Linear:** offer teardown whenever the Linear MCP is connected, but act only when the report lists a recorded `ce-field-demos` board. Confirm the exact team before any write: present its name, key, privacy, and `https://linear.app/<workspace>/settings/teams/<KEY>`. Public and private teams are both valid. Public and private projects are both valid — do not skip teardown because the project is public. Never assume or guess a team. Cancel each recorded issue with `save_issue` (`state`: `Canceled`) and then the project with `save_project` (`state`: `Canceled`). The catalog is `FIELD_DEMO_ISSUES` plus `COLLECTIONS_COMMAND_CENTER_ISSUES` plus `WCAG_KEYBOARD_WALKTHROUGH`; the recorded board is those thirteen identifiers with WCAG last. That audit is a manual keyboard walkthrough. Cancel it with the other recorded issues. Reset still only cancels what was recorded. Do not delete the team, and do not treat the walkthrough issue as a reason to skip teardown. Leave the issue linked, leave the team-scoped `Collections Command Center` label in place, and retain the team. The next `stage-linear` reopens the project and reopens recorded issues to `Todo`, and creates a title only when it is missing or a canceled issue will not leave `Canceled`. The script uses the Linear API only with both `LINEAR_API_KEY` and explicit `--confirm-linear`.
- **Cloud agent runs:** this script cannot stop a Cloud Agent. Stop the run in Cursor. Unrecorded `origin/cursor/*` and `origin/demo/*` branches are listed in the summary and left in place, because they may belong to a live cloud agent or to another checkout.
- **Recorded remotes outside `cursor/*` and `demo/*`:** listed under `manual` and not deleted. Remove that remote by hand only when you know it is a rehearsal branch.
- **Non-demo branches, and worktrees checked out on them:** left in place.
- **Unrecorded personal skills, user rules, and Canvas files:** left in place. Record them before the next reset if they should be removed.

If the event file is missing or a beat predates this script, use the old discovery flow cautiously: list candidates, do not guess a team, and never cancel issues outside the recorded board.

## Session events

Start each demo session and record artifacts as they are created:

```bash
npm run demo:session -- start
npm run demo:session -- record skill "$HOME/.cursor/skills/<created-skill>"
npm run demo:session -- record project-path .cursor/agents/accessibility-manual-reviewer.md
npm run demo:session -- record branch <linear-gitBranchName> --remote
```

The ignored `.cursor/demo-session-events.json` stores recorded paths, branches, Figma file keys, and Linear identifiers. Use `npm run demo:session -- status` to inspect it. One reset clears everything it knows about. There is no per-track reset. Without the file the command still resets tracked files, known demo paths, local `cursor/*` and `demo/*` branches, and demo worktrees. Unrecorded personal rules, skills, and Canvas files need manual cleanup. When a demo beat creates a new leftover, update `scripts/demo-reset.ts` and its event record in the same change.

## Demo-beat git branches

The script switches to main (`git checkout main` equivalent), then uses `git branch -D` and, for recorded remotes that match `cursor/*` or `demo/*`, `git push origin --delete`. It removes linked demo worktrees with `git worktree remove --force` (a dirty or locked tree is wiped) and runs `git worktree prune`. It restores `app/invoices/page.tsx` and `app/disputes/page.tsx` along with every other tracked change. Do not repeat those commands after the script succeeds.

## Never

- Never edit `tests/suggested-credit-api.test.ts`, either suggested-credit API route, or the seed to make the shipped red test green.
- Never delete a path outside the script's allowlist.
- Never delete `main`, `master`, or a branch that is not a demo branch.
- Never `git push origin --delete` a branch outside `cursor/*` and `demo/*`.
- Never cancel Linear issues on a team the operator did not confirm, and never delete the team.
