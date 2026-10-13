/**
 * src/domain/mobile-helpers.ts
 *
 * Pure, DB-free helpers used by src/domain/mobile*.ts. Kept separate so the
 * non-trivial logic (cumulative series, stream classification, net-worth
 * forward-fill, account grouping, date math) is unit-testable without a DB —
 * see src/domain/mobile-helpers.test.ts.
 */

import type { AccountGroup, Category, StreamKind } from "@/contracts/mobile-api";

// ---------------------------------------------------------------------------
// Date math (string "YYYY-MM-DD" / "YYYY-MM" in, same out — no timezone object
// state is held; callers always pass America/New_York calendar dates).
// ---------------------------------------------------------------------------

/** First-of-month (inclusive) / first-of-next-month (exclusive) for "YYYY-MM". */
export function monthBounds(month: string): { start: string; end: string } {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const nextYear = mon === 12 ? year + 1 : year;
  const nextMon = mon === 12 ? 1 : mon + 1;
  return {
    start: `${yearStr}-${monthStr}-01`,
    end: `${nextYear}-${String(nextMon).padStart(2, "0")}-01`,
  };
}

/** The calendar month immediately before `month` ("YYYY-MM"). */
export function priorMonthOf(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const year = parseInt(yearStr, 10);
  const mon = parseInt(monthStr, 10);
  const priorYear = mon === 1 ? year - 1 : year;
  const priorMon = mon === 1 ? 12 : mon - 1;
  return `${priorYear}-${String(priorMon).padStart(2, "0")}`;
}

/** Adds `delta` calendar days to a "YYYY-MM-DD" string (delta may be negative). */
export function addDays(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return toDateString(d);
}

/** Adds `delta` calendar months to a "YYYY-MM-DD" string (delta may be negative). */
export function addMonths(dateStr: string, delta: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setMonth(d.getMonth() + delta);
  return toDateString(d);
}

