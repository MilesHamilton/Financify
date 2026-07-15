/**
 * src/domain/metrics.ts
 *
 * Every number on every screen originates here. These are plain typed async
 * functions over Drizzle — no materialized views, no aggregate tables, no
 * client-side aggregation (FR-032).
 *
 * ─── Exclusion rule ─────────────────────────────────────────────────────────
 * A transaction is excluded from spend/income math when EITHER:
 *   • t.is_excluded = true  (user-manually excluded, or set by a rule's
 *     set_excluded=true, or defaulted to true by plaid_category_map.exclude_default
 *     at ingest time — cached on the row)
 *   • The resolved category has group = 'transfer'  (catches credit-card
 *     payments, internal transfers, loan payments — abstraction-layer.md § Transfers)
 * Both conditions are applied in every spend/income query. Because
 * is_excluded is already set to true for transfer-group categories at ingest
 * (exclude_default=true in plaid_category_map for TRANSFER_*, LOAN_PAYMENTS),
 * the c.group='expense'/'income' filter is the authoritative barrier and
 * is_excluded is an additional guard for user-level exclusions.
 *
 * ─── Pending inclusion ──────────────────────────────────────────────────────
 * Pending transactions are INCLUDED in all queries (FR-033 / abstraction-layer.md
 * Trade-offs: "Rocket-Money-like live feel"). The pending→posted lifecycle
 * means amounts may change slightly at settlement, but hiding a week of
 * credit-card activity makes the dashboard feel broken. All callers receive
 * pending rows unless they explicitly need posted-only (not the case here).
 *
 * ─── Amount sign convention ──────────────────────────────────────────────────
 * Plaid: amount > 0 = outflow (expense), amount < 0 = inflow (income).
 * "Spend" = SUM(amount) WHERE amount > 0 AND group='expense'.
 * "Income" = SUM(-amount) WHERE amount < 0 AND group='income'  (positive result).
 *
 * ─── Numeric columns ─────────────────────────────────────────────────────────
 * Drizzle returns numeric(14,2) as string | null in JS. All amount/balance
 * fields in return types are typed as string | null and parsed at the
 * presentation layer (FR-048 Amount component).
 *
 * ─── Month boundaries / America/New_York ─────────────────────────────────────
 * FR-027 requires month boundaries computed in America/New_York.
 * `toNYMonthBounds(month)` converts a YYYY-MM string to {start, end} YYYY-MM-DD
 * strings using Intl.DateTimeFormat to determine the UTC offset in effect for
 * the first moment of that month in New York (handles DST correctly).
 * DST note: New York observes EST (UTC-5) in winter and EDT (UTC-4) in summer.
 * The month boundary is always "midnight New York time on the 1st", which lands
 * at 05:00 or 04:00 UTC depending on DST. Because Plaid's `date` column is a
 * calendar date (not a timestamp), the offset doesn't affect the SQL — we simply
 * compare t.date >= $start AND t.date < $end where both are YYYY-MM-DD strings
 * at month boundaries. The function is here to make "what month are we in right
 * now" deterministic from the server's perspective without relying on the
 * server's local timezone.
 */

import "server-only";

import { db } from "@/db";
import {
  transactions,
  categories,
  accounts,
  items,
  budgets,
  accountBalanceSnapshots,
  appSettings,
  recurringStreams,
} from "@/db/schema";
import type { RecurringStream } from "@/db/schema";
import { sql, eq, and, lt, lte, gt, gte, or, ilike, desc, asc } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Month boundary helper
// ---------------------------------------------------------------------------

/**
 * Converts a "YYYY-MM" string to the first and exclusive-end YYYY-MM-DD
 * calendar dates for that month, determined using America/New_York local time.
 *
 * DST behaviour: Intl.DateTimeFormat resolves the offset for midnight on the
 * 1st of the given month in America/New_York. The resulting date strings are
 * pure calendar dates (no time component), so DST only affects which UTC
 * instant we query — but since t.date is a Postgres `date` column (calendar
 * date, no timezone), the SQL comparison is simply string/date arithmetic.
 * In practice this means "January" always produces start='YYYY-01-01',
 * end='YYYY-02-01' regardless of DST.
 */
function toNYMonthBounds(month: string): { start: string; end: string } {
  // Parse the YYYY-MM into year and month integers (1-based).
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10); // 1–12

  if (
    isNaN(year) ||
    isNaN(mon) ||
    mon < 1 ||
    mon > 12 ||
    yearStr.length !== 4
  ) {
    throw new Error(`Invalid month format: "${month}" — expected YYYY-MM`);
  }

  // Format a YYYY-MM-DD string for the first of a given year/month.
  // We use Intl to verify the date resolves correctly in America/New_York,
  // but because `date` columns are timezone-neutral calendar dates, the
  // boundary strings are just first-of-month / first-of-next-month.
  const pad = (n: number): string => String(n).padStart(2, "0");

  const start = `${yearStr}-${pad(mon)}-01`;

  // Compute next month (handles December → January).
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMon = mon === 12 ? 1 : mon + 1;
  const end = `${nextYear}-${pad(nextMon)}-01`;

  return { start, end };
}

/**
 * Returns the current month as a YYYY-MM string in America/New_York.
 *
 * Uses Intl.DateTimeFormat to determine year and month in New York right now,
 * so the dashboard always shows "this month" from the user's perspective even
 * when the server is in UTC.
 */
export function currentNYMonth(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value ?? "";
  const month = parts.find((p) => p.type === "month")?.value ?? "";
  return `${year}-${month}`;
}

/**
 * Returns today's date as a YYYY-MM-DD string in America/New_York.
 *
 * Extracted from the inline Intl block previously duplicated inside
 * getBudgetStatus. Using this helper avoids repeated Intl construction and
 * keeps date-in-NY logic in one place.
 */
