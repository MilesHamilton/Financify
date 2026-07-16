# TR — Technical Requirements: UI Redesign v2 + STS Model Fix
**Date:** 2026-07-15 | **Status:** Draft

---

## 1. Data Model Changes

### 1.1 New table: `recurring_streams`

```sql
CREATE TABLE recurring_streams (
  id            TEXT PRIMARY KEY,               -- Plaid stream_id
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,                  -- merchant / payee name
  merchant_name TEXT,
  category      TEXT,                           -- Plaid PFC primary category
  frequency     TEXT NOT NULL,                  -- "WEEKLY"|"BIWEEKLY"|"SEMI_MONTHLY"|"MONTHLY"|"ANNUALLY"
  average_amount NUMERIC(14,2) NOT NULL,        -- Plaid average_amount (positive = outflow)
  last_date     DATE,                           -- date of last confirmed occurrence
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_bill       BOOLEAN NOT NULL DEFAULT TRUE,  -- user-facing "bill" toggle; default TRUE for bill PFC cats
  status        TEXT NOT NULL DEFAULT 'mature', -- Plaid status: "mature"|"early_detection"|"unknown"
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX recurring_streams_active ON recurring_streams (is_active, is_bill);
```

**Drizzle migration:** generate via `drizzle-kit generate`, file in `drizzle/`. Seed: no seed rows; populated by Plaid sync.

**Default `is_bill = true`** for streams whose `category` matches any of: `RENT_AND_UTILITIES`, `LOAN_PAYMENTS`, `INSURANCE`. All other PFC primary categories default `is_bill = false` and appear on Recurring screen as non-bill streams (visible but excluded from Bills card). A future category-rules pass can make this user-configurable.

### 1.2 `app/api/budgets/route.ts` — timezone fix

Replace the UTC-based `currentMonthFirstDay()` helper with a call to `currentNYMonth()` imported from `@/domain/metrics`, then format as `YYYY-MM-01`. This closes the 8pm–midnight ET month-attribution drift confirmed in the bug report.

```ts
// Before (UTC):
function currentMonthFirstDay(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,'0')}-01`;
}

// After (NY):
import { currentNYMonth } from "@/domain/metrics";
function currentMonthFirstDay(): string {
  return `${currentNYMonth()}-01`;
}
```

---

## 2. `computeBudgetStatusV2` — Exact Formulas

**Location:** `src/domain/metrics.ts` (new pure function, replaces `computeBudgetStatus` for Budget screen; old function retained for backward compat until callers are migrated).

### 2.1 Input interface

```ts
interface BudgetComputeInputV2 {
  budgetedTotal: number;             // SUM(budget.amount) for categories this month; 0 if none set
  flexibleSpentThisMonth: number;    // expense outflow in non-bill-stream categories this month
  billsTotal: number;                // SUM(stream.average_amount) for active bill streams
  billsPaidThisMonth: number;        // SUM(t.amount) for bill-stream transactions matched this month
  estimatedIncome: number;           // from getMonthlyIncomeEstimate (override or 3-mo avg)
  earnedThisMonth: number;           // income group inflow this month (positive)
  savingsTarget: number;
  past30dAvgFlexiblePerDay: number;  // trailing-30-day flexible expense ÷ 30 (bills excluded)
  daysRemaining: number;             // daysRemainingInMonth(month, todayNY) — always ≥ 1
  usingOverride: boolean;
}
```

### 2.2 Output interface

```ts
interface BudgetComputeOutputV2 {
  leftToSpend: number;        // budgetedTotal − flexibleSpentThisMonth (may be < 0)
  safeToSpendPerDay: number;  // leftToSpend ÷ daysRemaining — NOT capped (product decision 1B)
  spendPct: number;           // flexibleSpentThisMonth / budgetedTotal — capped at 1.0 for bar
  billsLeftToPay: number;     // MAX(0, billsTotal − billsPaidThisMonth)
  billsPct: number;           // billsPaidThisMonth / billsTotal — capped at 1.0
  projectedFlexibleSpend: number;  // flexibleSpentThisMonth + (past30dAvgFlexiblePerDay × daysRemaining)
  projectedTotalSpend: number;     // billsTotal + projectedFlexibleSpend
  projectedSavings: number;        // estimatedIncome − projectedTotalSpend
  savingsStatus: "on_track" | "at_risk";
  advicePerDay: number;       // (estimatedIncome − savingsTarget − flexibleSpentThisMonth − billsLeftToPay) ÷ daysRemaining
  savingsBarPct: number;      // CLAMP(projectedSavings / savingsTarget, 0, 1) — for bar height
  noBudgets: boolean;         // budgetedTotal === 0 → Spending card uses v1 fallback
  noIncomeData: boolean;      // estimatedIncome === 0 && !usingOverride
}
```

### 2.3 Computation steps (pseudo-code, in order)

```
noBudgets        = budgetedTotal === 0
noIncomeData     = estimatedIncome === 0 && !usingOverride