function toDateString(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

// ---------------------------------------------------------------------------
// Cumulative daily spend series (DailySpend) — dashboard + spending screens
// ---------------------------------------------------------------------------

/** Running total of a day-indexed amount array (index 0 = day 1). */
export function cumulativeFromDailyTotals(dailyTotals: number[]): number[] {
  const out: number[] = [];
  let running = 0;
  for (const v of dailyTotals) {
    running += v;
    out.push(running);
  }
  return out;
}

/** Builds a zero-filled day-of-month array for `month`, filled from `dailyTotals`. */
export function daysArrayForMonth(
  month: string,
  dailyTotals: Map<string, number>,
): number[] {
  const [y, m] = month.split("-").map(Number);
  const numDays = new Date(y, m, 0).getDate(); // last day of `month`
  const arr: number[] = [];
  for (let d = 1; d <= numDays; d++) {
    const dateStr = `${month}-${String(d).padStart(2, "0")}`;
    arr.push(dailyTotals.get(dateStr) ?? 0);
  }
  return arr;
}

/**
 * The last day-of-month index (1-based) `current` should stop at: "today" when
 * `month` is the current NY month, otherwise the full length of that month
 * (past months render their complete curve; there is no "today" inside them).
 */
export function resolveStopDay(month: string, todayNY: string): number {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  if (month === todayNY.slice(0, 7)) {
    return parseInt(todayNY.slice(8, 10), 10);
  }
  return daysInMonth;
}

export interface DailySpendResult {
  current: number[];
  prior: number[];
}

/**
 * Builds the dashboard/spending `daily` field: cumulative spend-to-date for
 * `month` (truncated at `stopDay`) and the full cumulative curve for the
 * immediately prior month.
 */
export function buildDailySpend(
  dailyTotals: Map<string, number>,
  month: string,
  priorMonth: string,
  stopDay: number,
): DailySpendResult {
  const currentDays = daysArrayForMonth(month, dailyTotals).slice(0, stopDay);
  const priorDays = daysArrayForMonth(priorMonth, dailyTotals);
  return {
    current: cumulativeFromDailyTotals(currentDays),
    prior: cumulativeFromDailyTotals(priorDays),
  };
}

/** Last month's cumulative spend through the same day-of-month as `stopDay`. */
export function spendPriorToDate(priorCumulative: number[], stopDay: number): number {
  if (priorCumulative.length === 0) return 0;
  const idx = Math.min(stopDay, priorCumulative.length) - 1;
  return priorCumulative[idx];
}

// ---------------------------------------------------------------------------
// Account grouping
// ---------------------------------------------------------------------------

/**
 * Coarse Plaid type/subtype → UI AccountGroup mapping.
 * shortcut: only the common depository subtype (savings) is special-cased;
 * money market/CD/prepaid/HSA all fall into "checking". Upgrade if the
 * product wants a dedicated group for those.
 */
export function mapAccountGroup(type: string, subtype: string | null): AccountGroup {
  switch (type) {
    case "depository":
      return subtype === "savings" ? "savings" : "checking";
    case "credit":
      return "credit";
    case "loan":
      return "loan";
    case "investment":
      return "investment";
    default:
      return "other";
  }
}

// ---------------------------------------------------------------------------
// Recurring stream kind classification
// ---------------------------------------------------------------------------

// Simple PFC-primary heuristic (documented here, not exhaustive):
//   LOAN_PAYMENTS                    → credit_card (card/loan payment streams)
//   ENTERTAINMENT, GENERAL_SERVICES  → subscription (digital subs land here)
//   everything else outflow          → bill
const CREDIT_CARD_CATEGORIES = new Set(["LOAN_PAYMENTS"]);
const SUBSCRIPTION_CATEGORIES = new Set(["ENTERTAINMENT", "GENERAL_SERVICES"]);

export interface StreamClassificationInput {
  isActive: boolean;
  /** Signed Plaid amount: positive = outflow, negative = inflow. */
  averageAmount: number;
  category: string | null;
}

/**
 * Priority: inactive wins regardless of direction (its own "Recurring All"
 * group); then direction (inflow → income); then the outflow PFC heuristic.
 */
export function classifyStreamKind(input: StreamClassificationInput): StreamKind {
  if (!input.isActive) return "inactive";
  if (input.averageAmount < 0) return "income";
  if (input.category !== null && CREDIT_CARD_CATEGORIES.has(input.category)) return "credit_card";
  if (input.category !== null && SUBSCRIPTION_CATEGORIES.has(input.category)) return "subscription";
  return "bill";
}

// ---------------------------------------------------------------------------
// Net worth history (carry-forward)
// ---------------------------------------------------------------------------

export interface NetWorthSnapshotRow {
  accountId: string;
  /** Plaid account type: depository/credit/loan/investment/other. */
  type: string;
  asOfDate: string;
  balance: number;
}

export interface NetWorthPoint {
  date: string;
  netWorth: number;
  assets: number;
  debts: number;
}

/**
 * Forward-fills each account's last known balance across `dates` (ascending,
 * deduped by the caller) and aggregates into assets (depository + investment)
 * / debts (credit + loan) per date. Accounts of type "other" are excluded from
 * both totals — their balance sign isn't well-defined.
 *
 * `rows` must be sorted ascending by asOfDate per account (the DB query does
 * this via ORDER BY account_id, as_of_date).
 */
export function buildNetWorthHistory(
  rows: NetWorthSnapshotRow[],
  dates: string[],
): NetWorthPoint[] {
  const byAccount = new Map<string, { type: string; points: NetWorthSnapshotRow[] }>();
  for (const r of rows) {
    const entry = byAccount.get(r.accountId);
    if (entry) entry.points.push(r);
    else byAccount.set(r.accountId, { type: r.type, points: [r] });
  }

  const pointer = new Map<string, number>();
  for (const id of byAccount.keys()) pointer.set(id, -1);

  const sortedDates = [...dates].sort();
  return sortedDates.map((date) => {
    let assets = 0;
    let debts = 0;
    for (const [accountId, { type, points }] of byAccount) {
      let ptr = pointer.get(accountId)!;
      while (ptr + 1 < points.length && points[ptr + 1].asOfDate <= date) ptr++;
      pointer.set(accountId, ptr);
      if (ptr < 0) continue; // no balance known yet as of this date
      const balance = points[ptr].balance;
      if (type === "depository" || type === "investment") assets += balance;
      else if (type === "credit" || type === "loan") debts += balance;
    }
    return { date, netWorth: assets - debts, assets, debts };
  });
}

// ---------------------------------------------------------------------------
// Minimal shared row/category shapes used across mobile.ts, mobile-recurring.ts
// ---------------------------------------------------------------------------

/** Builds an id → Category lookup map from raw category rows. */
export function buildCategoryMap(
  rows: Array<{ id: string; label: string; color: string; icon: string; group: string }>,
): Map<string, Category> {
  const map = new Map<string, Category>();
  for (const r of rows) {
    map.set(r.id, { id: r.id, label: r.label, color: r.color, icon: r.icon, group: r.group });
  }
  return map;
}
