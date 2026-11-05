<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ledgerly

Fictional billing ops SaaS. Fieldnote Workspace. Operator Avery Quinn. No auth. No real companies.

Catalog prices are frozen: Starter **$49**, Growth **$99**, Scale **$249**. Never invent a fourth price, live ARR, or a real customer name.

This is a **Grok Build demo app** with three jumpable tracks: 101, 201, and 301. Runbook beats live in `runbooks/meta.ts` and in `runbooks.html`. `start-ledgerly` renders that file in a Cursor Canvas. Regenerate it with `npm run runbooks:export` whenever beats change — `tests/runbooks.test.ts` fails if it drifts. Open `runbooks.html?track=301` for the 301 track. Optional features are checkboxes, checked by default. Uncheck a feature to hide its beats. The choice is saved in the browser. The presenter run-of-show is `demo-howto.md`. Project subagents live in `.cursor/agents/`. Skills live in `.cursor/skills/`. Do not add talk-track or speaker-note skills. Do not reintroduce retired Advanced runbooks without a request.

Before a demo session, invoke `preflight-checker` with the track id (`preflight-checker track 101`, `201`, or `301`). It reports pass / fail / blocked for that track and does not install, seed, start the server, stage Linear, or authenticate MCP. If the track is missing, it asks and runs no checks. `start-ledgerly` is the start step after the report, not a substitute for preflight.

## Grok Build Cloud specific instructions

### Install

```bash
npm i
npx prisma generate
```

`.cursor/environment.json` runs that on setup.

### Seed

SQLite file is `prisma/dev.db` (gitignored). Schema URL is hardcoded in `prisma/schema.prisma` as `file:./dev.db`. No `.env` required.

```bash
npx prisma db seed
```

The seed script runs `prisma db push` first, then reloads deterministic Fieldnote data. Safe to re-run. Demo clock is **2026-08-23**.

### Dev server

```bash
npm run dev
```

Listens on **43173** (not 3000).

### Linear team (manual, before 201 MCP)

Linear MCP cannot create teams. Public and private teams are both valid. Public and private projects are both valid. The operator picks a team they belong to, then an agent runs `stage-linear`.

1. Open Linear → **Settings → Teams → New team** only when they need a new team.
2. Name it for this operator only (example: `{displayName}-field-demos`).
3. Leave it public, or turn on **Make team private**. Team key can be **LY**. Settings URL looks like `https://linear.app/<workspace>/settings/teams/LY`.
4. When the team is private, members are **only the operator**.
5. Run `stage-linear` to create or reconcile project `ce-field-demos` on that team with the three Fieldnote issues, the nine Collections Command Center slices (same project, tagged with the feature note and a team-scoped label), and the WCAG keyboard-walkthrough issue as the thirteenth staged title. The project stays public unless the operator asks for private.

`stage-linear` never guesses the team — it lists the operator's teams and confirms the exact one before writing, so any team name works. It does not refuse a public project or force the project private. The next stage reopens the project and reopens recorded issues to `Todo`, and creates a title only when it is missing or a canceled issue will not leave `Canceled`. `reset-demo-state` uses the same confirmation, then cancels the recorded issues and cancels the project without unlinking (the team is retained; the next `stage-linear` reactivates the board).

Do not `save_project` onto a team the operator did not confirm. Do not add a local ticket board, ticket API, ticket MCP, or ticket marketplace plugin.

### Demo reset

For any reset request, run `npm run demo:reset` first. It resets everything it knows about — there is no 101-only, 201-only, or 301-only reset. The `reset-demo-state` skill handles only its reported MCP/discovery leftovers. When a demo beat creates a new leftover, update its session event record and `scripts/demo-reset.ts` in the same change.

### Tests

```bash
npm test
```

One test fails on a clean tree: `tests/suggested-credit-api.test.ts` expects the client to use v2 while `lib/disputes/suggested-credit-api.ts` still selects deprecated v1. That migration is tracked on its own, so do not fix it as a drive-by. Preserve both routes and never change the test or seed to get green.

### Planted demo issues

These are intentional. Leave them in place for the demo, and do not ship them outside demos.