// Spending card (v2 model; fallback to v1 when noBudgets)
leftToSpend      = noBudgets
                   ? estimatedIncome - savingsTarget - flexibleSpentThisMonth
                   : budgetedTotal - flexibleSpentThisMonth
safeToSpendPerDay = leftToSpend / daysRemaining   // NOT capped

spendPct         = budgetedTotal > 0
                   ? MIN(flexibleSpentThisMonth / budgetedTotal, 1.0)
                   : 0

// Bills card
billsLeftToPay   = MAX(0, billsTotal - billsPaidThisMonth)
billsPct         = billsTotal > 0
                   ? MIN(billsPaidThisMonth / billsTotal, 1.0)
                   : 1.0

// Savings projection
projectedFlexibleSpend = flexibleSpentThisMonth + (past30dAvgFlexiblePerDay × daysRemaining)
projectedTotalSpend    = billsTotal + projectedFlexibleSpend
projectedSavings       = estimatedIncome - projectedTotalSpend
savingsStatus          = projectedSavings >= savingsTarget ? "on_track" : "at_risk"
savingsBarPct          = CLAMP(savingsTarget > 0 ? projectedSavings / savingsTarget : 0, 0, 1)
advicePerDay           = (estimatedIncome - savingsTarget - flexibleSpentThisMonth - billsLeftToPay) / daysRemaining
```

### 2.4 Sign conventions

- All monetary values in natural dollars (positive = money). `leftToSpend` and `projectedSavings` may be negative; do not clamp.
- `safeToSpendPerDay` and `advicePerDay` may be negative; display red via existing `Amount` component `variant="auto"`.
- `past30dAvgFlexiblePerDay` query must exclude transactions matched to any `recurring_streams` row (via a `NOT EXISTS` sub-select or LEFT JOIN IS NULL).

---

## 3. API Contracts

### 3.1 `GET /api/budget-status?month=YYYY-MM` (changed)

Returns the full v2 `BudgetStatusV2Result`. Internally calls `getBudgetStatusV2(month)` (new composite in `metrics.ts`). Response shape mirrors `BudgetStatusResult` but adds: `budgetedTotal`, `flexibleSpentThisMonth`, `billsTotal`, `billsPaidThisMonth`, `earnedThisMonth`, `projectedSavings`, `savingsStatus`, `advicePerDay`, `noBudgets`. The existing `/budget` page props should be updated to consume this shape.

Auth-gated (session check). Revalidates on POST to `/api/budgets` and after Plaid sync.

### 3.2 `GET /api/recurring?month=YYYY-MM` (new)

Returns `RecurringMonthResult`: `{ leftToPay: string, paidSoFar: string, upcoming: RecurringItem[], paid: RecurringItem[] }`.

`RecurringItem`: `{ streamId, name, icon: string (lucide name), dueDate: string|null, paidDate: string|null, amount: string }`.

**Derivation logic (in `metrics.ts`):**
- "paid" = active bill streams where a transaction with `amount ≈ stream.average_amount` (within ±20%) exists in the current month window (date >= monthStart AND date < monthEnd) and `t.category_id` or merchant matches stream.
- "upcoming" = active bill streams not in the "paid" set.
- Sort upcoming by `last_date + frequency_offset` (next expected date) ascending. Sort paid by matched transaction date descending.

Auth-gated. Runtime: nodejs.

### 3.3 `POST /api/recurring/sync` (new — internal, called by cron)

Triggers `plaidClient.transactionsRecurringGet` for all active items, upserts `recurring_streams` rows (on conflict `id` → update all mutable fields). Not exposed to the client directly; called from the existing sync cron path in `app/api/sync/route.ts` (or equivalent cron handler). Auth-gated via a shared `CRON_SECRET` check (matching existing cron pattern in `vercel.json`).

### 3.4 `GET /api/budgets` (changed — timezone fix only)

No response shape change. Internal `currentMonthFirstDay()` is replaced as described in §1.2.

---

## 4. Plaid Recurring Integration

### 4.1 Product enablement

Add `Products.Transactions` already present. To use `transactionsRecurringGet`, no additional product is required — it operates on existing transaction data. However, the endpoint is only available for items that have completed at least one `transactions/sync`. Confirm this in the Plaid dashboard under "Enabled products" for the sandbox environment.

### 4.2 Sync flow

1. During the existing cron job (`vercel.json` schedule), after `transactions/sync` completes for an item, call `plaidClient.transactionsRecurringGet({ access_token })`.
2. Merge returned `outflow_streams` and `inflow_streams`. Mark `is_bill` default per §1.1 category rules.
3. Upsert into `recurring_streams` via Drizzle `insert().onConflictDoUpdate()`.
4. Do NOT add a separate cron entry — piggyback the existing one.

### 4.3 Sandbox testing

Set `PLAID_ENV=sandbox` in `.env.local`. Sandbox returns deterministic recurring streams. Test with `plaid-node` sandbox institution (`ins_109508`). Use the existing `src/lib/plaid.ts` client — no changes needed.

### 4.4 Heuristic fallback

If `transactionsRecurringGet` returns an empty array or throws (e.g., product not enabled in production), catch the error, log via `errInfo()`, and treat as zero streams. The Bills card shows `$0` and Recurring screen shows the EmptyState. Do not surface the error to the user.

---

## 5. Design Tokens & Typography

### 5.1 DM Sans self-hosting

Copy the 4 woff2 files from `Downloads/Financify UI Redesign/_ds/credence-design-system-*/` to `public/fonts/`. Add `@font-face` declarations in `app/globals.css` (before existing `@theme`). Remove the Google Fonts `<link rel="preconnect">` and `<link rel="stylesheet">` from the prototype — those are prototype-only and must NOT appear in the production app (PWA self-contained constraint).

```css
@font-face {
  font-family: 'DM Sans';
  src: url('/fonts/DMSans-Regular.woff2') format('woff2');
  font-weight: 400; font-style: normal; font-display: swap;
}
/* repeat for 500, 600, 700 weights */
```

Update `globals.css` `font-family` fallback stack to `'DM Sans', system-ui, sans-serif`.

### 5.2 Design token deltas (`globals.css @theme`)

| Token | Current | New / Confirm |
|---|---|---|
| `--color-canvas` | `#0b0e14` | Unchanged (PWA splash constraint — do NOT change) |
| `--color-surface` | `#151a23` | Unchanged |
| `--color-surface-2` | `#1d2430` | Unchanged |
| `--color-border` | `#232b38` | Unchanged |
| `--color-text` | `#f2f4f8` | Unchanged |
| `--color-text-muted` | `#8b93a3` | Unchanged |
| `--color-accent` | `#6c8cff` | Unchanged |
| `--color-positive` | `#36c98e` | Unchanged |
| `--color-negative` | `#ff6b6b` | Unchanged |
| `--color-tab-bar-bg` | n/a | Add: `#0e121a` |
| `--color-chip-green-bg` | n/a | Add: `rgba(54,201,142,0.16)` |
| `--color-chip-green-fg` | n/a | Add: `#7fe0b8` |
| `--color-savings-bar` | n/a | Add: `#aebcf5` |
| `--color-dashed-line` | n/a | Add: `#3a4356` |
| `--radius-card` | varies | Standardize: `16px` (large cards), `14px` (pill/month tiles) |

