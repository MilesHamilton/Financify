import { Suspense } from "react";
import Link from "next/link";
import { ChevronRight, PlusCircle } from "lucide-react";

import {
  getMonthSpend,
  getCategoryBreakdown,
  getMonthlySeries,
  getBalanceHistory,
  getAccounts,
  currentNYMonth,
  type MonthSpendResult,
} from "@/domain/metrics";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import {
  MonthBarSelector,
  type MonthTile,
} from "@/components/dashboard/MonthBarSelector";
import { SpendDonut } from "@/components/dashboard/SpendDonut";
import { CategoryShareList } from "@/components/dashboard/CategoryShareList";
import { CashBalanceArea } from "@/components/dashboard/CashBalanceArea";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Formatting helpers (mirror the prototype's `fmt`)
// ---------------------------------------------------------------------------

/** "$" + rounded value with thousands separators (prototype `fmt`). */
function fmt(n: number): string {
  return "$" + Math.round(n).toLocaleString("en-US");
}

/** YYYY-MM → short month label, e.g. "2026-07" → "Jul". */
function shortMonth(monthKey: string): string {
  const [y, m] = monthKey.split("-").map((v) => parseInt(v, 10));
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short" });
}

/** YYYY-MM-DD → tick label, e.g. "2026-07-01" → "Jul 1". */
function tickDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Skeleton fallback
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-[104px]" />
      <Skeleton className="h-[176px]" />
      <Skeleton className="h-[260px]" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header (always rendered)
// ---------------------------------------------------------------------------

function DashboardHeader({
  lastSyncedAt,
  itemsInError,
}: {
  lastSyncedAt: Date | null;
  itemsInError: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 pb-3.5 pt-1.5">
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.5px" }}>
        Dashboard
      </h1>
      <SyncStatusPill lastSyncedAt={lastSyncedAt} itemsInError={itemsInError} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard content (async — fetches data, degrades to EmptyState on failure)
// ---------------------------------------------------------------------------

async function DashboardContent({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const current = currentNYMonth();
  const selectedMonth =
    typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : current;

  // Fetch everything; any failure (e.g. no DB in this env) degrades gracefully.
  let accountsList: Awaited<ReturnType<typeof getAccounts>> = [];
  let series: Awaited<ReturnType<typeof getMonthlySeries>> = [];
  let breakdown: Awaited<ReturnType<typeof getCategoryBreakdown>> = [];
  let balanceRows: Awaited<ReturnType<typeof getBalanceHistory>>["rows"] = [];
  let spendByMonth = new Map<string, MonthSpendResult>();
  let failed = false;

  try {
    accountsList = await getAccounts();
    series = await getMonthlySeries();

    // Bar tiles: last 7 months that have spend data.
    const barMonthKeys = series.slice(-7).map((r) => r.month.slice(0, 7));
    const monthsToFetch = Array.from(
      new Set([...barMonthKeys, selectedMonth]),
    );

    const [spendResults, breakdownResult, balance] = await Promise.all([
      Promise.all(monthsToFetch.map((m) => getMonthSpend(m))),
      getCategoryBreakdown(selectedMonth),
      getBalanceHistory("all", "1Y"),
    ]);

    spendByMonth = new Map(monthsToFetch.map((m, i) => [m, spendResults[i]]));
    breakdown = breakdownResult;
    balanceRows = balance.rows;
  } catch {
    failed = true;
  }

  // ── Sync status from accounts ─────────────────────────────────────────────
  const itemMap = new Map<string, { lastSyncedAt: Date | null; status: string }>();
  for (const account of accountsList) {
    const existing = itemMap.get(account.itemId);
    if (!existing) {
      itemMap.set(account.itemId, {
        lastSyncedAt: account.lastSyncedAt,
        status: account.itemStatus,
      });
    } else if (
      account.lastSyncedAt &&
      (!existing.lastSyncedAt || account.lastSyncedAt > existing.lastSyncedAt)
    ) {
      existing.lastSyncedAt = account.lastSyncedAt;
    }
  }
  let latestSyncedAt: Date | null = null;
  let itemsInError = 0;
  for (const item of itemMap.values()) {
    if (item.status !== "active") itemsInError++;
    if (
      item.lastSyncedAt &&
      (!latestSyncedAt || item.lastSyncedAt > latestSyncedAt)
    ) {
      latestSyncedAt = item.lastSyncedAt;
    }
  }

  const visibleAccounts = accountsList.filter((a) => !a.isHidden);
  const hasAccounts = visibleAccounts.length > 0;

  // ── Empty / failed state ──────────────────────────────────────────────────
  if (failed || !hasAccounts) {
    return (
      <>
        <DashboardHeader
          lastSyncedAt={latestSyncedAt}
          itemsInError={itemsInError}
        />
        <Card>
          <EmptyState
            icon={PlusCircle}
            headline="No accounts linked"
            body="Connect your bank and credit card accounts to see your spending dashboard."
            action={
              <Link
                href="/settings"
                className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-semibold"
                style={{ background: "var(--color-accent)", color: "#fff" }}
              >
                Link an account
              </Link>
            }
          />
        </Card>
      </>
    );
  }

  // ── Month bar tiles ───────────────────────────────────────────────────────
  const barMonthKeys = series.slice(-7).map((r) => r.month.slice(0, 7));
  const barVals = barMonthKeys.map((m) => {
    const s = spendByMonth.get(m);
    return {
      income: s ? parseFloat(s.totalIncome) : 0,
      spend: s ? parseFloat(s.totalSpend) : 0,
    };
  });
  const maxBar = Math.max(
    1,
    ...barVals.flatMap((v) => [v.income, v.spend]),
  );
  const tiles: MonthTile[] = barMonthKeys.map((m, i) => ({
    key: m,
    label: shortMonth(m),
    incH: `${Math.round((barVals[i].income / maxBar) * 44 + 4)}px`,
    spdH: `${Math.round((barVals[i].spend / maxBar) * 44 + 4)}px`,
    selected: m === selectedMonth,
  }));

  // ── Selected-month summary stats ──────────────────────────────────────────
  const sel = spendByMonth.get(selectedMonth);
  const income = sel ? parseFloat(sel.totalIncome) : 0;
  const totalSpend = sel ? parseFloat(sel.totalSpend) : 0;
  const net = income - totalSpend;

  // ── Donut + category list ─────────────────────────────────────────────────
  const donutSegments = breakdown.map((r) => ({
    color: r.color,
    value: parseFloat(r.spent),
  }));
  const donutTotal = donutSegments.reduce((a, s) => a + s.value, 0);
  const categoryRows = breakdown.map((r) => {
    const spent = parseFloat(r.spent);
    return {
      color: r.color,
      name: r.label,
      share: donutTotal > 0 ? `${Math.round((spent / donutTotal) * 100)}%` : "0%",
      spentLabel: fmt(spent),
    };
  });

  // ── Cash balance (selected month snapshots) ───────────────────────────────
  const monthBalRows = balanceRows.filter(
    (r) => r.asOfDate.slice(0, 7) === selectedMonth && r.currentBalance != null,
  );
  const balPoints = monthBalRows.map((r) => parseFloat(r.currentBalance!));
  const showBalance = balPoints.length >= 2;
  const balDelta = showBalance
    ? balPoints[balPoints.length - 1] - balPoints[0]
    : 0;

  return (
    <>
      <DashboardHeader
        lastSyncedAt={latestSyncedAt}
        itemsInError={itemsInError}
      />

      {/* Month bar-selector + legend */}
      {tiles.length > 0 && <MonthBarSelector tiles={tiles} />}

      {/* Summary card: donut + stats */}
      <div
        className="mt-4 rounded-[var(--radius-card)] p-4"
        style={{ background: "var(--color-surface)" }}
      >
        <div className="flex items-center gap-[18px]">
          <SpendDonut
            segments={donutSegments}
            total={donutTotal}
            centerValue={fmt(totalSpend)}
          />
          <div className="flex flex-1 flex-col gap-3">
            <div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Income
              </div>
              <div
                className="text-[17px] font-bold"
                style={{ color: "var(--color-positive)" }}
              >
                {fmt(income)}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Total Spend
              </div>
              <div className="text-[17px] font-bold">{fmt(totalSpend)}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "var(--color-text-muted)" }}>
                Net Income
              </div>
              <div
                className="text-[17px] font-bold"
                style={{
                  color:
                    net < 0 ? "var(--color-negative)" : "var(--color-positive)",
                }}
              >
                {(net < 0 ? "-" : "+") + fmt(Math.abs(net))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BY CATEGORY */}
      {categoryRows.length > 0 && (
        <>
          <div
            className="px-0.5 pb-2.5 pt-[22px] text-xs font-bold"
            style={{ color: "var(--color-text-muted)", letterSpacing: "1.2px" }}
          >
            BY CATEGORY
          </div>
          <CategoryShareList rows={categoryRows} />
        </>
      )}

      {/* Cash balance */}
      {showBalance && (
        <CashBalanceArea
          points={balPoints}
          endValue={fmt(balPoints[balPoints.length - 1])}
          deltaLabel={`${balDelta >= 0 ? "+" : "−"}${fmt(Math.abs(balDelta))} this month`}
          deltaPositive={balDelta >= 0}
          startTick={tickDate(monthBalRows[0].asOfDate)}
          endTick={
            selectedMonth === current
              ? "Today"
              : tickDate(monthBalRows[monthBalRows.length - 1].asOfDate)
          }
        />
      )}

      {/* Recent Transactions link row (T-R52) */}
      <Link
        href="/transactions"
        className="mt-4 flex items-center justify-between rounded-[var(--radius-card)] p-4"
        style={{ background: "var(--color-surface)" }}
      >
        <span className="text-sm font-semibold">Recent Transactions</span>
        <ChevronRight
          size={18}
          style={{ color: "var(--color-text-muted)" }}
          aria-hidden="true"
        />
      </Link>
    </>
  );
}

// ---------------------------------------------------------------------------
// Dashboard page — RSC
// ---------------------------------------------------------------------------

export default function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  return (
    <div className="flex flex-col px-4 pb-6 pt-4">
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