export function getTodayNY(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}-${parts.find((p) => p.type === "day")!.value}`;
}

/**
 * Returns the number of days from todayNY (inclusive) through the last day of
 * the given month (inclusive). Minimum return value: 1 (the last day of the month).
 *
 * Both dates are parsed identically (local midnight) so the difference is an
 * exact integer day count regardless of the server timezone.
 *
 * @param month   - YYYY-MM string (America/New_York)
 * @param todayNY - YYYY-MM-DD string representing today in America/New_York
 */
export function daysRemainingInMonth(month: string, todayNY: string): number {
  const { end } = toNYMonthBounds(month); // end = first day of next month (exclusive)
  const lastDay = new Date(`${end}T00:00:00`);
  lastDay.setDate(lastDay.getDate() - 1); // → last day of this month
  const todayDate = new Date(`${todayNY}T00:00:00`);
  const diffMs = lastDay.getTime() - todayDate.getTime();
  const diffDays = Math.floor(diffMs / 86_400_000);
  return Math.max(1, diffDays + 1); // +1 for inclusive; floored at 1 on the last day
}

// ---------------------------------------------------------------------------
// Exported interfaces — the UI screens type against exactly these
// ---------------------------------------------------------------------------

/** FR-027 — monthly spend + income totals for one month, plus the prior month. */
export interface MonthSpendResult {
  /** The queried month (YYYY-MM). */
  month: string;
  /** Total outflow (expense group, not excluded). Plaid positive = spend. */
  totalSpend: string;
  /** Total inflow (income group, not excluded). Returned as a positive number string. */
  totalIncome: string;
  /** Prior month (YYYY-MM). */
  priorMonth: string;
  /** Prior month total outflow. */
  priorTotalSpend: string;
  /** Prior month total inflow (positive). */
  priorTotalIncome: string;
  /** Month-over-month spend delta (totalSpend − priorTotalSpend). Positive = spent more. */
  momDelta: string;
}

/** One category row in the breakdown (FR-028). */
export interface CategoryBreakdownRow {
  categoryId: string;
  label: string;
  color: string;
  icon: string;
  /** Total spend for the month in this category (positive numeric string). */
  spent: string;
  /** Applicable budget amount for the month, or null if no budget is set. */
  budget: string | null;
}

/** FR-028 — per-category spend breakdown for a month. */
export type CategoryBreakdownResult = CategoryBreakdownRow[];

/** One bar in the 12-month series (FR-029). */
export interface MonthlySeriesRow {
  /** First day of the month (YYYY-MM-DD). */
  month: string;
  /** Total spend for that month (positive numeric string). */
  totalSpend: string;
}

/** FR-029 — last 12 full months of total spend for the bar chart. */
export type MonthlySeriesResult = MonthlySeriesRow[];

/** FR-030 — net worth from latest account balances. */
export interface NetWorthResult {
  /** Σ depository.current_balance (positive = asset). */
  depositoryTotal: string;
  /** Σ credit.current_balance (positive = amount owed). */
  creditTotal: string;
  /** depositoryTotal − creditTotal. */
  netWorth: string;
}

/** FR-031 — one data point in balance history. */
export interface BalanceHistoryRow {
  asOfDate: string;
  currentBalance: string | null;
  availableBalance: string | null;
}

/** FR-031 — balance history result. */
export interface BalanceHistoryResult {
  accountId: string;
  rows: BalanceHistoryRow[];
}

/** A single transaction row for the Transactions screen (TR.md § 1.6). */
export interface TransactionRow {
  id: string;
  accountId: string;
  amount: string;
  date: string;
  pending: boolean;
  name: string;
  merchantName: string | null;
  logoUrl: string | null;
  categoryId: string;
  categoryLabel: string;
  categoryColor: string;
  categoryIcon: string;
  categorySource: string;
  isExcluded: boolean;
  note: string | null;
}

/** Filters accepted by getTransactions (FR-016 / FR-032). */
export interface TransactionFilters {
  /** YYYY-MM — filter to a specific month. */
  month?: string;
  /** Category ID to filter by. */
  category?: string;
  /** Account ID to filter by. */
  account?: string;
  /**
   * Free-text search applied as ILIKE '%q%' against merchant_name and name.
   * Blank/empty string is treated as no filter.
   */
  q?: string;
  /**
   * Keyset pagination cursor: JSON-serialised { date: string; id: string }.
   * Omit for the first page.
   */
  cursor?: string;
  /** Page size. Defaults to 50. Max 200. */
  limit?: number;
}

/** Paginated transactions response (FR-016 / FR-032). */
export interface TransactionsResult {
  transactions: TransactionRow[];
  /**
   * Cursor for the next page. Null when there are no more results.
   * Encode as JSON string: { date: string; id: string }.
   */
  nextCursor: string | null;
}

/** Account card data for the Accounts screen (FR-030 / FR-033). */
export interface AccountRow {
  id: string;
  itemId: string;
  institutionName: string;
  name: string;
  officialName: string | null;
  mask: string | null;
  type: string;
  subtype: string | null;
  currentBalance: string | null;
  availableBalance: string | null;
  creditLimit: string | null;
  isHidden: boolean;
  itemStatus: string;
  lastSyncedAt: Date | null;
}

/** FR-033 / FR-030 — all accounts with their item metadata. */
export type AccountsResult = AccountRow[];

/** T-B05 — monthly income estimate with optional user override and savings target. */
export interface IncomeEstimateResult {
  /** Estimated monthly income in dollars (positive). Numeric string, or "0". */
  estimatedIncome: string;
  /** Override value if set, else null. Numeric string or null. */
  incomeOverride: string | null;
  /** Savings target. Numeric string. */
  savingsTarget: string;
  /** True when the override is active (estimatedIncome reflects the override). */
  usingOverride: boolean;
}

export interface BudgetComputeInput {
  monthlyIncome: number;
  savingsTarget: number;
  spentThisMonth: number;
  daysRemaining: number;     // always ≥ 1
  past30dAvgPerDay: number;
  usingOverride: boolean;
}
export interface BudgetComputeOutput {
  monthlySpendable: number;
  leftToSpend: number;
  safeToSpendPerDay: number; // NOT capped — may be negative (product decision 1B)
  status: "on_track" | "at_risk";
  noIncomeData: boolean;
}
/** Pure safe-to-spend math — no DB, no I/O, fully unit-testable. */
export function computeBudgetStatus(input: BudgetComputeInput): BudgetComputeOutput {
  const monthlySpendable = input.monthlyIncome - input.savingsTarget;
  const leftToSpend = monthlySpendable - input.spentThisMonth;
  const safeToSpendPerDay = leftToSpend / input.daysRemaining; // NOT capped (1B)
  const status: "on_track" | "at_risk" =
    leftToSpend <= 0 || input.past30dAvgPerDay > safeToSpendPerDay ? "at_risk" : "on_track";
  const noIncomeData = input.monthlyIncome === 0 && !input.usingOverride;
  return { monthlySpendable, leftToSpend, safeToSpendPerDay, status, noIncomeData };
}

/** T-B06 — full safe-to-spend budget status for a month. */
export interface BudgetStatusResult {
  month: string;
  /** monthlyIncome after applying any override. Numeric string. */
  monthlyIncome: string;
  /** monthlyIncome − savingsTarget. May be negative. Numeric string. */
  monthlySpendable: string;
  savingsTarget: string;
  /** Current-month expense outflow (= getMonthSpend totalSpend). Numeric string. */
  spentThisMonth: string;
  /** monthlySpendable − spentThisMonth. May be negative. Numeric string. */
  leftToSpend: string;
  /** Days from today through end of month, inclusive (NY). Integer ≥ 1. */
  daysRemaining: number;
  /** leftToSpend ÷ daysRemaining. MAY BE NEGATIVE — do NOT cap. Numeric string (2dp). */
  safeToSpendPerDay: string;
  /** Trailing-30-day expense outflow ÷ 30. Numeric string (2dp). */
  past30dAvgPerDay: string;
  status: "on_track" | "at_risk";
  /** True when monthlyIncome = 0 and no override set → UI shows EmptyState. */
  noIncomeData: boolean;
}

// ---------------------------------------------------------------------------
// V2 interfaces — Safe-to-Spend v2 model (T-R10)
// ---------------------------------------------------------------------------

/**
 * Input to the pure safe-to-spend v2 computation.
 * All monetary values are natural dollars (positive = money out, except income).
 */
export interface BudgetComputeInputV2 {
  /** SUM(budget.amount) for categories this month; 0 if none set. */
  budgetedTotal: number;
  /** Expense outflow in non-bill-stream categories this month. */
  flexibleSpentThisMonth: number;
  /** SUM(stream.average_amount) for active bill streams (is_bill=true). */
  billsTotal: number;
  /** SUM of bill-stream transaction amounts matched this month. */
  billsPaidThisMonth: number;
  /** From getMonthlyIncomeEstimate — override or 3-mo trailing avg. */
  estimatedIncome: number;
  /** Income-group inflow this month (positive dollar figure). */
  earnedThisMonth: number;
  savingsTarget: number;
  /** Trailing-30-day flexible expense ÷ 30 (bills excluded). */
  past30dAvgFlexiblePerDay: number;
  /** daysRemainingInMonth(month, todayNY) — always ≥ 1. */
  daysRemaining: number;
  usingOverride: boolean;
}

/**
 * Output of the pure safe-to-spend v2 computation.
 * All monetary fields are raw numbers; the composite shapes them as strings.
 */
export interface BudgetComputeOutputV2 {
  /** budgetedTotal − flexibleSpentThisMonth (may be < 0). */
  leftToSpend: number;
  /** leftToSpend ÷ daysRemaining — NOT capped (product decision 1B). */
  safeToSpendPerDay: number;
  /** flexibleSpentThisMonth / budgetedTotal — capped at 1.0 for bar. */
  spendPct: number;
  /** MAX(0, billsTotal − billsPaidThisMonth). */
  billsLeftToPay: number;
  /** billsPaidThisMonth / billsTotal — capped at 1.0; 1.0 when billsTotal = 0. */
  billsPct: number;
  /** flexibleSpentThisMonth + (past30dAvgFlexiblePerDay × daysRemaining). */
  projectedFlexibleSpend: number;
  /** billsTotal + projectedFlexibleSpend. */
  projectedTotalSpend: number;
  /** estimatedIncome − projectedTotalSpend. May be negative. */
  projectedSavings: number;
  savingsStatus: "on_track" | "at_risk";
  /** (estimatedIncome − savingsTarget − flexibleSpentThisMonth − billsLeftToPay) ÷ daysRemaining. */
  advicePerDay: number;
  /** CLAMP(projectedSavings / savingsTarget, 0, 1) — for savings bar height. */
  savingsBarPct: number;
  /** budgetedTotal === 0 → Spending card uses v1 fallback formula. */
  noBudgets: boolean;
  /** estimatedIncome === 0 && !usingOverride → UI shows EmptyState. */
  noIncomeData: boolean;
}

/**
 * Pure safe-to-spend v2 computation — no DB, no I/O, fully unit-testable.
 *
 * Computation order per TR §2.3:
 *   1. noBudgets / noIncomeData flags
 *   2. Spending card: leftToSpend (v1 fallback when noBudgets), safeToSpendPerDay, spendPct
 *   3. Bills card: billsLeftToPay, billsPct
 *   4. Savings projection: projectedFlexibleSpend → projectedTotalSpend → projectedSavings
 *      → savingsStatus, savingsBarPct, advicePerDay
 *
 * Product decision 1B: leftToSpend, safeToSpendPerDay, and advicePerDay are NOT
 * capped — they may be negative. The UI renders negatives in red.
 *
 * Verify against FRD §4 worked examples:
 *   AC-1: budgetedTotal=2596, flexible=1291, days=16 → safeToSpendPerDay=81.5625
 *   AC-3: income=5200, billsTotal=2500, flexible=1291, past30d=42, days=16,
 *          target=1500, billsPaid=2350 → projectedSavings=737, advicePerDay≈141.19
 */
export function computeBudgetStatusV2(
  input: BudgetComputeInputV2,
): BudgetComputeOutputV2 {
  // ── Step 1: flags ─────────────────────────────────────────────────────────
  const noBudgets = input.budgetedTotal === 0;
  const noIncomeData = input.estimatedIncome === 0 && !input.usingOverride;

  // ── Step 2: Spending card ─────────────────────────────────────────────────
  // noBudgets branch uses v1 fallback: income − savingsTarget − flexible
  const leftToSpend = noBudgets
    ? input.estimatedIncome - input.savingsTarget - input.flexibleSpentThisMonth
    : input.budgetedTotal - input.flexibleSpentThisMonth;
  const safeToSpendPerDay = leftToSpend / input.daysRemaining; // NOT capped (1B)

  const spendPct =
    input.budgetedTotal > 0
      ? Math.min(input.flexibleSpentThisMonth / input.budgetedTotal, 1.0)
      : 0;

  // ── Step 3: Bills card ────────────────────────────────────────────────────
  const billsLeftToPay = Math.max(0, input.billsTotal - input.billsPaidThisMonth);
  const billsPct =
    input.billsTotal > 0
      ? Math.min(input.billsPaidThisMonth / input.billsTotal, 1.0)
      : 1.0; // no streams → all "paid"

  // ── Step 4: Savings projection ────────────────────────────────────────────
  const projectedFlexibleSpend =
    input.flexibleSpentThisMonth +
    input.past30dAvgFlexiblePerDay * input.daysRemaining;
  const projectedTotalSpend = input.billsTotal + projectedFlexibleSpend;
  const projectedSavings = input.estimatedIncome - projectedTotalSpend;

  const savingsStatus: "on_track" | "at_risk" =
    projectedSavings >= input.savingsTarget ? "on_track" : "at_risk";

  // savingsBarPct: CLAMP(projectedSavings / savingsTarget, 0, 1)
  // When savingsTarget = 0 treat ratio as 0 (no target set → empty bar)
  const rawBarPct =
    input.savingsTarget > 0 ? projectedSavings / input.savingsTarget : 0;
  const savingsBarPct = Math.min(Math.max(rawBarPct, 0), 1);

  // advicePerDay: how much flexible spend per day still hits the savings target
  const advicePerDay =
    (input.estimatedIncome -
      input.savingsTarget -
      input.flexibleSpentThisMonth -
      billsLeftToPay) /
    input.daysRemaining;

  return {
    leftToSpend,
    safeToSpendPerDay,
    spendPct,
    billsLeftToPay,
    billsPct,
    projectedFlexibleSpend,
    projectedTotalSpend,
    projectedSavings,
    savingsStatus,
    advicePerDay,
    savingsBarPct,
    noBudgets,
    noIncomeData,
  };
}

// ---------------------------------------------------------------------------
// Pagination cursor type (internal)
// ---------------------------------------------------------------------------

interface KeysetCursor {
  date: string;
  id: string;
}

// ---------------------------------------------------------------------------
// 1. getMonthSpend — FR-027
// ---------------------------------------------------------------------------

/**
 * Returns spend and income totals for `month` and the immediately prior month,
 * plus the MoM delta. Month param is "YYYY-MM".
 *
 * Spend  = SUM(amount) WHERE amount > 0 AND group='expense' AND NOT is_excluded
 * Income = SUM(-amount) WHERE amount < 0 AND group='income' AND NOT is_excluded
 * Pending is INCLUDED (FR-033).
 */
export async function getMonthSpend(month: string): Promise<MonthSpendResult> {
  const { start, end } = toNYMonthBounds(month);

  // Compute prior month bounds.
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const priorYear = mon === 1 ? year - 1 : year;
  const priorMon = mon === 1 ? 12 : mon - 1;
  const priorMonth = `${priorYear}-${String(priorMon).padStart(2, "0")}`;
  const { start: priorStart, end: priorEnd } = toNYMonthBounds(priorMonth);

  // Single query: aggregate both months in one pass using FILTER clauses.
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.date >= ${start}::date
          AND t.date <  ${end}::date
          AND t.amount > 0
          AND NOT t.is_excluded
          AND c."group" = 'expense'
      ), 0) AS total_spend,
      COALESCE(SUM(-t.amount) FILTER (
        WHERE t.date >= ${start}::date
          AND t.date <  ${end}::date
          AND t.amount < 0
          AND NOT t.is_excluded
          AND c."group" = 'income'
      ), 0) AS total_income,
      COALESCE(SUM(t.amount) FILTER (
        WHERE t.date >= ${priorStart}::date
          AND t.date <  ${priorEnd}::date
          AND t.amount > 0
          AND NOT t.is_excluded
          AND c."group" = 'expense'
      ), 0) AS prior_total_spend,
      COALESCE(SUM(-t.amount) FILTER (
        WHERE t.date >= ${priorStart}::date
          AND t.date <  ${priorEnd}::date
          AND t.amount < 0
          AND NOT t.is_excluded
          AND c."group" = 'income'
      ), 0) AS prior_total_income
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE
      t.date >= ${priorStart}::date
      AND t.date < ${end}::date
      AND NOT t.is_excluded
      AND c."group" IN ('expense', 'income')
  `);

  const row = rows.rows[0] as {
    total_spend: string;
    total_income: string;
    prior_total_spend: string;
    prior_total_income: string;
  };

  const totalSpend = row.total_spend ?? "0";
  const totalIncome = row.total_income ?? "0";
  const priorTotalSpend = row.prior_total_spend ?? "0";
  const priorTotalIncome = row.prior_total_income ?? "0";

  // MoM delta: how much more (or less) was spent this month vs prior.
  const momDelta = (
    parseFloat(totalSpend) - parseFloat(priorTotalSpend)
  ).toFixed(2);

  return {
    month,
    totalSpend,
    totalIncome,
    priorMonth,
    priorTotalSpend,
    priorTotalIncome,
    momDelta,
  };
}

