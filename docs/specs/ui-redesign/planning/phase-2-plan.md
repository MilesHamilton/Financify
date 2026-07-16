# Phase 2 Execution Plan — UI Redesign + IA

**Approved:** 2026-07-15 (after Phase 1 checkpoint) · **Mode:** team execution · **Tasks:** 11 (T-R40–T-R73, with T-R44→R40 and T-R52→R42 folded)

## Waves

```
Wave 1 (solo, first — secure assets):
  T-R60  Copy DM Sans woff2 → public/fonts, @font-face + token deltas in app/globals.css;
         also archive design source (dc.html + screenshots) into docs/specs/ui-redesign/design/

Wave 2 (4-way parallel, distinct files):
  T-R40 (+T-R44)  /budget screen rewrite + CategoryBudgetRow      → ui-developer
  T-R41           /recurring screen (new)                          → ui-developer
  T-R42 (+T-R52)  Dashboard rewrite + Recent Transactions link     → ui-developer
  T-R43           /settings rewrite                                → ui-developer

Wave 3 (parallel, after Wave 2):
  T-R50  TabBar → 4 tabs        T-R51  308 redirects /spending→/, /accounts→/settings
  T-R61  radius/typography audit across components

Wave 4 (sequential):
  T-R70  full gates (lint, tsc, vitest)
  T-R71  smoke test (limited: no .env.local → no live DB; verify build + static checks,
         flag anything needing credentialed verification)
  T-R72  Plaid sandbox verify — BLOCKED (no .env.local); mark blocked, do not fake it
  T-R73  remove v1 computeBudgetStatus usage, delete /spending page after redirect confirmed
```

## Hard rules

- Design source of truth: `~/Downloads/Financify UI Redesign/Financify Redesign.dc.html` — read it; archive to repo in Wave 1 before anything else.
- No CDN assets at runtime (self-host DM Sans; icons via lucide-react package). Canvas stays #0b0e14 (iOS splash constraint).
- One writer per file; T-R61 audit runs only after Wave 2 lands.
- Gates per task: `npm run lint`, `npx tsc --noEmit`, `npm run test`. Commit per task: `feat(redesign): … (T-Rxx)`.
- Never `git add .` — repo has intentionally-uncommitted folders (memory-bank/, tmp/, HANDOFF-DESIGN.md).

## Exit criteria

All tasks committed (T-R72 explicitly marked blocked), task-list checkboxes updated,
`planning/phase-2-report.md` written, remaining untracked spec docs (FRD.md, TR.md, phase plans)
committed with the docs commit.
