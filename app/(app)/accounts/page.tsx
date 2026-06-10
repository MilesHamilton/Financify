import dynamicImport from "next/dynamic";
import Link from "next/link";
import { Wallet, AlertTriangle } from "lucide-react";

import { getNetWorth, getBalanceHistory, getAccounts } from "@/domain/metrics";
import type { AccountRow } from "@/domain/metrics";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import { ReconnectButton } from "@/components/accounts/ReconnectButton";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Range tabs config
// ---------------------------------------------------------------------------

type Range = "1M" | "3M" | "6M" | "1Y";
const RANGES: Range[] = ["1M", "3M", "6M", "1Y"];

function isValidRange(v: unknown): v is Range {
  return RANGES.includes(v as Range);
}

// ---------------------------------------------------------------------------
// Chart — dynamically imported so Recharts only loads on this route
// ---------------------------------------------------------------------------

const BalanceLineChart = dynamicImport(
  () =>
    import("@/components/BalanceLineChart").then((m) => ({
      default: m.BalanceLineChart,
    })),
  {
    loading: () => <Skeleton className="h-full w-full" />,
  },
);

// ---------------------------------------------------------------------------
// NetWorthHeader
// ---------------------------------------------------------------------------

interface NetWorthHeaderProps {
  netWorth: string;
  depositoryTotal: string;
  creditTotal: string;
  lastSyncedAt: Date | null;
  itemsInError: number;
}

