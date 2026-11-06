# Ledgerly demo howto

Presenter run-of-show for the **101**, **201**, and **301** tracks, not a course. Every step stands on its own, so you can start anywhere. You still review each result before it ships.

Ledgerly is a small, fictional demo app. It exists to give Grok Build enablement steps a visible surface: code to read, a UI to inspect, a scoped error to fix, and tests to verify. The data is synthetic. Avery Quinn is the operator, the only plan prices are Starter **$49**, Growth **$99**, and Scale **$249**, and the clock is frozen at **23 August 2026** so every run is repeatable.

The pastes below match the copy-paste blocks in `runbooks.html`. `start-ledgerly` renders that file in a Cursor Canvas. The Catalog menu switches tracks. `runbooks.html?track=201` selects 201 and `runbooks.html?track=301` selects 301 when the file is opened on its own. Each beat is independent; jump directly to any step.

## Jump menu

The 101 track has three sections. Open `runbooks.html` in the Canvas and copy a card for any beat.

1. **What is Grok Build?** — [Ask](#ask), [Plan](#plan), [Build in Agent mode](#build-in-agent-mode), [Debug](#debug), check the models
2. **How do you work with an agent?** — allowlist, verify the email feature, redact, stop, interrupt and steer, continue to the end, review diffs, restore from a checkpoint
3. **How do you govern an agent?** — [create a rule](#create-a-rule), create a skill, [Canvas](#canvas), [MCP / Figma](#mcp--figma)

The 201 track has four sections. Open `runbooks.html?track=201` and copy a card for any beat.

1. **How do you manage context?** Rename agents, Ask DDD, check each agent's context window, ask across chats
2. **How do you standardize agents?** [create-api skill](#create-api-skill), promote it
3. **How do you connect external tools?** [Linear team](#choose-the-linear-team-manual), Linear MCP, list open issues, import plugin from disk
4. **How do you parallelize a task?** — [open a new agent](#open-the-plan), resolve-dispute plan, `/multitask`, Canvas subagent progress, ledgerly-reviewer check

The 301 track has four sections. Open `runbooks.html?track=301` and copy a card for any beat. Optional features are checkboxes, checked by default. Uncheck a feature to hide its beats. The choice is saved in the browser.

1. **How do you orchestrate agents?** Open a local agent, create accessibility-manual-reviewer, use a cost-efficient model, optionally move to a Cloud Agent, `/multitask` the audit
2. **How do you go from plan to code?** Optionally start a Project, list collections issues, plan and build, `/side`, consolidate into a PR
3. **How do you scale review?** Feature branch, change reviewer subagent, highest-risk slice
4. **How do you share ownership safely?** Shift findings left, optional Reviewer automation, files that might conflict

---

## How to narrate

For a novice audience, narrate each step in this order:

- **Before:** "Here is the task and the boundary I am giving Grok Build."
- **During:** "Grok Build is reading, editing, or checking. I can inspect each action."
- **After:** "Here is the evidence. I decide whether the result ships."

Then add the engineering point: why the task is hard, what Grok Build takes on, and why the evidence matters. Do not read prompts aloud. State the intent, paste from the card, then narrate what changed in plain language.

Use these definitions when the audience is new:

- **Ask:** reads and explains; it does not edit.
- **Agent:** can inspect, edit, and run checks within the boundary you give it.
- **Rule:** an always-on project guardrail.
- **Skill:** a reusable set of instructions for a kind of task.

---

## Before you start

```bash
npm i
npx prisma generate
npx prisma db seed
npm run dev
```

Open **http://localhost:43173**. Or ask an agent to run the `start-ledgerly` skill — it starts on 43173, seeds only when the database is empty, and opens `runbooks.html` in a Cursor Canvas.

Check shipped state:

- `npm test` is **1 failed / 37 passed**; the sole failure is `tests/suggested-credit-api.test.ts`
- [http://127.0.0.1:43173/disputes/dsp_1043](http://127.0.0.1:43173/disputes/dsp_1043) shows **Suggested credit $400.00** in red, above the Scale price of **$249**
- The deprecated v1 route returns the $400 claim; v2, the domain helper, and the seed store the correct $249 credit
- Accept credit / Decline are disabled — that unfinished resolution UI is separate from the planted API-version error
- Invoice and dispute status pills write `?state=` while the pages read `status` — clicking Overdue / Needs review does not filter. That is a planted UI seam, not a second red test. Restore it with the scripted reset.

If the credit reads $249.00 or the suite is all green, a prior run switched the client to v2. If status pills filter the list, a prior run renamed `state` to `status`. Run:

```bash
npm run demo:reset
```

Then complete only the remaining MCP cleanup reported by the script. Empty dashboard: `npm run db:reset`.

### Choose the Linear team (manual)

Linear MCP cannot create teams. Public and private teams are both valid. Public and private projects are both valid. Do this in the Linear UI **before** the 201 MCP section when the presenter does not already have a team.

1. Open Linear → **Settings → Teams → New team**.
2. Name it for this operator only (example: `{displayName}-field-demos`).
3. Leave it public, or turn on **Make team private**. Team key can be **LY**. Confirm it at `https://linear.app/<workspace>/settings/teams/LY`.
4. When the team is private, members are **only you**.
5. In Grok Build, run `stage-linear`. That skill creates or reconciles project `ce-field-demos` on this team with the three Fieldnote issues, the nine Collections Command Center slices tagged as that feature, and the WCAG keyboard-walkthrough issue as the thirteenth staged title. The project stays public unless you ask for private.

`stage-linear` never guesses the team — it lists your teams and asks you to **confirm the exact one** before writing, so any team name works. The next stage reopens the project and reopens recorded issues to `Todo`, and creates a title only when it is missing or a canceled issue will not leave `Canceled`. `reset-demo-state` uses the same confirmation, then cancels the recorded issues and cancels the project (issues stay linked; the team is retained).

A public team makes the project visible to that team. A public project on that team is valid — `stage-linear` does not refuse it or force it private.

---

## The demo error (2 min)

**Open:** [dsp_1043](http://127.0.0.1:43173/disputes/dsp_1043). The dashboard and Collections page are optional context.

**Do:** Point at **Suggested credit $400.00**, then **Scale catalog price $249.00**.

**Why:** One concrete error keeps the demo easy to follow. **Benefit:** Every enablement step can use the same visible example. **Why it matters:** The audience can focus on how Grok Build works instead of learning a product.

**Say — novice version:**

> Ledgerly is a fictional billing app we use for this demo. It contains one known error on purpose. This invoice costs $249, but the dispute claims $400. The current v2 API caps the suggested credit at $249. The page still calls deprecated v1, which returns the $400 claim. That is why the page shows a red warning and one test is red.

**How the error correlates:**

| Layer | File | What it proves |
| --- | --- | --- |
| Demo data | `prisma/seed.ts` | `dsp_1043` claims $400 against `inv_1043`, a $249 Scale invoice |
| Correct domain logic | `lib/dispute-credit.ts` | Caps suggested credit at the catalog plan price |
| Versioned APIs | `app/api/v1/disputes/[id]/suggested-credit/route.ts`, `app/api/v2/disputes/[id]/suggested-credit/route.ts` | v1 returns the $400 claim for compatibility; v2 returns $249 |
| Faulty client selection | `lib/disputes/suggested-credit-api.ts` | Selects deprecated v1, so the UI displays $400 |
| Expected behavior | `tests/suggested-credit-api.test.ts` | Expects the client to select v2 |

**Look for:** Red **Suggested credit $400.00**, copy stating it came from v1 and is above **$249.00**, and disabled Accept / Decline buttons. Those buttons are a separate unfinished seam; do not confuse them with the API-version error. Status pills on `/invoices` and `/disputes` are a third seam: they write `state=` so a click does not filter.

---

## Ask

**Open:** Grok Build chat in **Ask** mode. Leave the app on the dashboard or the dispute.

**Why:** Unfamiliar repos are expensive to learn. **Benefit:** Ask explains from source without editing. **Why it matters:** Engineers build confidence before acting.

**Paste** (same block as the first-prompt card):

```text
What are Ledgerly's only plan prices, and which seeded invoices are overdue? Cite lib/plans.ts, prisma/seed.ts, and prisma/extra-accounts.ts.

Explain the dispute flow end to end. What is intentionally unfinished? Cite the resolve helper, the resolve API route, and the dispute page. Do not edit any files.
```

**Look for:** Citations to `lib/plans.ts`, `prisma/seed.ts`, and `prisma/extra-accounts.ts`; the resolve stub named separately from the API-version error; no edits.

---

## Plan

**Open:** Plan mode. **Why:** Mapping the approach first keeps the change scoped.

**Paste:**

```text
/plan I want a new feature to update the customer email in the invoice detail customer card. Don’t implement email validation.
```

**Look for:** A short plan that names the files it would touch and defers validation.

---

## Build in Agent mode

**Open:** Agent (the default). Keep [dsp_1043](http://127.0.0.1:43173/disputes/dsp_1043) visible.

**Why:** End-to-end work crosses layers. **Benefit:** Agent traces, edits, and verifies the path. **Why it matters:** Explicit boundaries keep it reviewable.

**Paste:**

```text
Diagnose why dsp_1043 shows a $400 suggested credit even though v2 caps it at $249. Switch lib/disputes/suggested-credit-api.ts from v1 to v2. Preserve both API routes, the $400 dispute claim, and tests/suggested-credit-api.test.ts. Run the relevant tests and verify the page shows $249 from v2.
```

**Look for:** One client-version edit. Both v1 and v2 route tests still pass. `tests/suggested-credit-api.test.ts` turns green. The page shows **$249** from v2.

---

## Debug

**Open:** Debug mode. **Why:** Verify a change and investigate any failure with runtime evidence.

**Paste:**

```text
/debug the failing test
```

**Look for:** A hypothesis, an instrumented check, and a fix grounded in the actual failure.

---

## Create a rule

**Why:** Repeating standards in prompts is fragile. **Benefit:** A rule is always on for this project.

**Paste:**

```text
/create-rule Future code must never call /api/v1/disputes/*/suggested-credit. It must use /api/v2/disputes/*/suggested-credit. Create the project rule at .cursor/rules/suggested-credit-api-v2.mdc and show me the file before I keep it.
```

**Look for:** A proposed project rule under `.cursor/rules/`. This is a live manual beat; do not add the rule to the shipped repository.

Record it for reset:

```bash
npm run demo:session -- record project-path .cursor/rules/suggested-credit-api-v2.mdc
```

---

## Canvas

**Why:** Some results are easier to show than tell. **Benefit:** Canvas renders an interactive artifact next to the chat.

**Paste:**

```text
Create a canvas explaining what we did today.
```

---

## MCP / Figma

**Why:** Grok Build can drive external tools through MCP. **Benefit:** Generate slides for a showcase without leaving the editor.

Enable a Figma MCP server: **Customize > MCP > Figma**, then:

```text
Create three slides in Figma Slides outlining how I used Grok Build to develop a new feature. I want to use this as part of my demo showcase.
```

---

## Verify

**Paste:**

```text
Run npm test and report which tests passed and which failed. Do not edit any files.

On a clean tree, npm test is 1 failed / 37 passed. The sole red test is tests/suggested-credit-api.test.ts because the client intentionally selects deprecated v1. Do not change the test, either route, or the seed.
```

**If the client migration ran:** `tests/suggested-credit-api.test.ts` should be green and dsp_1043 should show **$249** from v2, with both routes intact.

**If no migration ran:** `npm test` should remain **1 failed / 37 passed**. That is shipped state, not failed setup.

**Land:** A green check is evidence, not permission to merge. The presenter remains accountable.

---

## Close

**Say:**

> I reviewed the result. Now I am resetting the demo app so the next session starts with the same planted v1 client, the same $400 UI result, the same expected red test, and status pills that still write `state=`.

**Do:** Ask the agent to run `reset-demo-state`, or:

```bash
npm run demo:reset
```

**Then:** complete only the script's reported Figma, Cursor user-rule, Linear, or cloud-agent actions. The script resets files, recorded rules and skills, Canvas files, local demo branches, demo worktrees, SQLite, and port 43173. Cloud agent runs stay manual.

**Shipped state again:** suggested credit **$400.00** from v1 on dsp_1043, v2 and stored credit **$249.00**, suite **1 failed / 37 passed**, status pills still writing `state=`.

---

## The 201 track

Open `runbooks.html?track=201`. Four section tabs match the Outline Show headings. Copy a card; Do text and prompts are on the card.

### How do you manage context?

Rename two agents (`/rename-chat Agent 1 All`, `/rename-chat Agent 2 Target`). Ask each for domain-driven design (whole app vs `@invoice-table.tsx`). Go to Agent 1 All chat. Select the Context Usage indicator below the chat. Go to Agent 2 Target. Select the Context Usage indicator below the chat. Check each context window: Agent 1 maps all the domains in the whole codebase. Agent 2 maps half of the domains based on the targeted context. Then ask across chats:

```text
/ask what is the domain driven design of the application.
```

```text
/ask what is the domain driven design of the @invoice-table.tsx
```

```text
/ask @Agent 1 All Does refactoring the table change anything across all contexts?
```

### How do you standardize agents?

#### Create-api skill

```text
/create-skill for how to create a new API. Follow the standards in this repo. This is a personal skill named create-api.
```

Open the skill in `~/.cursor/skills`, then promote it:

```text
Promote the create-api skill to this project.
```

Open the project skill in `.cursor/skills`. Explore the other project skills for this repository, such as add-dashboard-widget, draft-collection-email, or write-prisma-query.

Record both leftovers for reset:

```bash
npm run demo:session -- record skill "$HOME/.cursor/skills/create-api"
npm run demo:session -- record project-path .cursor/skills/create-api
```

### How do you connect external tools?

Use a public or private Linear team and project ([steps above](#choose-the-linear-team-manual)): Settings → Teams → New team when you need a new one, or leave an existing team public. **Make team private** is optional. `stage-linear` accepts a public project and does not force it private. Then run `stage-linear`.

Review MCP servers in Customize → MCPs. Enable the Linear MCP server. Check the MCP allowlist under Settings → Agents → Execution and Approvals. Then:

```text
List the open issues from our issue tracker.
```

Add the plugin from the local repository (Customize → Plugins → Add → From Local Repository, then `plugins/standard-bug-fix`). Go to Customize → Plugins → Personal. Select Add to enable the “Standard bug fix” plugin. Show that the plugin has skills, rules, and MCP server. Then:

```text
Work on a standard bug fix for the issue where clicking overdue does not filter.
```

### How do you parallelize a task?

#### Open the plan

Open a new agent. Then open `.cursor/plans/resolve-dispute.md`, `.cursor/agents/ledgerly-reviewer.md`, and `.cursor/skills/dispatch-subagents/SKILL.md`. Then:

```text
/multitask @resolve-dispute.md
```

```text
Update Canvas with subagent progress and models used. Make a list of worktree conflicts as you encounter them.
```

```text
ledgerly-reviewer check my work
```

---

## The 301 track

Open `runbooks.html?track=301`. Four section tabs match the Outline Show headings. Copy a card; Do text and prompts are on the card. Optional features are checkboxes, checked by default. Uncheck a feature to hide its beats. The choice is saved in the browser. Optional beats are listed on the feature checklist.

### How do you orchestrate agents?

Open a new local agent. Create the accessibility-manual-reviewer subagent:

```text
/create-subagent accessibility-manual-reviewer that walks pages by keyboard in the Browser, since CI runs automated tests. Report tab order, focus, trap, Escape, and navigation failures with screenshots. Set model: fast, readonly: false.
```

Record the leftover so reset can remove it:

```bash
npm run demo:session -- record project-path .cursor/agents/accessibility-manual-reviewer.md
```

Open the new subagent file in `.cursor/agents` and point out the model field. Change the model to a faster, cost-efficient model.

Optional: Click Continue on Cloud to move this to a Cloud Agent. Click Include Changes. Then:

```text
/multitask Split into three subagents: accessibility-manual-reviewer checks @components/notice-bell.tsx on the invoices page (click, Tab once, Escape, stop at one failure), one runs accessibility tests, one runs app tests.
```

Watch the Working tab.

### How do you go from plan to code?

Optional: Start a new Project. Name it {INSERT COMPANY HERE, default is Ledgerly}. Optional: stage it so each agent runs in its own worktree:

```text
Run all agents in their own worktrees. Parallelize if possible.
```

Open a new local agent. Optional: run the following prompts from the Project. List the issues, then plan:

```text
List the open issues for building the collections command center.
```

```text
/plan Build the collections command center based on the open issues.
```

Review the plan. Build the plan. Optional: Build the plan with Cloud Agents. Open a side chat, then ask what the first subagent adds:

```text
/side
```

```text
/ask what new APIs will this first subagent add?
```

#### Consolidate and open a PR

Move finished worktrees back deliberately. Resolve conflicts on purpose.

```text
Consolidate the completed tasks into one branch. Open a PR that summarizes what each lane changed, links the plan or ticket, and lists what a human should verify before merge.
```

Open the PR. Show the summary a colleague would read first.

Optional:

```text
Show me the project notes and context.
```

If an agent cannot access Linear MCP server, use the issue descriptions in the repository:

```text
Reference issues from @runbooks/linear-field-demos.ts instead of Linear
```

### How do you scale review?

Open a new local agent and change to the feature branch:

```text
Change the branch to the collections command center feature.
```

Run the change reviewer subagent:

```text
Use the change reviewer to review the feature.
```

Check the change reviewer’s output for any high severity issues to assess. Optional:

```text
/review-bugbot
```

```text
/ask What is the highest-risk slice of work? Show me the lines I need to review.
```

Open the highest-risk slice first and read it line by line.

### How do you share ownership safely?

Open a new local agent. Shift review findings left:

```text
Read the review comments and change reviewer subagent findings on this PR. List the ones that apply to future work in this repo. For each one, say whether it belongs in a rule, skill, test, subagent, or a person, and draft it.
```

Optional: Go to the Automations tab. Create a New Automation. Name it Reviewer. Select the demo repository. Click Triggers > PR opened, then select the demo repository and set the author to Anyone. Add “Run change reviewer subagent” to agent instructions. Add “Comment on Pull Request” to tools. Click Save.

```text
Fix dispute cap issue and open a PR.
```

Open the PR and review the check for Automation: Reviewer. Start a new local agent as the second contributor:

```text
Check the PRs in this repository and make a list of files that might conflict with implementing the dispute resolution feature.
```

---

## Do not

- Invent a fourth price, ARR, or a real customer
- "Correct" the $400 claim on dsp_1043 or the seed
- Touch `tests/suggested-credit-api.test.ts` to make the migration pass
- Delete or change either suggested-credit API route
- Commit a KPI restyle to `main`
- Treat a green test as a ship decision