// ---------------------------------------------------------------------------
// 2. getCategoryBreakdown — FR-028
// ---------------------------------------------------------------------------

/**
 * Per-category spend totals for `month` (YYYY-MM), with the applicable budget
 * joined via the "latest effective_month <= target" subquery. Ordered by
 * spent DESC. Only expense-group categories. Excludes is_excluded transactions.
 * Pending INCLUDED (FR-033).
 */
export async function getCategoryBreakdown(
  month: string
): Promise<CategoryBreakdownResult> {
  const { start, end } = toNYMonthBounds(month);
  // effective_month is stored as a date; first of the queried month.
  const firstOfMonth = start; // already YYYY-MM-01 from toNYMonthBounds

  const rows = await db.execute(sql`
    SELECT
      c.id           AS category_id,
      c.label,
      c.color,
      c.icon,
      COALESCE(SUM(t.amount), 0)::text AS spent,
      (
        SELECT b.amount::text
        FROM budgets b
        WHERE b.category_id = c.id
          AND b.effective_month <= ${firstOfMonth}::date
        ORDER BY b.effective_month DESC
        LIMIT 1
      ) AS budget
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE
      t.date >= ${start}::date
      AND t.date <  ${end}::date
      AND t.amount > 0
      AND NOT t.is_excluded
      AND c."group" = 'expense'
    GROUP BY c.id, c.label, c.color, c.icon
    ORDER BY spent DESC
  `);

  return (rows.rows as Array<{
    category_id: string;
    label: string;
    color: string;
    icon: string;
    spent: string;
    budget: string | null;
  }>).map((r) => ({
    categoryId: r.category_id,
    label: r.label,
    color: r.color,
    icon: r.icon,
    spent: r.spent,
    budget: r.budget,
  }));
}