- **Suggested credit.** The red test above. The client still selects deprecated v1. Do not edit the test, either route, or the seed to make the suite green.
- **W2 Tab listener.** `.cursor/plans/keyboard-walkthrough-audit.md` tells the W2 task to add a document-level `keydown` listener in the app chrome that calls `event.preventDefault()` whenever the key is Tab. That step is intentional. It would block Tab on every page if that listener is added in the shell. `components/app-chrome.tsx` does not contain it yet. The change reviewer should flag it as High. It must never ship outside demos. Do not remove it, reword it, or label it inside the plan.

Passing tests include `tests/money.test.ts` and `tests/plans.test.ts`. Environment start seeds the database and runs only the passing tests so a red suite cannot mark the machine as failed to boot.

Shipped suite on a clean tree: **1 failed / 33 passed**. The `dsp_1043` page shows v1's $400 result; v2 and the stored credit are correctly capped at $249. Invoice and dispute status pills write `state=` while the pages read `status` — that click path is a separate planted UI seam, not a second red test. Do not volunteer it when explaining the app or the failing test; only when the user is on that click path.

WCAG checks live in `tests/a11y/` and run separately with `npm run test:a11y`; `npm test` excludes them, so they do not change the shipped count. They check 4.5:1 text contrast for the token pairs in `app/globals.css` (light and dark) and labels on form controls, buttons, links, and images. The suite is red today on contrast only; label checks pass. Failing pairs: light `--success`, `--warning`, and `--danger` on their `-soft` badge backgrounds; light `--muted-foreground` on `--muted` and on `--indigo-soft`; light `--success` on `--card`; and dark `--danger` on `--danger-soft`. Keep `test:a11y` out of `npm test`, the environment start command, and `scripts/demo-reset.ts`.

### Multi-file stub (leave it unless asked)

Incomplete on purpose:

- `lib/disputes/resolve.ts`
- `app/api/disputes/[id]/resolve/route.ts`
- `app/disputes/[id]/page.tsx` (resolution panel)

### Product constraints

- Prices only from `lib/plans.ts`.
- Customer names only from `prisma/seed.ts` and `prisma/extra-accounts.ts`.
- Comments in code must not cite Slack, GitHub, or issue-tracker URLs.
- Do not rename Collections / Nudge / Pulse / Slatebook / Harborbill, and never reintroduce retired pre-remap names.
- Do not add Deno workflows or GitHub Actions starters. Do not add better-sqlite3.
- Do not add talk-track / speaker-note skills. Do not add a fourth catalog-solving agent. Runbook beats live in `runbooks/meta.ts`.
- Do not rename the FilterPills query key from `state` to `status` unless asked.
- Do not add a Prisma/SQLite MCP or restore the `mcp/` directory. Query the seed with Prisma (`write-prisma-query`) or the HTTP API.

### Agents and skills

| Path | Role |
| --- | --- |
| `.cursor/agents/ledgerly-reviewer.md` | Read-only review after code changes. Confirms the work runs. |
| `.cursor/agents/api-instrumenter.md` | `/multitask` worker — one API route |
| `.cursor/agents/dispute-verifier.md` | `/goal` and `/orchestrate` finish line |
| `.cursor/agents/change-reviewer.md` | Diff inspection. `readonly: false` so it can run git diff. Instructions forbid edits. High, warning, and suggestion. |
| `.cursor/agents/preflight-checker.md` | Before a 101 / 201 / 301 session. Track dependency pass / fail / blocked. `readonly: false` for shell probes; no install, seed, or MCP auth unless asked to remediate. |
| `.cursor/skills/choose-cursor-workflow/` | Walk the 101, 201, or 301 track: modes, models, rules, skills, and finishing one task with an agent |
| `.cursor/skills/stage-linear/` | Reconcile Fieldnote issues on the `ce-field-demos` Linear project. Public and private teams and projects are both valid. |
| `.cursor/skills/standard-bug-fix/` | `/standard-bug-fix` — pull one ce-field-demos Linear issue and fix only that bug |
| `.cursor/skills/dispatch-subagents/` | Parallel Task launches |
| `.cursor/skills/hand-to-cloud-agent/` | Cloud `/goal`, `/autopilot`, and `/orchestrate` |
| `.cursor/skills/write-prisma-query/` | Invoice, dispute, and customer lookups against SQLite — not an MCP |
| `.cursor/mcp.json` | Empty project MCP map. 101 uses Figma (user MCP). 201 uses Linear (user MCP or `plugins/standard-bug-fix`). |
| `plugins/standard-bug-fix/` | 201-track disk plugin: `/standard-bug-fix` skill, Linear writeback rule, Linear MCP. |
