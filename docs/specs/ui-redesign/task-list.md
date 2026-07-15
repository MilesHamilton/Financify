# Task List — UI Redesign v2 + STS Model Fix
**Date:** 2026-07-15 | ID prefix: `T-R`

Tasks within each wave are parallelizable unless a dependency arrow (→) is noted.

---

## Wave 0 — Foundation (unblock all agents)

- [x] **T-R00** _(database-schema-specialist)_ Generate Drizzle migration for `recurring_streams` table (TR §1.1). File in `drizzle/`. Update `src/db/schema.ts` with the `recurringStreams` table export. Target: `src/db/schema.ts`, `drizzle/`. Ref: TR §1.1.
- [x] **T-R01** _(nextjs-backend-developer)_ Fix `currentMonthFirstDay()` timezone bug in `app/api/budgets/route.ts`: replace UTC helper with `currentNYMonth()` import from `@/domain/metrics` (TR §1.2). Add a comment referencing the bug. Ref: TR §1.2, FRD AC-7.

---

## Wave 1 — Domain Math + Tests (pure; no DB/IO) → after T-R00 schema types are exported

- [x] **T-R10** _(nextjs-backend-developer)_ Define `BudgetComputeInputV2` and `BudgetComputeOutputV2` interfaces in `src/domain/metrics.ts`. Ref: TR §2.1–2.2.
- [x] **T-R11** _(nextjs-backend-developer)_ Implement `computeBudgetStatusV2(input)` pure function in `src/domain/metrics.ts`. Follow exact formula order from TR §2.3. Keep existing `computeBudgetStatus` for now. Ref: TR §2.3.
- [x] **T-R12** _(nextjs-qa-developer)_ Rewrite `src/domain/budget.test.ts` to test `computeBudgetStatusV2`. Cover: (a) worked example from FRD AC-1/AC-3, (b) `noBudgets` fallback path, (c) negative `leftToSpend`, (d) `billsLeftToPay` clamped to 0, (e) `projectedSavings < 0`, (f) `noIncomeData` flag, (g) `on_track` vs `at_risk` boundary. All existing `daysRemainingInMonth` tests must continue to pass. Ref: FRD §4, TR §2. Depends on: T-R11.
- [x] **T-R13** _(nextjs-backend-developer)_ Add `getTodayNY()` helper (extract repeated inline Intl block from `getBudgetStatus` into a named function) in `src/domain/metrics.ts`. Used by the new composite. Ref: TR §2.4.

---

## Wave 2 — Backend Composites → after Wave 1 passes tests

- [x] **T-R20** _(nextjs-backend-developer)_ Implement `getBudgetStatusV2(month)` composite in `src/domain/metrics.ts`. Queries: budgeted totals from `budgets` table, `flexibleSpentThisMonth` (expense spend excluding bill-stream transactions via LEFT JOIN IS NULL on `recurring_streams`), `billsTotal`/`billsPaidThisMonth` from `recurring_streams` + `transactions` join, `earnedThisMonth` from `getMonthSpend` income field, `past30dAvgFlexiblePerDay` (trailing 30-day flexible expense ÷ 30). Calls `computeBudgetStatusV2`. Returns `BudgetStatusV2Result`. Ref: TR §2–3, FRD AC-1–3. Depends on: T-R11, T-R00.
- [x] **T-R21** _(nextjs-backend-developer)_ Implement `getRecurringMonth(month)` in `src/domain/metrics.ts`. Derives upcoming/paid lists per TR §3.2 algorithm. Returns `RecurringMonthResult`. Ref: TR §3.2. Depends on: T-R00.
- [x] **T-R22** _(nextjs-backend-developer)_ Implement `syncRecurringStreams(accessToken, accountId)` in a new `src/domain/recurring.ts` file. Calls `plaidClient.transactionsRecurringGet`, applies `is_bill` default logic (TR §4.1), upserts to `recurring_streams` via Drizzle. Wraps errors with `errInfo()`. Ref: TR §4.2–4.4. Depends on: T-R00.

---

## Wave 3 — API Routes → after Wave 2

- [x] **T-R30** _(nextjs-backend-developer)_ Create `app/api/recurring/route.ts` (GET handler). Auth-gated. Reads `?month=YYYY-MM` param (same validation pattern as existing budget route). Calls `getRecurringMonth(month)`. Returns `RecurringMonthResult`. Ref: TR §3.2.
- [x] **T-R31** _(nextjs-backend-developer)_ Extend existing sync cron handler to call `syncRecurringStreams()` for each active item after `transactions/sync` succeeds. Do NOT add a new `vercel.json` cron entry. Ref: TR §4.2. Depends on: T-R22.
- [x] **T-R32** _(nextjs-backend-developer)_ Update `/budget` page server data fetch to call `getBudgetStatusV2` instead of `getBudgetStatus`. Update `revalidatePath` calls in `/api/budgets` POST to include `/budget`. Ref: TR §3.1. Depends on: T-R20.

---

## Wave 4 — UI Screens → after Wave 3 (can start UI shells in parallel with Wave 3 using mock data)

