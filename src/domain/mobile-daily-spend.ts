/**
 * src/domain/mobile-daily-spend.ts
 *
 * GET /api/mobile/daily-spend. Gathers the inputs (same filters as
 * getBudgetStatusV2's flexible/bills queries) and hands them to the pure
 * computeDailySpend in daily-spend.ts.
 */

import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { BILL_MATCH_EXISTS, getMonthlyIncomeEstimate, getTodayNY } from "@/domain/metrics";
import { addDays, monthBounds } from "@/domain/mobile-helpers";
import { computeDailySpend } from "@/domain/daily-spend";
import type { DailySpendResponse } from "@/contracts/mobile-api";

/** Flexible spend filter: expense outflow, not excluded, not a bill payment. Pending included. */
const FLEXIBLE = sql`
  t.amount > 0
  AND t.is_excluded = false
  AND c."group" = 'expense'
  AND NOT ${BILL_MATCH_EXISTS}
`;

export async function getDailySpendData(month: string): Promise<DailySpendResponse> {
  const todayNY = getTodayNY();
  const { start, end } = monthBounds(month);
  // Trailing 30 days ending today, or the month's last day for past months.
  const windowEnd = todayNY < end ? todayNY : addDays(end, -1);
  const windowStart = addDays(windowEnd, -29);

  const [income, billsExpectedRows, billsPaidRows, dailyRows, past30Rows] = await Promise.all([
    getMonthlyIncomeEstimate(),
    // Normalised to a monthly amount so weekly/annual bills aren't counted once.
    db.execute(sql`
      SELECT COALESCE(SUM(average_amount::numeric * CASE frequency
        WHEN 'WEEKLY' THEN 52.0 / 12
        WHEN 'BIWEEKLY' THEN 26.0 / 12
        WHEN 'SEMI_MONTHLY' THEN 2
        WHEN 'ANNUALLY' THEN 1.0 / 12
        ELSE 1 END), 0)::text AS total
      FROM recurring_streams
      WHERE is_active = true AND is_bill = true
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(t.amount), 0)::text AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.date >= ${start}::date
        AND t.date <  ${end}::date
        AND t.amount > 0
        AND t.is_excluded = false
        AND c."group" = 'expense'
        AND ${BILL_MATCH_EXISTS}
    `),
    db.execute(sql`
      SELECT to_char(t.date, 'YYYY-MM-DD') AS day, SUM(t.amount)::text AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.date >= ${start}::date
        AND t.date <  ${end}::date
        AND ${FLEXIBLE}
      GROUP BY t.date
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(t.amount), 0)::text AS total
      FROM transactions t
      JOIN categories c ON c.id = t.category_id
      WHERE t.date >= ${windowStart}::date
        AND t.date <= ${windowEnd}::date
        AND ${FLEXIBLE}
    `),
  ]);

  const total = (rows: { rows: unknown[] }): number =>
    parseFloat((rows.rows[0] as { total: string } | undefined)?.total ?? "0");

  return computeDailySpend({
    month,
    todayNY,
    income: parseFloat(income.estimatedIncome),
    usingIncomeOverride: income.usingOverride,
    savingsTarget: parseFloat(income.savingsTarget),
    billsExpected: total(billsExpectedRows),
    billsPaid: total(billsPaidRows),
    dailyFlexible: new Map(
      (dailyRows.rows as Array<{ day: string; total: string }>).map((r) => [r.day, parseFloat(r.total)]),
    ),
    averagePerDay: total(past30Rows) / 30,
  });
}