function NetWorthHeader({
  netWorth,
  depositoryTotal,
  creditTotal,
  lastSyncedAt,
  itemsInError,
}: NetWorthHeaderProps) {
  const netWorthNum = parseFloat(netWorth);
  const depositoryNum = parseFloat(depositoryTotal);
  const creditNum = parseFloat(creditTotal);

  return (
    <div className="px-4 pt-5 pb-2">
      {/* Title row */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Net Worth
        </h1>
        <SyncStatusPill lastSyncedAt={lastSyncedAt} itemsInError={itemsInError} />
      </div>

      {/* Big net worth number */}
      <Amount
        value={netWorthNum}
        variant="neutral"
        size="xl"
        className="block text-3xl font-bold text-[var(--color-text)]"
      />

      {/* Assets / Debt split */}
      <div className="mt-3 flex gap-6">
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Assets</p>
          <Amount
            value={depositoryNum}
            variant="positive"
            size="md"
            className="font-medium"
          />
        </div>
        <div>
          <p className="text-xs text-[var(--color-text-muted)]">Debt</p>
          <Amount
            value={creditNum}
            variant="negative"
            size="md"
            className="font-medium"
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RangeTabs — link-based, updates ?range= searchParam
// ---------------------------------------------------------------------------

interface RangeTabsProps {
  currentRange: Range;
  currentAccount: string;
}

function RangeTabs({ currentRange, currentAccount }: RangeTabsProps) {
  return (
    <div className="flex gap-1 px-4 pb-2">
      {RANGES.map((r) => {
        const params = new URLSearchParams({
          range: r,
          ...(currentAccount !== "all" ? { account: currentAccount } : {}),
        });
        const active = r === currentRange;
        return (
          <Link
            key={r}
            href={`/accounts?${params.toString()}`}
            className={
              active
                ? "rounded-full bg-[var(--color-accent)] px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full bg-[var(--color-surface-2)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
            }
            aria-current={active ? "page" : undefined}
          >
            {r}
          </Link>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AccountItemRow — single account within a section
// ---------------------------------------------------------------------------

interface AccountItemRowProps {
  account: AccountRow;
}

function AccountItemRow({ account }: AccountItemRowProps) {
  const isHealthy = account.itemStatus === "active";
  const balanceNum =
    account.currentBalance !== null ? parseFloat(account.currentBalance) : null;

  return (
    <div className="flex items-center gap-3 py-3">
      {/* Account info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-[var(--color-text)]">
            {account.officialName ?? account.name}
          </p>
          {!isHealthy && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-negative)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--color-negative)]">
              <AlertTriangle size={9} aria-hidden="true" />
              {statusLabel(account.itemStatus)}
            </span>
          )}
        </div>
        {account.mask && (
          <p className="text-xs text-[var(--color-text-muted)]">
            ••{account.mask}
          </p>
        )}
      </div>

      {/* Balance */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {balanceNum !== null ? (
          <Amount
            value={balanceNum}
            variant="neutral"
            size="md"
            className="font-semibold text-[var(--color-text)]"
          />
        ) : (
          <span className="text-sm text-[var(--color-text-muted)]">—</span>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "login_required":
      return "Login required";
    case "pending_disconnect":
      return "Expiring soon";
    case "revoked":
      return "Revoked";
    default:
      return "Needs attention";
  }
}

// ---------------------------------------------------------------------------
// AccountSection — grouped by institution, with optional ReconnectButton
// ---------------------------------------------------------------------------

interface AccountSectionProps {
  institutionName: string;
  institutionAccounts: AccountRow[];
  /** itemId for the reconnect flow — same for all accounts in a Plaid Item */
  itemId: string;
  itemStatus: string;
}

function AccountSection({
  institutionName,
  institutionAccounts,
  itemId,
  itemStatus,
}: AccountSectionProps) {
  const needsReconnect = itemStatus !== "active";

  return (
    <Card className="mb-3">
      {/* Institution header */}
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          {institutionName}
        </h2>
        {needsReconnect && <ReconnectButton itemId={itemId} />}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--color-border)]" />

      {/* Account rows */}
      <ul>
        {institutionAccounts.map((account, idx) => (
          <li
            key={account.id}
            className={
              idx < institutionAccounts.length - 1
                ? "border-b border-[var(--color-border)]"
                : ""
            }
          >
            <AccountItemRow account={account} />
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page — RSC, force-dynamic
// ---------------------------------------------------------------------------

interface AccountsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function AccountsPage({
  searchParams,
}: AccountsPageProps) {
  const params = await searchParams;

  // Parse and validate searchParams
  const rawRange = Array.isArray(params.range) ? params.range[0] : params.range;
  const range: Range = isValidRange(rawRange) ? rawRange : "3M";

  const rawAccount = Array.isArray(params.account)
    ? params.account[0]
    : params.account;
  const accountId: string = rawAccount ?? "all";

  // Fetch all data in parallel
  const [netWorth, balanceHistory, allAccounts] = await Promise.all([
    getNetWorth(),
    getBalanceHistory(accountId, range),
    getAccounts(),
  ]);

  // Derive sync status from account data
  const syncDates = allAccounts
    .map((a) => a.lastSyncedAt)
    .filter((d): d is Date => d !== null);
  const lastSyncedAt =
    syncDates.length > 0
      ? new Date(Math.max(...syncDates.map((d) => d.getTime())))
      : null;
  const itemsInError = allAccounts.filter(
    (a) => a.itemStatus !== "active",
  ).length;

  // Empty state
  if (allAccounts.length === 0) {
    return (
      <main className="px-4 pb-24">
        <NetWorthHeader
          netWorth={netWorth.netWorth}
          depositoryTotal={netWorth.depositoryTotal}
          creditTotal={netWorth.creditTotal}
          lastSyncedAt={lastSyncedAt}
          itemsInError={itemsInError}
        />
        <div className="mt-8">
          <EmptyState
            icon={Wallet}
            headline="No accounts linked"
            body="Connect your bank or credit card in Settings to see your balances and net worth history."
            action={
              <Link
                href="/settings"
                className="rounded-full bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white"
              >
                Go to Settings
              </Link>
            }
          />
        </div>
      </main>
    );
  }

  // Group accounts by item (institution + itemId)
  const groupMap = new Map<
    string,
    { institutionName: string; itemId: string; itemStatus: string; accounts: AccountRow[] }
  >();
  for (const account of allAccounts) {
    if (!groupMap.has(account.itemId)) {
      groupMap.set(account.itemId, {
        institutionName: account.institutionName,
        itemId: account.itemId,
        itemStatus: account.itemStatus,
        accounts: [],
      });
    }
    groupMap.get(account.itemId)!.accounts.push(account);
  }
  const groups = Array.from(groupMap.values());

  return (
    <main className="pb-24">
      {/* Net Worth Header */}
      <NetWorthHeader
        netWorth={netWorth.netWorth}
        depositoryTotal={netWorth.depositoryTotal}
        creditTotal={netWorth.creditTotal}
        lastSyncedAt={lastSyncedAt}
        itemsInError={itemsInError}
      />

      {/* Balance History Chart Card */}
      <div className="px-4 pb-2">
        <Card className="overflow-hidden">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[var(--color-text)]">
              Balance History
            </h2>
          </div>
          {/* Range tabs inside card */}
          <RangeTabs currentRange={range} currentAccount={accountId} />
          {/* Chart area — fixed height */}
          <div className="h-48">
            <BalanceLineChart rows={balanceHistory.rows} />
          </div>
        </Card>
      </div>

      {/* Account sections grouped by institution */}
      <div className="px-4 pt-2">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Accounts
        </h2>
        {groups.map((group) => (
          <AccountSection
            key={group.itemId}
            institutionName={group.institutionName}
            institutionAccounts={group.accounts}
            itemId={group.itemId}
            itemStatus={group.itemStatus}
          />
        ))}
      </div>
    </main>
  );
}
