# Phase 1 Report — STS Model Fix + Recurring Backend

**Completed:** 2026-07-15 · **Mode:** team execution (team `redesign-phase1`)
**Scope:** T-R00 through T-R32 (backend + tests only). Phase 2 (UI, Waves 4–7) intentionally NOT started — human checkpoint reached.

---

## 1. Task completion (all committed on `main`, gates green)

| Task | Wave | Agent | Commit | Summary |
|------|------|-------|--------|---------|
| T-R00 | 1 | database-schema-specialist | `d47e02a` | `recurringStreams` table + migration `0002_normal_rawhide_kid.sql` |
| T-R01 | 1 | nextjs-backend-developer | `d848184` | NY-based month attribution in `app/api/budgets/route.ts` |
| T-R10 | 2A | nextjs-backend-developer | `b66e3ef` | `BudgetComputeInputV2` / `BudgetComputeOutputV2` interfaces |
| T-R11 | 2A | nextjs-backend-developer | `92d7a45` | `computeBudgetStatusV2` pure function |
| T-R13 | 2A | nextjs-backend-developer | `173a594` | `getTodayNY()` helper extracted |
| T-R20 | 2A | nextjs-backend-developer | `d9a81fe` | `getBudgetStatusV2(month)` composite + `BudgetStatusV2Result` |
| T-R21 | 2A | nextjs-backend-developer | `4faacfd` | `getRecurringMonth(month)` + `RecurringMonthResult`/`RecurringItem` |
| T-R22 | 2B | nextjs-backend-developer | `992fb09` | `syncRecurringStreams(accessToken)` in new `src/domain/recurring.ts` |
| T-R12 | 2C | nextjs-qa-developer | `aefa680` | `budget.test.ts` rewritten for V2 (37 tests) |
| T-R30 | 3 | nextjs-backend-developer | `5e9a1ac` | `GET /api/recurring?month=YYYY-MM` route |
| T-R31 | 3 | nextjs-backend-developer | `3bd0c87` | `syncRecurringStreams` hooked into cron sync path |
| T-R32 | 3 | nextjs-backend-developer | `478dc21` | `/budget` page → `getBudgetStatusV2` + `/budget` revalidate |

**12 tasks, 12 commits.** (The approved plan's "11 tasks" count was off by one; the full T-R00–T-R32 set is 12 tasks — all delivered.)

## 2. Quality gates

Every task ran `npm run lint`, `npx tsc --noEmit`, `npm run test` before commit. Final combined tree state:
- **lint:** clean, zero errors
- **tsc --noEmit:** clean, exit 0
- **test:** 41 passing / 44. The **3 failures are pre-existing** integration tests in `src/lib/sync.test.ts` that require a live `DATABASE_URL` (Neon connection); they fail identically on the base commit before any Phase-1 work and are unrelated to these changes. All 37 `budget.test.ts` (V2 + preserved `daysRemainingInMonth`) pass.

## 3. Plaid probe outcome (T-R22 gate)

Per plan, Lane B ran a throwaway probe of `plaidClient.transactionsRecurringGet` before implementing.

- **Result: NOT a product error.** The probe returned a `no_db_connectivity` condition — `.env.local` is absent in this environment (0 env vars injected via tsx; no items/DB reachable).
- This is explicitly **not** an `INVALID_PRODUCT` / product-not-enabled error, so the block condition was not triggered. T-R22 was implemented defensively per TR §4.4 (heuristic fallback: on any error, log via `errInfo()` and treat as zero streams) and committed.
- **Open verification gap:** because there were no live Plaid credentials, `transactionsRecurringGet` could not be exercised against the sandbox. The recurring product's real availability and the stream-mapping shape remain **live-unverified**. This must be confirmed in an environment with `.env.local` (sandbox `PLAID_ENV=sandbox`, `ins_109508`) — see Phase-2 risk R1 and task T-R72.

## 4. Key design decisions

- **Bill-stream matching heuristic** (shared by `getBudgetStatusV2` and `getRecurringMonth`, must stay in sync): amount within ±20% of `average_amount` AND (exact `merchant_name` match when non-null, else case-insensitive `name` = `description`). Pending transactions counted as paid for the current month.
- **`recurring_streams` schema** added CHECK constraints on `frequency` and `status` (matches existing project pattern) plus a nullable `last_amount numeric(14,2)` column beyond the base TR DDL. `is_bill` DB default TRUE is a safety net; the sync writer always sets it explicitly (TRUE for PFC ∈ RENT_AND_UTILITIES / LOAN_PAYMENTS / INSURANCE, else FALSE).
- **`syncRecurringStreams(accessToken)`** takes a pre-decrypted token (no `accountId` param — each Plaid stream carries its own `account_id`). One call covers all accounts on an item. `UNKNOWN`-frequency streams are skipped (CHECK constraint permits only 5 values).
- **Cron hook (T-R31)** placed in `app/api/cron/sync/route.ts` only (the canonical path per TR §4.2); the manual pull-to-refresh trigger was intentionally not hooked. Recurring-sync failures are isolated in their own try/catch and never affect the transaction-sync `synced`/`failed` accounting.
- **`getBudgetStatusV2` result** exposes `spendPct`/`billsPct`/`savingsBarPct`/`daysRemaining` as raw numbers for bar rendering; all monetary fields are 2dp strings for the `Amount` component.

## 5. Deviations from spec

- Task-list count discrepancy noted above (12 vs stated 11) — no scope change.
- `last_amount` column added to `recurring_streams` (task-list extension note), not in the base TR §1.1 DDL.
- The migration `0002_normal_rawhide_kid.sql` was **generated only, not applied** to any database (no DB connectivity; per task spec do not run against production).

## 6. Open risks for Phase 2

- **R1 (High): Plaid recurring live-unverified.** No sandbox/live exercise of `transactionsRecurringGet` was possible (no `.env.local`). Before/at Phase 2, run T-R72 in a credentialed sandbox to confirm the product is enabled, streams populate `recurring_streams`, and the mapping/matching heuristic produces correct upcoming/paid splits.
- **R2 (Med): `incomeOverride` prop gap.** `BudgetStatusV2Result` does not carry `incomeOverride`, so the `/budget` page still makes a parallel `getMonthlyIncomeEstimate()` call solely to feed `IncomeOverrideEditor`. Phase 2 should either add `incomeOverride` to the V2 result or point the editor at a settings endpoint (removes a duplicate query).
- **R3 (Med): matching-heuristic drift.** The ±20% amount + merchant/name match is duplicated as a SQL const in `getBudgetStatusV2` and a JS fn in `getRecurringMonth`. They currently agree; any future change must update both, or `flexibleSpentThisMonth` (bills excluded) and the Recurring paid/upcoming split will disagree.
- **R4 (Low): dangling commit.** A parallel-agent staging race produced an abandoned duplicate T-R32 commit (`3f5222d`, not on `main`); HEAD is correct. Harmless; can be pruned by gc. Lesson: parallel agents sharing the git index need staged-file discipline (each only `git add`s its own paths).
- **R5 (Low): v1 `computeBudgetStatus` still present.** Retained intentionally for back-compat; T-R73 (Phase 2) removes it once all callers are migrated.

## 7. Checkpoint

Phase 1 is complete and green. **STOP — Phase 2 (UI screens, Waves 4–7) requires separate human go-ahead.**
