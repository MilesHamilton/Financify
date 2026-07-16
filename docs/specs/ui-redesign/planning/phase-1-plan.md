# Phase 1 Execution Plan — STS Model Fix + Recurring Backend

**Approved:** 2026-07-15 · **Mode:** team execution · **Tasks:** 11 of 22 (T-R00–T-R32)
**Specs:** `docs/specs/ui-redesign/FRD.md`, `TR.md`, `task-list.md`

## Waves & lanes

```
Wave 1 (parallel):
  T-R00  recurring_streams schema + migration      → database-schema-specialist
  T-R01  UTC→NY fix in app/api/budgets/route.ts    → nextjs-backend-developer

Wave 2 (3 concurrent lanes):
  Lane A (sequential, ONE agent — sole owner of src/domain/metrics.ts):
    T-R10 → T-R11 → T-R13 → T-R20 → T-R21
  Lane B: T-R22 syncRecurringStreams in NEW file src/domain/recurring.ts
          FIRST ACTION: Plaid sandbox probe of transactionsRecurringGet —
          if the product isn't enabled, STOP the lane and report
  Lane C: T-R12 spec-first tests in src/domain/budget.test.ts
          written from TR §2.3 formulas (TDD; do not wait for Lane A)

Wave 3 (parallel, after Wave 2):
  T-R30  app/api/recurring/route.ts (GET)          → nextjs-backend-developer
  T-R31  hook syncRecurringStreams into sync cron  → nextjs-backend-developer
  T-R32  /budget page → getBudgetStatusV2 + revalidate → nextjs-backend-developer
```

## Hard rules

- `src/domain/metrics.ts` has exactly ONE writer (Lane A agent). No other agent touches it.
- Quality gates per task (hard blocks): `npm run lint`, `npx tsc --noEmit`, `npm run test`.
- Commit per task on main: `feat(redesign): <summary> (T-Rxx)` / `fix(...)`, Claude co-author trailer.
- Never log raw Plaid/Axios errors — `errInfo()` whitelist.
- Pending txns included in spend math; transfer-group exclusion applies to all new queries.
- Checkpoint after Wave 3: STOP. Phase 2 (UI) requires separate human go-ahead.

## Exit criteria

All 11 tasks committed, gates green, `docs/specs/ui-redesign/planning/phase-1-report.md` written
(including Plaid probe outcome), task-list.md checkboxes updated.