### 5.3 Typography constants (apply via Tailwind classes or inline)

- Screen title: `28px / 700 / letter-spacing: -0.5px` — use `text-[28px] font-bold tracking-[-0.5px]`
- Section header: `12px / 700 / letter-spacing: 1.2px / uppercase / muted` — use `text-xs font-bold tracking-[1.2px] uppercase text-[var(--color-text-muted)]`
- Card body: `15px / 600` for names; `24px / 700 / -0.5px` for card headlines; `34px / 700 / -1px` for projected savings big number

---

## 6. Error Handling & Security

- All new API routes (`/api/recurring`, `/api/recurring/sync`) must begin with `const session = await auth(); if (!session) return NextResponse.json(...)` — same pattern as existing routes.
- Plaid errors in recurring sync: wrap in `try/catch`, log `errInfo(err)` only (never log raw axios error or access_token). Return `{ error: "sync_failed" }` with 500.
- `transactionsRecurringGet` response: validate that returned objects have `stream_id` before upsert; skip malformed rows with a `console.warn(errInfo(e))`.
- Transfer-group exclusion: the `flexibleSpentThisMonth` query must apply `c.group = 'expense' AND t.is_excluded = false AND t.amount > 0` — same guards as existing spend queries.
- Pending transactions: included in `flexibleSpentThisMonth` (FR-033 preserved). Bill-stream matching also considers pending transactions as "paid" for the current-month view.
- No materialized views, no client-side aggregation (FR-032). All new numbers computed in `src/domain/metrics.ts`.

---

## 7. Component Reuse Map

| New UI element | Reuse from |
|---|---|
| Budget month chevron pills | Adapt `MonthPicker` from `/spending` screen |
| Spending / Bills progress bars | Plain `<div>` bars (no new component needed) |
| Day chip | New inline element; green chip color tokens from §5.2 |
| Category budget rows | Adapt existing `CategoryBreakdownRow` + `budgets` data |
| Dashboard donut | Plain SVG (prototype pattern); replace/wrap `CategoryDonut` |
| Dashboard bar chart | Plain SVG bars; adapt `MonthlySpendBarChart` |
| Dashboard balance area | Plain SVG path (prototype pattern) |
| Recurring list rows | New `RecurringItem` component (client island for icon) |
| Settings institution rows | Extract from existing `/accounts` page |
| Tab bar (4 tabs) | Rewrite `TabBar.tsx`; remove compact Settings tab |
| SyncStatusPill | Unchanged; appears on Budget and Dashboard headers |
