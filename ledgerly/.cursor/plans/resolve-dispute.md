# Finish dispute resolution — three parallel agents

Chat prompt:

```
/multitask @resolve-dispute.md
```

Coordinator behavior (no wrapper Task, first Tasks are the named workers, contract in each prompt) is `.cursor/rules/multitask-no-wrapper.mdc`. Launch shape is `.cursor/skills/dispatch-subagents/SKILL.md`. Do not implement in the parent.

## Goal

Enable **Accept credit** and **Decline** on the dispute detail Resolution panel so a reviewer note and status persist. Cap any accepted credit with the catalog plan price. Never invent a number.

Catalog only: Starter $49, Growth $99, Scale $249 (`lib/plans.ts`). Dispute `dsp_1043` may claim $400 against a $249 Scale invoice — valid input; stored credit on accept must be **$249**, not $400.

`npm test` stays **1 failed / 36 passed** (`tests/suggested-credit-api.test.ts` only). Do not add a red suite to the default run. Do not touch suggested-credit client/tests, seed, or catalog prices.

## Run order

**Pre-warm (before `/multitask`):** delete leftover `components/disputes/resolution-panel.tsx` and `tests/resolve-dispute.e2e.test.ts` from a prior single-agent run. Seed so `dsp_1043` is not leftover `ACCEPTED`/`DECLINED` (`npx prisma db seed`). Ensure `npm run dev` is already Ready on **43173**.

This plan is not done until step 4:

1. Same turn: launch Agent 1, Agent 2, and Agent 3 (tables below) on isolated worktrees. Exactly three implementers. The three implementers use isolated worktrees; the coordinator does not enter them.
2. When all three finish, summarize each worktree’s diff (paths must be disjoint) and apply **helper → API → UI**. A git conflict means an agent edited a sibling’s file — revert that hunk.
3. Same turn after apply: `ledgerly-reviewer` on the combined diff **and** `dispute-verifier` against port 43173. They do not depend on each other. Do not serialize them. Verifier writes no product code.
4. Finish line is **`dispute-verifier`**. Do not skip it. Optional `tests/resolve-dispute.e2e.test.ts` only in this same turn, **out of** `npm test`; skip it if the verifier already covers the live path.

Mid-run **501** from UI or API is expected until the helper worktree is applied.

| Role | Who | When |
| --- | --- | --- |
| Implementer (×3) | Agent 1, Agent 2, Agent 3 below | First Tasks, same turn |
| Request-log worker | `api-instrumenter` | **Out of this slice** |
| Diff review | `ledgerly-reviewer` | After apply, same turn as verifier |
| Finish line | `dispute-verifier` | After apply, port 43173, required |

The files in `.cursor/agents/` are not the three implementers.

## Shared contract (do not fork)

**`resolveDispute` input** (already exported from `lib/disputes/resolve.ts`):

```ts
{ disputeId: string; action: "accept" | "decline"; reviewerNote?: string }
```

`action` is `accept` | `decline`, not `ACCEPTED` | `DECLINED`.

**HTTP** — `POST /api/disputes/[id]/resolve`

- Body: `{ action: "accept" | "decline", reviewerNote?: string }`
- 400 if `action` is missing or not `accept`/`decline`: `{ error: "action must be accept or decline" }`
- 200 on helper success: `{ ok: true }`
- Helper throw: 501 until the helper is real; do not treat “not implemented” as success

**Persist (helper only, via Prisma — never in the route):**

- `accept` → status `ACCEPTED`; `decline` → `DECLINED`
- Save optional `reviewerNote`
- On accept only: `suggestedCreditCents = suggestDisputeCredit({ disputedAmountCents, planPriceCents: planPriceCents(invoice.plan) })`
- Do not persist a credit above the plan

**Out of scope for Agents 1–3:** `lib/disputes/suggested-credit-api.ts`, `tests/suggested-credit-api.test.ts`, `prisma/seed.ts`, `lib/plans.ts` prices, customer email, inventing a fourth price, writing tests, a fourth worktree.

**Optional e2e** (step 3 only): use `dsp_tdd_*` fixtures; restore `dsp_1043` after each mutating case. Cover accept cap **24900**, decline does not raise credit, `{ action: "ACCEPTED" }` → 400, route imports `resolveDispute` with no `prisma.` persist, panel POSTs `{ action, reviewerNote }`.

Suggested credit on the page may still be v1 **$400**. Do not “fix” that in this slice.

| When | Check |
|---|---|
| Agent 1 done | `resolveDispute` no longer throws `not implemented`. Accept cap / decline / missing id as in the contract. |
| Agent 2 done | Bad `action` → 400. `grep`: no `prisma.` in the route. Valid body still calls `resolveDispute`. 501 until helper is applied. |
| Agent 3 done | Buttons enabled. POST body is `{ action, reviewerNote }`. 501 until helper is applied is OK. |
| After apply | Browser on `dsp_1043`. `npm test` still **1 failed / 36 passed**. Same turn: `ledgerly-reviewer` and **`dispute-verifier`**. |

---

### Agent 1 — resolve helper

| | |
|---|---|
| **Owns** | `lib/disputes/resolve.ts` only |
| **Does not own** | route, page, seed, suggested-credit client/tests, tests |
| **Contract** | Implement `resolveDispute`. Load dispute + invoice. Cap accept with `suggestDisputeCredit` + `planPriceCents`. Persist status + note (+ capped cents on accept). Import `prisma` from `@/lib/prisma` here — persist lives in this file. |
| **Verify** | Function no longer throws `resolveDispute is not implemented`. For a $400 Scale claim + `accept`, stored credit is **24900** cents, not 40000. Decline sets `DECLINED` and does not raise the credit. Missing id should throw (route may map it). |

---

### Agent 2 — resolve API route

| | |
|---|---|
| **Owns** | `app/api/disputes/[id]/resolve/route.ts` only |
| **Does not own** | helper Prisma, UI, tests |
| **Contract** | Keep `import { resolveDispute } from "@/lib/disputes/resolve"`. Call it with `{ disputeId: id, action, reviewerNote }`. **Do not inline Prisma persist.** Leave 400 validation as-is. Success stays `{ ok: true }`. Optionally map real helper errors so “not implemented” is 501 and a missing dispute is not a fake 200. |
| **Verify** | Bad `action` → 400. Valid body still calls `resolveDispute` (grep: no `prisma.` in this file). After helper is applied: `POST /api/disputes/dsp_1043/resolve` with `{ "action": "accept", "reviewerNote": "…" }` → 200 `{ ok: true }`. Before helper: 501 is OK. |

---

### Agent 3 — Resolution panel UI

| | |
|---|---|
| **Owns** | `app/disputes/[id]/page.tsx` + a small client child if the page stays a server component (e.g. `components/disputes/resolution-panel.tsx`) |
| **Does not own** | helper, route internals, `SuggestedCredit` / v1 client, tests |
| **Contract** | Enable Accept / Decline. Bind the reviewer note. `POST` `{ action, reviewerNote }` to `/api/disputes/{id}/resolve`. Refresh so status badge and note show after save. Do not call `resolveDispute` from the client. Do not invent a credit in the UI. |
| **Verify** | Buttons are enabled. Note is in the POST body. After helper+API apply: on `/disputes/dsp_1043`, Accept or Decline with a note, reload — status and note persist. Suggested-credit display may still be v1 **$400**; do not “fix” that here. |
