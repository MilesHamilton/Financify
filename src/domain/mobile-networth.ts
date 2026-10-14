/**
 * src/domain/mobile-networth.ts
 *
 * GET /api/mobile/net-worth?range=1M|3M|6M|1Y|ALL
 *
 * account_balance_snapshots is sparse (a row only lands when a sync writes
 * one), so the history line is built by forward-filling each account's last
 * known balance across the full set of known snapshot dates, then slicing to
 * the requested range. See buildNetWorthHistory (mobile-helpers.ts).
 */

import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getAccounts, getTodayNY } from "@/domain/metrics";
import { addMonths, buildNetWorthHistory, type NetWorthSnapshotRow } from "@/domain/mobile-helpers";
import { mapAccountSummary } from "@/domain/mobile-shared";
import type { NetWorthRange, NetWorthResponse } from "@/contracts/mobile-api";

const RANGE_MONTHS: Record<Exclude<NetWorthRange, "ALL">, number> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
};

async function fetchNonHiddenSnapshots(): Promise<NetWorthSnapshotRow[]> {
  const rows = await db.execute(sql`
    SELECT
      s.account_id           AS "accountId",
      a.type,
      s.as_of_date::text     AS "asOfDate",
      COALESCE(s.current_balance, 0)::text AS balance
    FROM account_balance_snapshots s
    JOIN accounts a ON a.id = s.account_id
    WHERE a.is_hidden = false
    ORDER BY s.account_id, s.as_of_date ASC
  `);
  return (rows.rows as Array<{ accountId: string; type: string; asOfDate: string; balance: string }>).map(
    (r) => ({ accountId: r.accountId, type: r.type, asOfDate: r.asOfDate, balance: parseFloat(r.balance) }),
  );
}

export async function getNetWorthData(range: NetWorthRange): Promise<NetWorthResponse> {
  const todayNY = getTodayNY();

  const [accountRows, snapshotRows] = await Promise.all([getAccounts(), fetchNonHiddenSnapshots()]);
  // Today always uses live balances, so accounts with missing snapshots still count.
  // Appended last, so they win the forward-fill for today.
  for (const a of accountRows) {
    if (!a.isHidden && a.currentBalance !== null)
      snapshotRows.push({ accountId: a.id, type: a.type, asOfDate: todayNY, balance: parseFloat(a.currentBalance) });
  }

  // Date axis: every known snapshot date, plus "today" so the line always
  // reaches the present using the latest carried-forward balances.
  const dateSet = new Set(snapshotRows.map((r) => r.asOfDate));
  dateSet.add(todayNY);
  const fullHistory = buildNetWorthHistory(snapshotRows, [...dateSet]);

  const rangeStart = range === "ALL" ? null : addMonths(todayNY, -RANGE_MONTHS[range]);
  const history = rangeStart ? fullHistory.filter((p) => p.date >= rangeStart) : fullHistory;

  const current = fullHistory[fullHistory.length - 1] ?? { netWorth: 0, assets: 0, debts: 0 };
  const base = history[0] ?? current;
  const changeAmount = current.netWorth - base.netWorth;
  const changePct = base.netWorth !== 0 ? (changeAmount / Math.abs(base.netWorth)) * 100 : null;

  return {
    range,
    netWorth: current.netWorth,
    assets: current.assets,
    debts: current.debts,
    change: { amount: changeAmount, pct: changePct },
    history: history.map((p) => ({ date: p.date, netWorth: p.netWorth, assets: p.assets, debts: p.debts })),
    accounts: accountRows.map(mapAccountSummary),
  };
}