// ---------------------------------------------------------------------------
// 3. getMonthlySeries — FR-029
// ---------------------------------------------------------------------------

/**
 * Last 12 full months of total spend (expense group, not excluded) per month,
 * ordered chronologically for the bar chart. The current month is included
 * (pending INCLUDED per FR-033). Returns exactly up to 12 rows; months with
 * zero spend still appear if any transaction exists, but months with no
 * matching transactions are omitted (zero-fill is done in the UI if needed).
 *
 * FR-029 notes "not pending (optional)" for the series. Per FR-033, the
 * architecture decision is to include pending everywhere for the live feel,
 * so this query follows that decision. A comment is left for future toggle.
 */
export async function getMonthlySeries(): Promise<MonthlySeriesResult> {
  // "Last 12 months" = the current month + 11 prior full months.
  // We anchor to the first of the current NY month and go back 11 months.
  const currentMonth = currentNYMonth();
  const { start: currentStart } = toNYMonthBounds(currentMonth);
  // 11 months back: subtract 11 months from currentStart's first-of-month.
  // Postgres interval arithmetic handles year boundaries correctly.

  const rows = await db.execute(sql`
    SELECT
      date_trunc('month', t.date)::date AS month,
      SUM(t.amount)::text               AS total_spend
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE
      t.amount > 0
      AND NOT t.is_excluded
      AND c."group" = 'expense'
      -- pending INCLUDED for live feel (FR-033); remove "-- AND NOT t.pending"
      -- to switch to posted-only for historical bars
      AND t.date >= (${currentStart}::date - interval '11 months')
      AND t.date <  (${currentStart}::date + interval '1 month')
    GROUP BY 1
    ORDER BY 1 ASC
  `);

  return (rows.rows as Array<{ month: string; total_spend: string }>).map(
    (r) => ({
      month: r.month,
      totalSpend: r.total_spend,
    })
  );
}