- [ ] **T-R40** _(ui-developer)_ Rewrite `app/(app)/budget/page.tsx` to match prototype Budget screen layout: month header with ChevronLeft/Right pills (`CalendarClock` icon, `MonthPicker` adapted), Spending card (Wallet icon, green chip, progress bar), Bills & Utilities card (Receipt icon), Earnings row (side-by-side with Bills per reference screenshots), SAVINGS TARGET section (PiggyBank icon, big projected number, risk pill with Info icon, mini SVG bar vs dashed target line, advice footer), CATEGORY BUDGETS section (Add Budget link, category rows with colored ring icon). Ref: FRD §4, TR §5.3, prototype HTML lines 26–134.
- [ ] **T-R41** _(ui-developer)_ Build `app/(app)/recurring/page.tsx` (new server component). Summary card (leftToPay / paidSoFar), UPCOMING list, PAID THIS MONTH list. Each row: icon tile (`#1d2430` bg, `#8b93a3` icon for upcoming; `#36c98e` icon for paid), name, date label, amount. EmptyState when no streams. Ref: FRD AC-4, TR §3.2, prototype HTML lines 226–270.
- [ ] **T-R42** _(ui-developer)_ Rewrite `app/(app)/page.tsx` (Dashboard) to match prototype: month bar-chart selector (horizontal scroll, 7 months, income `#6c8cff` + spend `#3a4356` bars, plain SVG), summary card (SVG donut + Income/TotalSpend/Net stats), BY CATEGORY list card, Cash balance area chart (plain SVG path). Ref: FRD AC-5, prototype HTML lines 137–222.
- [ ] **T-R43** _(ui-developer)_ Rewrite `app/(app)/settings/page.tsx` to match prototype Settings screen: BUDGET section (Monthly budget row → existing income editor modal, Savings target row → existing target editor modal), ACCOUNT section (institution rows from `getAccounts()` with Reconnect link and Landmark icon, Notifications toggle stub, Log out row). Ref: FRD AC-6, prototype HTML lines 273–308.
- [ ] **T-R44** _(ui-developer)_ Create budget category row component `src/components/budget/CategoryBudgetRow.tsx`. Props: `name`, `color`, `icon` (lucide-react component name string → map to dynamic import or static icon map), `spent`, `budgetAmount`. Renders colored ring, progress bar, `leftLabel`. Ref: TR §7, prototype HTML lines 115–133.

---

## Wave 5 — Navigation & IA → after Wave 4

- [ ] **T-R50** _(ui-developer)_ Rewrite `src/components/TabBar.tsx`: 4 equal-width tabs (Budget at `/budget`, Dashboard at `/`, Recurring at `/recurring`, Settings at `/settings`). Icons: `Wallet`, `LayoutDashboard`, `Repeat`, `Settings`. Tab bar background: `#0e121a` (TR §5.2 `--color-tab-bar-bg`). Remove compact Settings treatment. Ref: FRD §2, TR §5.2, prototype HTML lines 312–319.
- [ ] **T-R51** _(nextjs-backend-developer)_ Add 308 permanent redirects: `/spending` → `/`, `/accounts` → `/settings`. Implement in `next.config.ts` `redirects()` array. Ref: FRD §2.
- [ ] **T-R52** _(ui-developer)_ Add "Recent Transactions" link row at bottom of Dashboard summary section linking to `/transactions`. Ref: FRD §2.

---

## Wave 6 — Fonts & Design Tokens → parallel with Waves 4–5

- [ ] **T-R60** _(ui-developer)_ Copy 4 DM Sans woff2 files from `Downloads/Financify UI Redesign/_ds/` to `public/fonts/`. Add `@font-face` blocks and new color/radius tokens to `app/globals.css` (TR §5.1–5.2). Remove any CDN font links from layout. Ref: TR §5.
- [ ] **T-R61** _(ui-developer)_ Audit all card wrappers: standardize `border-radius` to `16px` (cards) and `14px` (month pill tiles). Standardize section header typography to `12px / 700 / 1.2px letter-spacing / uppercase / muted`. Ref: TR §5.3.

---

## Wave 7 — Polish & Verification

- [ ] **T-R70** _(nextjs-qa-developer)_ Run `npm run test` — all `budget.test.ts` tests pass; zero TypeScript errors on `npx tsc --noEmit`.
- [ ] **T-R71** _(nextjs-qa-developer)_ Manual smoke test: verify `/spending` and `/accounts` redirect correctly (308); verify Budget screen day chip appears only on current month; verify negative STS displays red; verify Recurring screen lists correct upcoming/paid split.
- [ ] **T-R72** _(nextjs-qa-developer)_ Sandbox Plaid test: trigger a manual sync (POST to sync route or pull-to-refresh), confirm `recurring_streams` table is populated, confirm Recurring screen renders real data.
- [ ] **T-R73** _(nextjs-backend-developer)_ Remove legacy `computeBudgetStatus` (v1) call from `/budget` page; confirm no other callers remain; delete or mark `@deprecated` if still used by tests. Remove `/spending` page component file after redirect is confirmed.
