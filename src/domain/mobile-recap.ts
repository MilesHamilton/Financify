/**
 * src/domain/mobile-recap.ts
 *
 * GET /api/mobile/recap. Gathers the month's rows and hands them to the pure
 * buildRecap in recap.ts. Fixed costs (rent, utilities, matched bills) are
 * split out so the fun stats reflect choices, not the lease.
 */

import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { BILL_MATCH_EXISTS, getMonthSpend } from "@/domain/metrics";
import { monthBounds } from "@/domain/mobile-helpers";
import { getDailySpendData } from "@/domain/mobile-daily-spend";
import { buildRecap } from "@/domain/recap";
import type { RecapResponse } from "@/contracts/mobile-api";

const OUTFLOW = sql`t.amount > 0 AND NOT t.is_excluded AND c."group" = 'expense'`;
const FIXED = sql`(c.id IN ('housing', 'bills_utilities') OR ${BILL_MATCH_EXISTS})`;
const LIFESTYLE = sql`${OUTFLOW} AND NOT ${FIXED}`;

export async function getRecapData(month: string): Promise<RecapResponse> {
  const { start, end } = monthBounds(month);
  const inMonth = sql`t.date >= ${start}::date AND t.date < ${end}::date`;

  const [monthSpend, daily, fixedRows, categoryRows, merchantRows, biggestRows, dayRows, countRows] =
    await Promise.all([
      getMonthSpend(month),
      getDailySpendData(month),
      db.execute(sql`
        SELECT COALESCE(SUM(t.amount), 0)::text AS total
        FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE ${inMonth} AND ${OUTFLOW} AND ${FIXED}
      `),
      db.execute(sql`
        SELECT c.id, c.label, c.color, c.icon, c."group", SUM(t.amount)::text AS spent
        FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE ${inMonth} AND ${LIFESTYLE}
        GROUP BY c.id, c.label, c.color, c.icon, c."group"
      `),
      db.execute(sql`
        SELECT COALESCE(t.merchant_name, t.name) AS name,
          (array_agg(t.logo_url ORDER BY t.date DESC))[1] AS logo_url,
          SUM(t.amount)::text AS spent, COUNT(*)::int AS count
        FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE ${inMonth} AND ${LIFESTYLE}
        GROUP BY COALESCE(t.merchant_name, t.name)
      `),
      db.execute(sql`
        SELECT COALESCE(t.merchant_name, t.name) AS name, t.logo_url, t.amount::text AS amount, t.date::text AS date
        FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE ${inMonth} AND ${LIFESTYLE}
        ORDER BY t.amount DESC
        LIMIT 1
      `),
      db.execute(sql`
        SELECT t.date::text AS date, SUM(t.amount)::text AS total
        FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE ${inMonth} AND ${LIFESTYLE}
        GROUP BY t.date
      `),
      db.execute(sql`
        SELECT COUNT(*)::int AS n
        FROM transactions t JOIN categories c ON c.id = t.category_id
        WHERE ${inMonth} AND ${OUTFLOW}
      `),
    ]);

  const biggest = biggestRows.rows[0] as { name: string; logo_url: string | null; amount: string; date: string } | undefined;
  const hasPlan = daily.days.some((d) => d.allowance !== null);

  return buildRecap({
    month,
    income: parseFloat(monthSpend.totalIncome),
    totalSpent: parseFloat(monthSpend.totalSpend),
    priorTotalSpent: parseFloat(monthSpend.priorTotalSpend),
    fixedSpent: parseFloat((fixedRows.rows[0] as { total: string }).total),
    savingsTarget: daily.plan.savingsTarget,
    transactionCount: (countRows.rows[0] as { n: number }).n,
    categories: (
      categoryRows.rows as Array<{ id: string; label: string; color: string; icon: string; group: string; spent: string }>
    ).map((r) => ({ id: r.id, label: r.label, color: r.color, icon: r.icon, group: r.group, spent: parseFloat(r.spent) })),
    merchants: (merchantRows.rows as Array<{ name: string; logo_url: string | null; spent: string; count: number }>).map(
      (r) => ({ name: r.name, logoUrl: r.logo_url, spent: parseFloat(r.spent), count: r.count }),
    ),
    biggestPurchase: biggest
      ? { name: biggest.name, logoUrl: biggest.logo_url, amount: parseFloat(biggest.amount), date: biggest.date }
      : null,
    dailyLifestyle: new Map(
      (dayRows.rows as Array<{ date: string; total: string }>).map((r) => [r.date, parseFloat(r.total)]),
    ),
    daysUnderAllowance: hasPlan
      ? daily.days.filter((d) => !d.isFuture && d.allowance !== null && d.spent <= d.allowance).length
      : null,
  });
}
