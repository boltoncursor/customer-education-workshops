# Ledgerly

Fictional B2B billing ops. Fieldnote Workspace. Operator **Avery Quinn**. Catalog is Starter **$49**, Growth **$99**, Scale **$249**. Demo clock is frozen at **23 August 2026**. Synthetic data only — no real companies.

Use it for the jumpable Grok Build **101**, **201**, and **301** tracks. Copy-paste prompts live in `runbooks.html`. `start-ledgerly` renders that file in a Cursor Canvas. The Catalog menu switches tracks; `runbooks.html?track=201` selects 201 and `runbooks.html?track=301` selects 301 when the file is opened on its own. The presenter run-of-show and speaker notes are `demo-howto.md`.

## Run

Before a demo, open an agent and run the `preflight-checker` subagent with the track you are about to present:

```text
preflight-checker track 201
```

Use `101` or `301` the same way. It reports **Ready** only when every required check for that track passed, and it lists what failed with a remediation (`npm i`, `npx prisma db seed`, `start-ledgerly`, enable the MCP, or `stage-linear` after you confirm the Linear team). It does not install, seed, start the server, stage Linear, or authenticate MCP. If you omit the track, it asks which of `101`, `201`, or `301` and runs no checks. Then bring the app up.

Node 20. Nothing else global.

```bash
npm i
npx prisma generate
npx prisma db seed
npm run dev
```

Open **http://localhost:43173**. Or ask an agent to run the `start-ledgerly` skill — it starts the app on 43173, seeds only when the database is missing or empty, and opens `runbooks.html` in a Cursor Canvas.

`npm test` is **1 failed / 37 passed** on a clean tree — `tests/suggested-credit-api.test.ts` is the planted API-version bug. The UI shows the deprecated v1 result of $400 for `dsp_1043`; v2 and the stored credit correctly cap at the $249 Scale price. Status pills on Invoices and Disputes write `state=` while the pages read `status`, so clicking a filter does not change the list — that is a separate planted UI seam, not a second red test. Reset a demo with `npm run demo:reset` first; `reset-demo-state` only finishes reported MCP cleanup. Use `npm run db:reset` only for data.

### Planted demo issues

These are intentional. Leave them for the demo, and do not ship them outside demos.

- **Suggested credit.** `tests/suggested-credit-api.test.ts` stays red because `lib/disputes/suggested-credit-api.ts` still selects deprecated v1. Do not edit the test, either route, or the seed to make the suite green.
- **W2 Tab listener.** `.cursor/plans/keyboard-walkthrough-audit.md` tells the W2 task to add a document-level `keydown` listener in the app chrome that calls `event.preventDefault()` whenever the key is Tab. That step is intentional. It would block Tab on every page if that listener is added in the shell. `components/app-chrome.tsx` does not contain it yet. The change reviewer should flag it as High. It must never ship outside demos. Do not remove it, reword it, or label it inside the plan.

`npm run test:a11y` runs the WCAG checks in `tests/a11y/` (4.5:1 text contrast and missing labels). They are not part of `npm test`. The command currently fails on contrast (status badges, some muted text, and growth text); label checks pass.

## App

Dashboard, Invoices, Collections, Disputes, Settings. Extra book accounts are in `prisma/extra-accounts.ts`.

| What | Where |
| --- | --- |
| Runbook beats | `runbooks.html`, rendered in a Cursor Canvas by `start-ledgerly`. Regenerate with `npm run runbooks:export` after editing `runbooks/beats/` |
| `/loop` job | `POST` then `GET` `/api/demo/job` (~45s, not written to SQLite) |
| Agents | `.cursor/agents/` — `ledgerly-reviewer`, `api-instrumenter`, `dispute-verifier`, `change-reviewer`, `preflight-checker` |
| Skills | `.cursor/skills/` — run the demo, stage Linear, or pick a Cursor workflow |
| Disk plugin | `plugins/standard-bug-fix/` — add from local repository; `/standard-bug-fix`, Linear MCP |
| Presenter script | `demo-howto.md`, the 101, 201, and 301 run-of-show |

## Starter prompts

Ask:

```text
What are Ledgerly's only plan prices, and which seeded invoices are overdue? Cite lib/plans.ts, prisma/seed.ts, and prisma/extra-accounts.ts.

Explain the dispute flow end to end. What is intentionally unfinished? Cite the resolve helper, the resolve API route, and the dispute page. Do not edit any files.
```

Cmd-K on the settings description default:

```text
Rewrite this input's default value as one calm sentence explaining that the demo clock is frozen on 23 August 2026 so overdue math never drifts during a meeting. Keep it under 15 words.
```

Agent — suggested-credit API migration:

```text
Diagnose why dsp_1043 shows a $400 suggested credit even though v2 caps it at $249. Switch lib/disputes/suggested-credit-api.ts from v1 to v2. Preserve both API routes, the $400 dispute claim, and tests/suggested-credit-api.test.ts. Run the relevant tests and verify the page shows $249 from v2.
```

Then create the guardrail live:

```text
/create-rule Future code must never call /api/v1/disputes/*/suggested-credit. It must use /api/v2/disputes/*/suggested-credit. Create the project rule at .cursor/rules/suggested-credit-api-v2.mdc and show me the file before I keep it.
```

Design Mode on the dashboard KPI cards:

```text
Restyle the four KPI cards on this dashboard using only the existing design tokens in app/globals.css: a soft indigo accent on each card, stronger emphasis on the value, and a subtle hover lift. No new hex colors, no layout rewrite, no data or price changes — $49, $99, and $249 stay exactly as rendered. Touch components/kpi-card.tsx, and app/page.tsx only if you must. Two files max, nothing under lib/ or tests/. Show me the diff — I am undoing this after the demo.
```

