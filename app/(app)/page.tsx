import { Suspense } from "react";
import nextDynamic from "next/dynamic";
import Link from "next/link";
import { PlusCircle } from "lucide-react";

import {
  getMonthSpend,
  getAccounts,
  getRecentTransactions,
  getMonthlySeries,
  currentNYMonth,
} from "@/domain/metrics";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/Card";
import { SpendingSummaryCard } from "@/components/dashboard/SpendingSummaryCard";
import { AccountCardsRow } from "@/components/dashboard/AccountCardsRow";
import { RecentTransactionsCard } from "@/components/dashboard/RecentTransactionsCard";

export const dynamic = "force-dynamic";

// Dynamically import the client chart so Recharts only loads here
const MiniSpendBar = nextDynamic(
  () =>
    import("@/components/dashboard/MiniSpendBar").then((m) => ({
      default: m.MiniSpendBar,
    })),
  {
    loading: () => <Skeleton className="h-[120px]" />,
  }
);

// ---------------------------------------------------------------------------
// Greeting helper
// ---------------------------------------------------------------------------

function greeting(): string {
  const hourFmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    hour12: false,
  });
  const hourStr = hourFmt.format(new Date());
  const hour = parseInt(hourStr, 10);
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------
// Dashboard page — RSC
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const month = currentNYMonth();

  // Fetch all four dashboard queries in parallel (FR-032, output-rendering.md § Rendering Pipeline)
  const [spend, accountsList, recentTxns, monthlySeries] = await Promise.all([
    getMonthSpend(month),
    getAccounts(),
    getRecentTransactions(8),
    getMonthlySeries(),
  ]);

  // Visible accounts only (not hidden)
  const visibleAccounts = accountsList.filter((a) => !a.isHidden);

  // Derive sync status from accounts: max lastSyncedAt, count items in error
  const itemMap = new Map<string, { lastSyncedAt: Date | null; status: string }>();
  for (const account of accountsList) {
    const existing = itemMap.get(account.itemId);
    if (!existing) {
      itemMap.set(account.itemId, {
        lastSyncedAt: account.lastSyncedAt,
        status: account.itemStatus,
      });
    } else {
      // Keep the latest sync time across all items
      if (
        account.lastSyncedAt &&
        (!existing.lastSyncedAt ||
          account.lastSyncedAt > existing.lastSyncedAt)
      ) {
        existing.lastSyncedAt = account.lastSyncedAt;
      }
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

  // Last 6 months for the mini chart, chronological
  // getMonthlySeries returns up to 12; we take the last 6.
  const last6 = monthlySeries.slice(-6);

  // The "current month" first-of-month string to highlight in the bar chart.
  // monthlySeries rows have month as YYYY-MM-DD (first of month).
  const currentMonthPrefix = month; // YYYY-MM
  const currentMonthRow = last6.find((r) => r.month.startsWith(currentMonthPrefix));
  const currentMonthFull = currentMonthRow?.month ?? "";

  // Empty state: no linked accounts
  const hasAccounts = visibleAccounts.length > 0;

  return (
    <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
      {/* Header row: greeting + sync pill */}
      <div className="flex items-center justify-between gap-2">
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          {greeting()}
        </h1>
        <SyncStatusPill
          lastSyncedAt={latestSyncedAt}
          itemsInError={itemsInError}
        />
      </div>

      {/* Empty state — no accounts linked yet */}
      {!hasAccounts && (
        <Card>
          <EmptyState
            icon={PlusCircle}
            headline="No accounts linked"
            body="Connect your bank and credit card accounts to see your spending dashboard."
            action={
              <Link
                href="/settings"
                className="inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-semibold"
                style={{
                  background: "var(--color-accent)",
                  color: "#fff",
                }}
              >
                Link an account
              </Link>
            }
          />
        </Card>
      )}

      {/* Spending summary card — taps through to /spending */}
      {hasAccounts && (
        <Suspense fallback={<Skeleton className="h-[116px]" />}>
          <SpendingSummaryCard data={spend} />
        </Suspense>
      )}

      {/* Mini bar chart — client island, lazy loaded */}
      {hasAccounts && last6.length > 0 && (
        <Card>
          <MiniSpendBar series={last6} currentMonth={currentMonthFull} />
        </Card>
      )}

      {/* Account cards horizontal scroll row */}
      {hasAccounts && (
        <Suspense fallback={<Skeleton className="h-[120px]" />}>
          <AccountCardsRow accounts={visibleAccounts} />
        </Suspense>
      )}

      {/* Recent transactions */}
      {hasAccounts && (
        <Suspense fallback={<Skeleton className="h-[320px]" />}>
          <RecentTransactionsCard transactions={recentTxns} />
        </Suspense>
      )}
    </div>
  );
}
