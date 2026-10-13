/**
 * JSON contract between the Next.js API (app/api/mobile/*) and the iOS app (mobile/).
 * Types only — the app imports this with `import type`, so nothing here may have runtime code.
 *
 * Conventions:
 * - Money is a JS number in dollars. Spend/outflow is POSITIVE, income/inflow is NEGATIVE
 *   (Plaid's sign), except where a field name says otherwise (e.g. `income` totals are positive).
 * - Dates are "YYYY-MM-DD", months "YYYY-MM", timestamps ISO strings. "Today" is America/New_York.
 * - Every route requires `Authorization: Bearer <token>` (see src/lib/api-auth.ts).
 */

export interface Category {
  id: string;
  label: string;
  /** Hex color. */
  color: string;
  /** Lucide icon name, PascalCase or kebab (client normalises). */
  icon: string;
  group: string;
}

export interface Txn {
  id: string;
  accountId: string;
  accountName: string;
  amount: number;
  date: string;
  pending: boolean;
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  category: Category;
  isExcluded: boolean;
  note: string | null;
}

export type AccountGroup =
  | 'checking'
  | 'savings'
  | 'credit'
  | 'investment'
  | 'loan'
  | 'other';

export interface AccountSummary {
  id: string;
  itemId: string;
  name: string;
  institutionName: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  group: AccountGroup;
  /** Current balance. For credit/loan this is the amount OWED (positive). */
  balance: number;
  /** "Include in Net Worth" toggle is the inverse of this. */
  isHidden: boolean;
  /** Plaid item status, e.g. "active" | "login_required". */
  itemStatus: string;
  lastSyncedAt: string | null;
}

/** Cumulative spend by day of month: index 0 = day 1. `current` stops at today. */
export interface DailySpend {
  current: number[];
  prior: number[];
}

export interface UpcomingBill {
  streamId: string;
  name: string;
  logoUrl: string | null;
  amount: number;
  dueDate: string;
}

// GET /api/mobile/dashboard
export interface DashboardResponse {
  month: string;
  today: string;
  /** Spend so far this month (positive). */
  spendThisMonth: number;
  /** Last month's spend through the same day of month (positive). */
  spendPriorToDate: number;
  daily: DailySpend;
  /** Sum of category budgets for the month, or null when none set. */
  budgetTotal: number | null;
  /** Next expected income date from inflow recurring streams, or null. */
  nextPayday: string | null;
  accounts: AccountSummary[];
  lastSyncedAt: string | null;
  /** Outflow streams due in the next 30 days, soonest first. */
  upcoming: UpcomingBill[];
  /** 5 most recent transactions. */
  recent: Txn[];
}

// GET /api/mobile/spending?month=YYYY-MM
export interface SpendingResponse {
  month: string;
  /** All positive. net = income - bills - spending. */
  income: number;
  bills: number;
  spending: number;
  net: number;
  daily: DailySpend;
  budgetTotal: number | null;
  categories: Array<Category & { spent: number; budget: number | null }>;
  merchants: Array<{ name: string; logoUrl: string | null; spent: number; count: number }>;
  /** Last 12 months incl. current, oldest first. */
  months: Array<{ month: string; spend: number }>;
}

// GET /api/mobile/transactions?q=&month=&category=&account=&cursor=
export interface TransactionsResponse {
  transactions: Txn[];
  nextCursor: string | null;
}

// GET /api/mobile/categories
export type CategoriesResponse = Category[];

// PATCH /api/transactions/[id]  body: { categoryId?, isExcluded?, note? }  (existing route)

export type StreamKind = 'subscription' | 'bill' | 'credit_card' | 'income' | 'inactive';

export interface RecurringStream {
  id: string;
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  /** Positive magnitude of the average amount. */
  amount: number;
  direction: 'inflow' | 'outflow';
  frequency: 'WEEKLY' | 'BIWEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY' | 'ANNUALLY';
  kind: StreamKind;
  lastDate: string | null;
  nextDate: string | null;
  isActive: boolean;
}

// GET /api/mobile/recurring
export interface RecurringResponse {
  today: string;
  streams: RecurringStream[];
}