## The 101 track

Open `runbooks.html` in the Canvas (track 101), copy a card, and paste it in Grok Build. You still review the result.

1. **What is Grok Build?** — Ask, Plan, Build in Agent mode, Debug, and check the models.
2. **How do you work with an agent?** — Run Mode allowlist, verify the email feature, redact, stop, interrupt and steer, continue to the end, review diffs, restore from a checkpoint.
3. **How do you govern an agent?** — create and test a rule, create and test a skill, Canvas, MCP / Figma.

## The 201 track

Open `runbooks.html?track=201`, or switch to 201 with the Catalog menu in the Canvas, copy a card, and paste it in Grok Build. You still review the result.

1. **How do you manage context?** Rename agents, Ask DDD (whole app vs `@invoice-table.tsx`), check each agent's context window, ask across chats.
2. **How do you standardize agents?** Personal create-api skill, promote it to the project.
3. **How do you connect external tools?** Linear MCP, MCP allowlist, list open issues from the issue tracker, add `plugins/standard-bug-fix` from the local repository, enable the Standard bug fix plugin (skills, rules, MCP server), standard bug fix on the overdue filter. Use a public or private Linear team and project, then run `stage-linear`.
4. **How do you parallelize a task?** — open a new agent, open the resolve-dispute plan, ledgerly-reviewer, dispatch-subagents skill, `/multitask`, Canvas subagent progress, ledgerly-reviewer check.

## The 301 track

Open `runbooks.html?track=301`, or switch to 301 with the Catalog menu in the Canvas, copy a card, and paste it in Grok Build. You still review the result. Optional features are checkboxes, checked by default. Uncheck a feature to hide its beats. The choice is saved in the browser.

1. **How do you orchestrate agents?** Open a local agent, create accessibility-manual-reviewer, point the subagent at a faster cost-efficient model, optionally move to a Cloud Agent, `/multitask` the audit, and watch the Working tab.
2. **How do you go from plan to code?** Optionally start and stage a Project, list collections issues, plan and build, `/side`, consolidate into a PR, and fall back to repo issues if Linear MCP is unavailable.
3. **How do you scale review?** Feature branch, change reviewer subagent, high severity issues, optional Bugbot, highest-risk slice.
4. **How do you share ownership safely?** Shift findings into a rule, skill, test, subagent, or a person, optional Reviewer automation, and files that might conflict.

## Choose the Linear team (manual)

Linear MCP cannot create teams. Public and private teams are both valid. Public and private projects are both valid. Do this in the Linear UI **before** the 201 MCP section when the operator does not already have a team.

1. Open Linear → **Settings → Teams → New team**.
2. Name it for this operator only (example: `{displayName}-field-demos`).
3. Leave it public, or turn on **Make team private**. Team key can be **LY**. Confirm it at `https://linear.app/<workspace>/settings/teams/LY`.
4. When the team is private, members are **only you**.
5. Then ask an agent to run `stage-linear`. That skill creates or reconciles project `ce-field-demos` on this team with the three Fieldnote issues, the nine Collections Command Center slices tagged as that feature, and the WCAG keyboard-walkthrough issue as the thirteenth staged title. The project stays public unless you ask for private.

`stage-linear` never guesses the team — it lists your teams and asks you to **confirm the exact one** before writing, so any team name works. The next stage reopens the project and reopens recorded issues to `Todo`, and creates a title only when it is missing or a canceled issue will not leave `Canceled`. `reset-demo-state` uses the same confirmation, then cancels the recorded issues and cancels the project (issues stay linked; your team is retained for the next run).

A public team makes the project visible to that team. A public project on that team is valid — `stage-linear` does not refuse it or force it private.
During a fresh setup, create issues sequentially: suggested-credit first, **Clicking Overdue or Needs review does not filter the queue** second, and invoice-email third.

## Agents and skills

| Name | Role |
| --- | --- |
| `ledgerly-reviewer` | Read-only review after a change. Confirms the work runs, then catalog, seed names, and planted seams. |
| `api-instrumenter` | One API route per parallel worker. |
| `dispute-verifier` | Dispute-resolution finish line. No product code. |
| `change-reviewer` | Diff inspection with `readonly: false` so it can run `git status` and `git diff`. Its instructions forbid edits. Reports Passed, then Incomplete with high, warning, and suggestion findings for sensitive data, hard rollback, missing tests, edited failing tests, scope outside the plan, and new dependencies or shell commands. |
| `preflight-checker` | Before a 101 / 201 / 301 session. Reports pass / fail / blocked per track dependency. `readonly: false` for shell probes; does not install, seed, stage Linear, or authenticate MCP unless asked to remediate. |
| `choose-cursor-workflow` | Walk the 101, 201, or 301 track and pick the mode or model. |
| `stage-linear` | Reconcile Fieldnote issues on the `ce-field-demos` Linear project. Public and private teams and projects are both valid. |
| `standard-bug-fix` | Pull one ce-field-demos Linear issue, then fix only that bug. |
| `dispatch-subagents` | Parallel Task launches. |
| `hand-to-cloud-agent` | Hand durable work to a Cloud Agent. |
| `autopilot` (built in) | Current PR-to-merge-ready skill; formerly `/babysit`. |
| `automate` (built in) | Draft a scheduled or event-triggered Grok Build Automation. |

## Notes

- Prices and customer names only from `lib/plans.ts`, `prisma/seed.ts`, and `prisma/extra-accounts.ts`.
- Port 43173 busy: stop the old `npm run dev`. Empty dashboard: `npm run db:reset`.