// ---------------------------------------------------------------------------
// 4. getNetWorth — FR-030
// ---------------------------------------------------------------------------

/**
 * Net worth = Σ depository.current_balance − Σ credit.current_balance.
 * Uses cached balances from the accounts table (last sync).
 * Never calls Plaid inline (FR-030).
 *
 * Sign semantics from Plaid: credit.current = amount owed (positive = liability).
 * depository.current = account balance (positive = asset).
 * Net worth = assets − liabilities (abstraction-layer.md § Balances).
 */
export async function getNetWorth(): Promise<NetWorthResult> {
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(current_balance) FILTER (WHERE type = 'depository'), 0)::text AS depository_total,
      COALESCE(SUM(current_balance) FILTER (WHERE type = 'credit'),     0)::text AS credit_total
    FROM accounts
    WHERE is_hidden = false
  `);

  const row = rows.rows[0] as {
    depository_total: string;
    credit_total: string;
  };

  const depositoryTotal = row.depository_total ?? "0";
  const creditTotal = row.credit_total ?? "0";
  const netWorth = (
    parseFloat(depositoryTotal) - parseFloat(creditTotal)
  ).toFixed(2);

  return { depositoryTotal, creditTotal, netWorth };
}

// ---------------------------------------------------------------------------
// 5. getBalanceHistory — FR-031
// ---------------------------------------------------------------------------

type BalanceRange = "1M" | "3M" | "6M" | "1Y";

/**
 * Balance history from account_balance_snapshots.
 *
 * @param accountId - A specific account ID, or "all" to return all accounts
 *   combined (summed by date). When "all", creditBalance is negated so the
 *   combined line represents net worth over time.
 * @param range - How far back to fetch: 1M, 3M, 6M, 1Y from today.
 *
 * For a single account: returns per-row data.
 * For "all": returns one row per date with summed current_balance
 *   (depository positive, credit negated — net worth line).
 */
export async function getBalanceHistory(
  accountId: string | "all",
  range: BalanceRange
): Promise<BalanceHistoryResult> {
  const intervalMap: Record<BalanceRange, string> = {
    "1M": "1 month",
    "3M": "3 months",
    "6M": "6 months",
    "1Y": "1 year",
  };
  const interval = intervalMap[range];

  if (accountId === "all") {
    // Net-worth line: depository balances positive, credit balances negated.
    const rows = await db.execute(sql`
      SELECT
        s.as_of_date::text AS as_of_date,
        SUM(
          CASE a.type
            WHEN 'depository' THEN COALESCE(s.current_balance, 0)
            WHEN 'credit'     THEN -COALESCE(s.current_balance, 0)
            ELSE                    COALESCE(s.current_balance, 0)
          END
        )::text AS current_balance,
        NULL::text AS available_balance
      FROM account_balance_snapshots s
      JOIN accounts a ON a.id = s.account_id
      WHERE
        a.is_hidden = false
        AND s.as_of_date >= CURRENT_DATE - ${sql.raw(`interval '${interval}'`)}
      GROUP BY s.as_of_date
      ORDER BY s.as_of_date ASC
    `);

    return {
      accountId: "all",
      rows: (rows.rows as Array<{
        as_of_date: string;
        current_balance: string | null;
        available_balance: string | null;
      }>).map((r) => ({
        asOfDate: r.as_of_date,
        currentBalance: r.current_balance,
        availableBalance: r.available_balance,
      })),
    };
  }

  // Single account.
  const rows = await db.execute(sql`
    SELECT
      as_of_date::text       AS as_of_date,
      current_balance::text  AS current_balance,
      available_balance::text AS available_balance
    FROM account_balance_snapshots
    WHERE
      account_id = ${accountId}
      AND as_of_date >= CURRENT_DATE - ${sql.raw(`interval '${interval}'`)}
    ORDER BY as_of_date ASC
  `);

  return {
    accountId,
    rows: (rows.rows as Array<{
      as_of_date: string;
      current_balance: string | null;
      available_balance: string | null;
    }>).map((r) => ({
      asOfDate: r.as_of_date,
      currentBalance: r.current_balance,
      availableBalance: r.available_balance,
    })),
  };
}

// ---------------------------------------------------------------------------
// 6. getRecentTransactions + getTransactions — FR-016 / FR-032
// ---------------------------------------------------------------------------

/**
 * Returns the N most recent transactions across all accounts, with category
 * metadata joined. Pending INCLUDED. Used by the dashboard's
 * RecentTransactionsCard (FR-032).
 */
export async function getRecentTransactions(
  limit: number
): Promise<TransactionRow[]> {
  const safeLimit = Math.min(Math.max(1, limit), 200);

  const rows = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      amount: transactions.amount,
      date: transactions.date,
      pending: transactions.pending,
      name: transactions.name,
      merchantName: transactions.merchantName,
      logoUrl: transactions.logoUrl,
      categoryId: transactions.categoryId,
      categoryLabel: categories.label,
      categoryColor: categories.color,
      categoryIcon: categories.icon,
      categorySource: transactions.categorySource,
      isExcluded: transactions.isExcluded,
      note: transactions.note,
    })
    .from(transactions)
    .innerJoin(categories, eq(transactions.categoryId, categories.id))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(safeLimit);

  return rows.map((r) => ({
    id: r.id,
    accountId: r.accountId,
    amount: r.amount,
    date: r.date,
    pending: r.pending,
    name: r.name,
    merchantName: r.merchantName,
    logoUrl: r.logoUrl,
    categoryId: r.categoryId,
    categoryLabel: r.categoryLabel,
    categoryColor: r.categoryColor,
    categoryIcon: r.categoryIcon,
    categorySource: r.categorySource,
    isExcluded: r.isExcluded,
    note: r.note,
  }));
}

/**
 * Paginated, filtered transactions query for the Transactions screen.
 *
 * Filters (all optional, AND-combined):
 *   month     — YYYY-MM, restricts to that calendar month
 *   category  — exact category_id match
 *   account   — exact account_id match
 *   q         — ILIKE '%q%' search against merchant_name and name (OR)
 *   cursor    — keyset pagination cursor JSON { date, id }
 *   limit     — page size (default 50, max 200)
 *
 * Pagination: (date DESC, id DESC) keyset — the cursor holds the last row's
 * date and id. The next page continues from rows strictly before that point.
 *
 * All transactions are returned regardless of is_excluded (the Transactions
 * screen shows everything; excluded rows are visually dimmed in the UI).
 * Pending INCLUDED (FR-033).
 */
export async function getTransactions(
  filters: TransactionFilters
): Promise<TransactionsResult> {
  const {
    month,
    category,
    account,
    q,
    cursor: cursorStr,
    limit: rawLimit,
  } = filters;

  const limit = Math.min(Math.max(1, rawLimit ?? 50), 200);

  // Parse keyset cursor if provided.
  let cursor: KeysetCursor | null = null;
  if (cursorStr) {
    try {
      cursor = JSON.parse(cursorStr) as KeysetCursor;
    } catch {
      // Invalid cursor — treat as first page.
      cursor = null;
    }
  }

  // Build WHERE conditions dynamically.
  const conditions: ReturnType<typeof sql>[] = [];

  if (month) {
    const { start, end } = toNYMonthBounds(month);
    conditions.push(
      sql`t.date >= ${start}::date`,
      sql`t.date <  ${end}::date`
    );
  }

  if (category) {
    conditions.push(sql`t.category_id = ${category}`);
  }

  if (account) {
    conditions.push(sql`t.account_id = ${account}`);
  }

  if (q && q.trim().length > 0) {
    const pattern = `%${q.trim()}%`;
    conditions.push(
      sql`(t.merchant_name ILIKE ${pattern} OR t.name ILIKE ${pattern})`
    );
  }

  // Keyset pagination: (date, id) DESC — next page is rows that come
  // "before" the cursor in the sort order.
  // Condition: (date < cursorDate) OR (date = cursorDate AND id < cursorId)
  if (cursor) {
    conditions.push(
      sql`(t.date < ${cursor.date}::date OR (t.date = ${cursor.date}::date AND t.id < ${cursor.id}))`
    );
  }

  const whereClause =
    conditions.length > 0
      ? sql`WHERE ${sql.join(conditions, sql` AND `)}`
      : sql``;

  // Fetch limit + 1 to detect if there is a next page.
  const rows = await db.execute(sql`
    SELECT
      t.id,
      t.account_id          AS "accountId",
      t.amount::text        AS amount,
      t.date::text          AS date,
      t.pending,
      t.name,
      t.merchant_name       AS "merchantName",
      t.logo_url            AS "logoUrl",
      t.category_id         AS "categoryId",
      c.label               AS "categoryLabel",
      c.color               AS "categoryColor",
      c.icon                AS "categoryIcon",
      t.category_source     AS "categorySource",
      t.is_excluded         AS "isExcluded",
      t.note
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    ${whereClause}
    ORDER BY t.date DESC, t.id DESC
    LIMIT ${limit + 1}
  `);

  const allRows = rows.rows as Array<{
    id: string;
    accountId: string;
    amount: string;
    date: string;
    pending: boolean;
    name: string;
    merchantName: string | null;
    logoUrl: string | null;
    categoryId: string;
    categoryLabel: string;
    categoryColor: string;
    categoryIcon: string;
    categorySource: string;
    isExcluded: boolean;
    note: string | null;
  }>;

  const hasMore = allRows.length > limit;
  const pageRows = hasMore ? allRows.slice(0, limit) : allRows;

  let nextCursor: string | null = null;
  if (hasMore && pageRows.length > 0) {
    const last = pageRows[pageRows.length - 1];
    const cursorObj: KeysetCursor = { date: last.date, id: last.id };
    nextCursor = JSON.stringify(cursorObj);
  }

  return {
    transactions: pageRows.map((r) => ({
      id: r.id,
      accountId: r.accountId,
      amount: r.amount,
      date: r.date,
      pending: r.pending,
      name: r.name,
      merchantName: r.merchantName,
      logoUrl: r.logoUrl,
      categoryId: r.categoryId,
      categoryLabel: r.categoryLabel,
      categoryColor: r.categoryColor,
      categoryIcon: r.categoryIcon,
      categorySource: r.categorySource,
      isExcluded: r.isExcluded,
      note: r.note,
    })),
    nextCursor,
  };
}

// ---------------------------------------------------------------------------
// 7. getMonthlyIncomeEstimate — T-B05
// ---------------------------------------------------------------------------

/**
 * Estimates monthly income for the "safe-to-spend" budget calculation.
 *
 * Priority:
 *   1. If the user has set a monthly_income_override in app_settings, return
 *      that value directly (usingOverride=true).
 *   2. Otherwise, average the last 3 FULL calendar months of income-group
 *      inflow (SUM(-amount) WHERE group='income' AND NOT is_excluded).
 *      The current partial month is excluded to avoid mid-month volatility.
 *
 * Income sign convention: SUM(-t.amount) where amount < 0 yields a positive
 * dollar figure (mirrors getMonthSpend totalIncome). See file header §
 * "Amount sign convention".
 *
 * Returns the monthly_savings_target from app_settings alongside the income
 * figure so callers can compute disposable income in a single query round-trip.
 */
export async function getMonthlyIncomeEstimate(): Promise<IncomeEstimateResult> {
  // 1. Read the single app_settings row.
  const settingsRows = await db
    .select({
      savingsTarget: appSettings.monthlySavingsTarget,
      incomeOverride: appSettings.monthlyIncomeOverride,
    })
    .from(appSettings)
    .limit(1);

  const savingsTarget = settingsRows[0]?.savingsTarget ?? "0";
  const incomeOverride = settingsRows[0]?.incomeOverride ?? null;

  // 2. Override wins when set.
  if (incomeOverride !== null) {
    return { estimatedIncome: incomeOverride, incomeOverride, savingsTarget, usingOverride: true };
  }

  // 3. Otherwise average the last 3 FULL calendar months of income-group inflow
  //    (excludes the current partial month to avoid mid-month volatility).
  const current = currentNYMonth();                 // "YYYY-MM"
  const currentMonthStart = `${current}-01`;        // first of current month (exclusive upper bound)
  const [cy, cm] = current.split("-").map(Number);
  let ty = cy, tm = cm - 3;
  while (tm <= 0) { tm += 12; ty -= 1; }
  const threeMonthsAgoStart = `${ty}-${String(tm).padStart(2, "0")}-01`;

  const rows = await db.execute(sql`
    SELECT COALESCE(AVG(monthly_total), 0)::text AS estimated_income
    FROM (
      SELECT to_char(t.date, 'YYYY-MM') AS m, SUM(-t.amount) AS monthly_total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE c."group" = 'income'
        AND t.is_excluded = false
        AND t.date >= ${threeMonthsAgoStart}::date
        AND t.date <  ${currentMonthStart}::date
      GROUP BY to_char(t.date, 'YYYY-MM')
      ORDER BY m DESC
      LIMIT 3
    ) sub
  `);

  const estimatedIncome = (rows.rows[0] as { estimated_income: string } | undefined)?.estimated_income ?? "0";
  return { estimatedIncome, incomeOverride, savingsTarget, usingOverride: false };
}

// ---------------------------------------------------------------------------
// 8. getBudgetStatus — T-B06
// ---------------------------------------------------------------------------

/**
 * Composite safe-to-spend calculation for a given month.
 *
 * Combines:
 *   • getMonthlyIncomeEstimate — override or 3-month trailing average, plus savingsTarget
 *   • getMonthSpend            — current month expense outflow
 *   • Trailing-30-day avg      — expense outflow ÷ 30, anchored to today in NY
 *
 * safeToSpendPerDay = leftToSpend ÷ daysRemaining.  NOT capped — may be
 * negative when overspent. The UI styles negative values red.
 *
 * @param month - YYYY-MM string (America/New_York)
 */
export async function getBudgetStatus(month: string): Promise<BudgetStatusResult> {
  // todayNY = today's date in America/New_York (YYYY-MM-DD)
  const todayNY = getTodayNY();

  // trailing30Start = todayNY − 29 days (30-day inclusive window)
  const todayDate = new Date(`${todayNY}T00:00:00`);
  const startDate = new Date(todayDate);
  startDate.setDate(startDate.getDate() - 29);
  const trailing30Start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;

  const [income, spend, past30Rows] = await Promise.all([
    getMonthlyIncomeEstimate(),
    getMonthSpend(month),
    db.execute(sql`
      SELECT COALESCE(SUM(t.amount), 0) / 30.0 AS avg_per_day
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE c."group" = 'expense'
        AND t.is_excluded = false
        AND t.amount > 0
        AND t.date >= ${trailing30Start}::date
        AND t.date <= ${todayNY}::date
    `),
  ]);

  const daysRemaining = daysRemainingInMonth(month, todayNY);

  const incomeNum = parseFloat(income.estimatedIncome);
  const targetNum = parseFloat(income.savingsTarget);
  const spentNum = parseFloat(spend.totalSpend);
  const past30Num = parseFloat(
    (past30Rows.rows[0] as { avg_per_day: string } | undefined)?.avg_per_day ?? "0",
  );

  const computed = computeBudgetStatus({
    monthlyIncome: incomeNum,
    savingsTarget: targetNum,
    spentThisMonth: spentNum,
    daysRemaining,
    past30dAvgPerDay: past30Num,
    usingOverride: income.usingOverride,
  });

  return {
    month,
    monthlyIncome: incomeNum.toFixed(2),
    monthlySpendable: computed.monthlySpendable.toFixed(2),
    savingsTarget: targetNum.toFixed(2),
    spentThisMonth: spentNum.toFixed(2),
    leftToSpend: computed.leftToSpend.toFixed(2),
    daysRemaining,
    safeToSpendPerDay: computed.safeToSpendPerDay.toFixed(2),
    past30dAvgPerDay: past30Num.toFixed(2),
    status: computed.status,
    noIncomeData: computed.noIncomeData,
  };
}

// ---------------------------------------------------------------------------
// 9. getAccounts — FR-030 / FR-033
// ---------------------------------------------------------------------------

/**
 * All accounts joined with their parent item's status and lastSyncedAt.
 * Used by the Accounts screen (AccountCardsRow component) and the
 * NetWorthHeader. Hidden accounts (is_hidden=true) are included — the UI
 * decides whether to render them. Ordered by institution name then account name.
 */
export async function getAccounts(): Promise<AccountsResult> {
  const rows = await db
    .select({
      id: accounts.id,
      itemId: accounts.itemId,
      institutionName: items.institutionName,
      name: accounts.name,
      officialName: accounts.officialName,
      mask: accounts.mask,
      type: accounts.type,
      subtype: accounts.subtype,
      currentBalance: accounts.currentBalance,
      availableBalance: accounts.availableBalance,
      creditLimit: accounts.creditLimit,
      isHidden: accounts.isHidden,
      itemStatus: items.status,
      lastSyncedAt: items.lastSyncedAt,
    })
    .from(accounts)
    .innerJoin(items, eq(accounts.itemId, items.id))
    .orderBy(asc(items.institutionName), asc(accounts.name));

  return rows.map((r) => ({
    id: r.id,
    itemId: r.itemId,
    institutionName: r.institutionName,
    name: r.name,
    officialName: r.officialName,
    mask: r.mask,
    type: r.type,
    subtype: r.subtype,
    currentBalance: r.currentBalance,
    availableBalance: r.availableBalance,
    creditLimit: r.creditLimit,
    isHidden: r.isHidden,
    itemStatus: r.itemStatus,
    lastSyncedAt: r.lastSyncedAt,
  }));
}