// GET /api/mobile/recurring/[id]
export interface RecurringDetailResponse {
  stream: RecurringStream;
  /** Past matching transactions, newest first. */
  history: Txn[];
}

export type NetWorthRange = '1M' | '3M' | '6M' | '1Y' | 'ALL';

// GET /api/mobile/net-worth?range=1M|3M|6M|1Y|ALL
export interface NetWorthResponse {
  range: NetWorthRange;
  netWorth: number;
  assets: number;
  debts: number;
  /** Change in net worth from the first history point to now. pct is null if base is 0. */
  change: { amount: number; pct: number | null };
  /** Oldest first; excludes accounts with isHidden. */
  history: Array<{ date: string; netWorth: number; assets: number; debts: number }>;
  accounts: AccountSummary[];
}

// PATCH /api/mobile/accounts/[id]  body: { isHidden: boolean } → AccountSummary

// POST /api/plaid/link/start → { hosted_link_url }  (existing route)
// POST /api/sync/trigger (existing route)

// GET /api/mobile/daily-spend?month=YYYY-MM  (default: current NY month; future month → 400)
export type DailySpendStatus =
  | 'super_saver' // projected savings ≥ 105 % of target
  | 'on_track' // ≥ 99 % (or no target and projected ≥ 0)
  | 'at_risk' // below 99 %
  | 'over_budget' // flexible spend already exceeds the flexible budget
  | 'no_income'; // no income estimate and no override → allowance unavailable

export interface DailySpendDay {
  /** "YYYY-MM-DD" (America/New_York calendar day). */
  date: string;
  /** 1-based day of month. */
  day: number;
  /** Flexible (non-bill, non-excluded) spend dated this day. 0 for future days. */
  spent: number;
  /** Start-of-day allowance, whole dollars, ≥ 0. Future days carry today's tomorrowAllowance. null when 'no_income'. */
  allowance: number | null;
  /** Running flexible spend through the end of this day. null for days after today. */
  cumulative: number | null;
  /** Ideal straight-line cumulative flexibleBudget × day / daysInMonth. null when 'no_income'. */
  pace: number | null;
  isToday: boolean;
  isFuture: boolean;
}

export interface DailySpendToday {
  date: string;
  /** Days left in the month including today (≥ 1). */
  daysRemaining: number;
  /** Today's allowance, frozen at start of day (whole dollars, ≥ 0). null when 'no_income'. */
  allowance: number | null;
  /** Unclamped, unfloored allowance — negative means already over. */
  allowanceRaw: number | null;
  /** Flexible spend so far today, pending included. */
  spent: number;
  /** allowance − spent; negative = over today's allowance. */
  left: number | null;
  /** What tomorrow's allowance becomes given today's spend so far. null on the last day. */
  tomorrowAllowance: number | null;
  /** Positive amount the month is over the flexible budget, else 0. */
  overBy: number;
}

export interface DailySpendResponse {
  month: string;
  isCurrentMonth: boolean;
  daysInMonth: number;
  plan: {
    income: number;
    usingIncomeOverride: boolean;
    savingsTarget: number;
    /** Monthly-normalised expected bills from active bill streams. */
    billsExpected: number;
    billsPaid: number;
    billsLeftToPay: number;
    /** income − savingsTarget − max(billsExpected, billsPaid). null when 'no_income'. */
    flexibleBudget: number | null;
    /** false when the target plus bills exceed income. */
    isFeasible: boolean;
  };
  totals: {
    flexibleSpent: number;
    /** flexibleBudget − flexibleSpent (may be negative). null when 'no_income'. */
    remaining: number | null;
    /** Trailing-30-day flexible spend ÷ 30. */
    averagePerDay: number;
    /** income − bills − flexibleSpent − averagePerDay × days after today. null when 'no_income'. */
    projectedSavings: number | null;
    /** round(projectedSavings / savingsTarget × 100); null when target is 0 or 'no_income'. */
    percentOfTarget: number | null;
  };
  status: DailySpendStatus;
  /** Ready-to-render hero copy (server-owned). Past months get a budget verdict instead. */
  copy: { title: string; body: string; chip: string };
  /** null for past months. */
  today: DailySpendToday | null;
  /** One entry per calendar day of the month, day 1 … daysInMonth. */
  days: DailySpendDay[];
}
