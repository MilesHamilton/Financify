/**
 * src/domain/mobile.ts
 *
 * Query/orchestration layer for the iOS JSON endpoints (app/api/mobile/*).
 * Reuses src/domain/metrics.ts for all existing spend/income/account/budget
 * math and adds only what the mobile contract (src/contracts/mobile-api.ts)
 * needs on top: cumulative daily series, merchant aggregation, next payday /
 * upcoming bills, and the Txn/AccountSummary shape adapters.
 *
 * Pure (DB-free) logic lives in src/domain/mobile-helpers.ts so it can be
 * unit-tested without a database. Recurring-stream and net-worth endpoints
 * live in sibling files (mobile-recurring.ts, mobile-networth.ts) to keep
 * each file under ~350 lines; both are re-exported here so route handlers
 * only ever import from "@/domain/mobile".
 */

import "server-only";

import { sql, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { accounts, categories, items } from "@/db/schema";
import {
  currentNYMonth,
  getTodayNY,
  getMonthSpend,
  getBudgetStatusV2,
  getCategoryBreakdown,
  getMonthlySeries,
  getRecentTransactions,
  getTransactions,
  getAccounts,
  type TransactionFilters,
} from "@/domain/metrics";
import {
  monthBounds,
  priorMonthOf,
  addDays,
  resolveStopDay,
  buildDailySpend,
  spendPriorToDate,
  mapAccountGroup,
} from "@/domain/mobile-helpers";
import { toTxn, mapAccountSummary, getAccountNameMap, getCategoriesMapAll } from "@/domain/mobile-shared";
import type {
  AccountSummary,
  DashboardResponse,
  SpendingResponse,
  TransactionsResponse,
  CategoriesResponse,
  UpcomingBill,
} from "@/contracts/mobile-api";
import { getAllStreams, mapStreamToContract, getLatestMatchingLogoUrl } from "@/domain/mobile-recurring";

export { getRecurringStreamsData, getRecurringStreamDetailData } from "@/domain/mobile-recurring";
export { getNetWorthData } from "@/domain/mobile-networth";
export { getDailySpendData } from "@/domain/mobile-daily-spend";

// ---------------------------------------------------------------------------
// GET /api/mobile/categories
// ---------------------------------------------------------------------------

export async function getCategoriesData(): Promise<CategoriesResponse> {
  const rows = await db
    .select({
      id: categories.id,
      label: categories.label,
      color: categories.color,
      icon: categories.icon,
      group: categories.group,
    })
    .from(categories)
    .where(eq(categories.isArchived, false))
    .orderBy(asc(categories.sortOrder));
  return rows;
}

// ---------------------------------------------------------------------------
// Daily spend series + merchant aggregation (shared by dashboard + spending)
// ---------------------------------------------------------------------------

async function getDailyTotalsRange(
  priorMonth: string,
  month: string,
): Promise<Map<string, number>> {
  const { start } = monthBounds(priorMonth);
  const { end } = monthBounds(month);
  const rows = await db.execute(sql`
    SELECT t.date::text AS date, SUM(t.amount)::text AS total
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.date >= ${start}::date
      AND t.date <  ${end}::date
      AND t.amount > 0
      AND NOT t.is_excluded
      AND c."group" = 'expense'
    GROUP BY t.date
  `);
  const map = new Map<string, number>();
  for (const r of rows.rows as Array<{ date: string; total: string }>) {
    map.set(r.date, parseFloat(r.total));
  }
  return map;
}

interface MerchantRow {
  name: string;
  logoUrl: string | null;
  spent: number;
  count: number;
}

// shortcut: top 20 merchants by spend; upgrade to pagination if the UI needs more.
async function getMerchantAggregation(month: string): Promise<MerchantRow[]> {
  const { start, end } = monthBounds(month);
  const rows = await db.execute(sql`
    SELECT
      COALESCE(t.merchant_name, t.name) AS name,
      (array_agg(t.logo_url ORDER BY t.date DESC))[1] AS logo_url,
      SUM(t.amount)::text AS spent,
      COUNT(*)::int AS count
    FROM transactions t
    JOIN categories c ON c.id = t.category_id
    WHERE t.date >= ${start}::date
      AND t.date <  ${end}::date
      AND t.amount > 0
      AND NOT t.is_excluded
      AND c."group" = 'expense'
    GROUP BY COALESCE(t.merchant_name, t.name)
    ORDER BY spent DESC
    LIMIT 20
  `);
  return (rows.rows as Array<{ name: string; logo_url: string | null; spent: string; count: number }>).map(
    (r) => ({ name: r.name, logoUrl: r.logo_url, spent: parseFloat(r.spent), count: r.count }),
  );
}

// ---------------------------------------------------------------------------
// GET /api/mobile/dashboard
// ---------------------------------------------------------------------------

export async function getDashboardData(): Promise<DashboardResponse> {
  const month = currentNYMonth();
  const todayNY = getTodayNY();
  const priorMonth = priorMonthOf(month);

  const [monthSpend, budgetStatus, accountRows, recentRows, dailyTotals, streams, categoryById] =
    await Promise.all([
      getMonthSpend(month),
      getBudgetStatusV2(month),
      getAccounts(),
      getRecentTransactions(5),
      getDailyTotalsRange(priorMonth, month),
      getAllStreams(),
      getCategoriesMapAll(),
    ]);

  const stopDay = resolveStopDay(month, todayNY);
  const daily = buildDailySpend(dailyTotals, month, priorMonth, stopDay);

  // Next payday: earliest nextDate among active inflow streams >= today.
  const inflowStreams = streams.filter((s) => s.isActive && parseFloat(s.averageAmount) < 0);
  const nextDates = inflowStreams
    .map((s) => mapStreamToContract(s, null).nextDate)
    .filter((d): d is string => d !== null && d >= todayNY)
    .sort();
  const nextPayday = nextDates[0] ?? null;

  // Upcoming: active outflow streams due in the next 30 days, soonest first.
  const outflowStreams = streams.filter((s) => s.isActive && parseFloat(s.averageAmount) >= 0);
  const windowEnd = addDays(todayNY, 30);
  const upcomingCandidates = outflowStreams
    .map((s) => ({ stream: s, mapped: mapStreamToContract(s, null) }))
    .filter((x) => x.mapped.nextDate !== null && x.mapped.nextDate >= todayNY && x.mapped.nextDate <= windowEnd)
    .sort((a, b) => a.mapped.nextDate!.localeCompare(b.mapped.nextDate!));

  const upcomingLogos = await Promise.all(
    upcomingCandidates.map((x) => getLatestMatchingLogoUrl(x.stream)),
  );
  const upcoming: UpcomingBill[] = upcomingCandidates.map((x, i) => ({
    streamId: x.stream.id,
    name: x.mapped.name,
    logoUrl: upcomingLogos[i],
    amount: x.mapped.amount,
    dueDate: x.mapped.nextDate!,
  }));

  const accountNameById = new Map(accountRows.map((a) => [a.id, a.name]));
  const lastSyncedAt = accountRows.reduce<string | null>((latest, a) => {
    const ts = a.lastSyncedAt ? a.lastSyncedAt.toISOString() : null;
    if (!ts) return latest;
    if (!latest || ts > latest) return ts;
    return latest;
  }, null);

  return {
    month,
    today: todayNY,
    spendThisMonth: parseFloat(monthSpend.totalSpend),
    spendPriorToDate: spendPriorToDate(daily.prior, stopDay),
    daily,
    budgetTotal: budgetStatus.noBudgets ? null : parseFloat(budgetStatus.budgetedTotal),
    nextPayday,
    accounts: accountRows.map(mapAccountSummary),
    lastSyncedAt,
    upcoming,
    recent: recentRows.map((r) => toTxn(r, accountNameById, categoryById)),
  };
}

// ---------------------------------------------------------------------------
// GET /api/mobile/spending?month=YYYY-MM
// ---------------------------------------------------------------------------

export async function getSpendingData(month: string): Promise<SpendingResponse> {
  const todayNY = getTodayNY();
  const priorMonth = priorMonthOf(month);

  const [budgetStatus, monthSpend, breakdown, dailyTotals, monthlySeries, merchants, categoryById] =
    await Promise.all([
      getBudgetStatusV2(month),
      getMonthSpend(month),
      getCategoryBreakdown(month),
      getDailyTotalsRange(priorMonth, month),
      getMonthlySeries(),
      getMerchantAggregation(month),
      getCategoriesMapAll(),
    ]);

  const stopDay = resolveStopDay(month, todayNY);
  const daily = buildDailySpend(dailyTotals, month, priorMonth, stopDay);

  const income = parseFloat(monthSpend.totalIncome);
  const bills = parseFloat(budgetStatus.billsPaidThisMonth);
  const spending = parseFloat(budgetStatus.flexibleSpentThisMonth);

  const categoriesOut = breakdown.map((row) => ({
    id: row.categoryId,
    label: row.label,
    color: row.color,
    icon: row.icon,
    group: categoryById.get(row.categoryId)?.group ?? "expense",
    spent: parseFloat(row.spent),
    budget: row.budget !== null ? parseFloat(row.budget) : null,
  }));

  return {
    month,
    income,
    bills,
    spending,
    net: income - bills - spending,
    daily,
    budgetTotal: budgetStatus.noBudgets ? null : parseFloat(budgetStatus.budgetedTotal),
    categories: categoriesOut,
    merchants,
    months: monthlySeries.map((r) => ({ month: r.month.slice(0, 7), spend: parseFloat(r.totalSpend) })),
  };
}

// ---------------------------------------------------------------------------
// GET /api/mobile/transactions
// ---------------------------------------------------------------------------

export async function getMobileTransactionsData(
  filters: TransactionFilters,
): Promise<TransactionsResponse> {
  const [result, accountNameById, categoryById] = await Promise.all([
    getTransactions(filters),
    getAccountNameMap(),
    getCategoriesMapAll(),
  ]);
  return {
    transactions: result.transactions.map((r) => toTxn(r, accountNameById, categoryById)),
    nextCursor: result.nextCursor,
  };
}

// ---------------------------------------------------------------------------
// PATCH /api/mobile/accounts/[id]
// ---------------------------------------------------------------------------

export async function setAccountHidden(
  id: string,
  isHidden: boolean,
): Promise<AccountSummary | null> {
  const updated = await db
    .update(accounts)
    .set({ isHidden })
    .where(eq(accounts.id, id))
    .returning({ id: accounts.id });
  if (updated.length === 0) return null;

  const rows = await db
    .select({
      id: accounts.id,
      itemId: accounts.itemId,
      institutionName: items.institutionName,
      name: accounts.name,
      mask: accounts.mask,
      type: accounts.type,
      subtype: accounts.subtype,
      currentBalance: accounts.currentBalance,
      isHidden: accounts.isHidden,
      itemStatus: items.status,
      lastSyncedAt: items.lastSyncedAt,
    })
    .from(accounts)
    .innerJoin(items, eq(accounts.itemId, items.id))
    .where(eq(accounts.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    itemId: row.itemId,
    name: row.name,
    institutionName: row.institutionName,
    mask: row.mask,
    type: row.type,
    subtype: row.subtype,
    group: mapAccountGroup(row.type, row.subtype),
    balance: parseFloat(row.currentBalance ?? "0"),
    isHidden: row.isHidden,
    itemStatus: row.itemStatus,
    lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
  };
}
