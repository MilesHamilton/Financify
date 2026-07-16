# FRD — Financify UI Redesign v2 + Safe-to-Spend Model Fix
**Date:** 2026-07-15 | **Status:** Draft

---

## 1. Feature Overview

**What:** Rework the Financify app to match the authoritative prototype (`Financify Redesign.dc.html`) and fix the safe-to-spend-per-day (STS) calculation, which currently overstates what is safe to spend by ignoring per-category budgets and outstanding bills.

**Why:** The current STS formula (`income − savingsTarget − spentThisMonth`) divides everything evenly across remaining days. It knows nothing about upcoming bills or the user's category budgets, so on a day when rent is due the number looks safe when it is not. The redesign also restructures the IA to add a Recurring (bills) screen and consolidates analytics into the Dashboard.

---

## 2. Information Architecture Decision

**Final tab set (4 tabs, matching prototype exactly):**

| Tab | Route | Icon (lucide-react) |
|---|---|---|
| Budget | `/budget` | `Wallet` |
| Dashboard | `/` | `LayoutDashboard` |
| Recurring | `/recurring` | `Repeat` |
| Settings | `/settings` | `Settings` |

**Transactions:** The `/transactions` route is retained and reachable via a "Recent Transactions" link row on the Dashboard. It is removed from the tab bar. The tab bar shrinks from 5 items to 4 equal-width tabs (no compact Settings tab).

**Route redirects:** `/spending` → permanent redirect to `/` (Dashboard content absorbed). `/accounts` → permanent redirect to `/settings` (reconnect flow absorbed into Settings ACCOUNT section).

---

## 3. User Stories

**US-1 — Accurate daily budget:** As a user, I want my safe-to-spend/day number to account for my per-category budgets and upcoming bills so that the figure is actionable rather than misleadingly optimistic.

**US-2 — Bills at a glance:** As a user, I want a Recurring screen that shows which bills I still owe this month and which I've already paid, so I never miss a payment.

**US-3 — Savings trajectory:** As a user, I want a Projected Savings card that tells me whether I am on track to hit my savings goal and what daily rate I need to target if I am not.

**US-4 — Historical context:** As a user, I want a Dashboard with a scrollable month-bar chart and a spending donut so I can compare months and see where my money went without leaving the main screen.

**US-5 — Consistent design:** As a user, I want DM Sans typography, updated card radii, and the new color chips so the app feels cohesive with the design system.

---

## 4. Acceptance Criteria

### AC-1: STS v2 model (worked example from prototype mock data)
- Given: `budgetedTotal = $2,596` (sum of per-category budgets), `flexibleSpentThisMonth = $1,291`, `daysRemaining = 16`
- Then: `leftToSpend = 2596 − 1291 = $1,305`
- Then: `safeToSpendPerDay = 1305 ÷ 16 = $81.56`, rendered as `$82/day` (rounded to integer for chip display, exact 2dp for hero)
- Then: day chip reads `"$82/day for 16d"` and is shown only when viewing the current month
- Then: spend progress bar width = `1291 / 2596 = 49.7%`, footer reads `"$1,291 spent"` / `"$2,596 budgeted"`

### AC-2: Bills & Utilities card (worked example)
- Given: `billsTotal = $2,500` (sum of active bill stream avg_amounts), `billsPaidThisMonth = $2,350`
- Then: `billsLeftToPay = 150`, headline reads `"$150 left to pay"`
- Then: progress bar width = `2350 / 2500 = 94%`, footer reads `"$2,350 paid"`

### AC-3: Projected Savings card (worked example)
- Given: `estimatedIncome = $5,200`, `billsTotal = $2,500`, `flexibleSpentThisMonth = $1,291`, `past30dAvgFlexiblePerDay = $42`, `daysRemaining = 16`, `savingsTarget = $1,500`
- Then: `projectedFlexibleSpend = 1291 + (42 × 16) = 1291 + 672 = $1,963`
- Then: `projectedTotalSpend = 2500 + 1963 = $4,463`
- Then: `projectedSavings = 5200 − 4463 = $737`
- Then: `savingsStatus = "at_risk"` (737 < 1500)
- Then: `advicePerDay = (5200 − 1500 − 1291 − 150) ÷ 16 = 2259 ÷ 16 = $141.19/day`
- Then: advice footer reads (paraphrased): *"Try to slow down your spending. You can still meet your savings target by limiting flexible spend to $141/day for the rest of the month."*

### AC-4: Recurring screen
- UPCOMING section lists active bill streams with no matching transaction this month, sorted by next expected date ascending
- PAID THIS MONTH section lists bill streams with a matched transaction this month, showing paid date and amount
- Summary card shows `leftToPay` (green) and `paidSoFar` (muted), dynamically labeled with current month name

### AC-5: Dashboard
- Month bar chart shows the 7 most recent months (or all available); selected month highlighted with `#6c8cff` border
- Donut SVG segments match category colors from `categories.color`; center label shows `"Spent $X"` for selected month
- Cash balance area chart shows depository account balance history from `account_balance_snapshots`
- "BY CATEGORY" list is sorted by spend descending, includes share %

### AC-6: Settings ACCOUNT section
- Institution rows rendered from `getAccounts()`, grouped by item
- "Reconnect" link triggers Plaid Link re-auth (existing `/api/plaid/link/start` flow)
- Log out row calls NextAuth `signOut`

### AC-7: Timezone fix
- `currentMonthFirstDay()` in `app/api/budgets/route.ts` replaced by `currentNYMonth()` pattern from `metrics.ts` so month attribution is consistent across all APIs (no 8pm–midnight ET drift)

---

## 5. Edge Cases & Error Scenarios

| Scenario | Behavior |
|---|---|
| No per-category budgets set | `noBudgets = true`; STS falls back to income−savingsTarget−spentThisMonth (current v1 model); Budget screen shows an EmptyState prompt to "Add a budget to unlock the daily rate" in place of Spending card |
| No income data and no override | `noIncomeData = true`; existing EmptyState shown on Spending card and Projected Savings card |
| Viewing a past or future month | Day chip (`"$X/day for Nd"`) is hidden; `daysRemaining` set to `daysRemainingInMonth` clamped to 1 on last day |
| First of month | `daysRemaining = total days in month` (e.g., 31 for July 1); day chip shows full month count |
| Last day of month | `daysRemaining = 1` (minimum from `daysRemainingInMonth`); divide by 1, not 0 |
| `leftToSpend ≤ 0` (over budget) | STS is negative or zero — displayed as negative (red); not capped (product decision 1B preserved) |
| `billsLeftToPay < 0` (bills overpaid / duplicate match) | Clamp to 0; do not show negative left-to-pay |
| `projectedSavings < 0` | Savings bar height = 0%; status = at_risk; advice rate computed normally (may be negative, shown red) |
| No active bill streams | Bills & Utilities card shows `$0 left to pay` / `$0 paid`; Recurring screen shows empty UPCOMING list with a `EmptyState` |
| Month with no recurring streams (Plaid product not enabled) | Heuristic fallback: Bills card hidden; Recurring screen shows EmptyState "Connect a supported account to detect recurring bills" |
| `projectedSavings >= savingsTarget` | Status = on_track; advice footer hidden (no advice needed) |

---

## 6. Success Metrics

- STS calculation matches prototype math to within $1 rounding difference for any given month
- Recurring screen loads in < 1 s (server component, no client waterfall)
- Zero console errors for raw Plaid/Axios responses in production (errInfo whitelist enforced)
- All existing `budget.test.ts` tests rewritten to v2 model; CI passes
- `/spending` and `/accounts` return 308 redirect; no broken links in app shell
