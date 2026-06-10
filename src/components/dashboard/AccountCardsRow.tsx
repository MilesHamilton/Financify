import { AlertTriangle } from "lucide-react";
import { Amount } from "@/components/Amount";
import type { AccountRow } from "@/domain/metrics";

interface AccountCardsRowProps {
  accounts: AccountRow[];
}

const accountTypeLabel: Record<string, string> = {
  depository: "Checking / Savings",
  credit: "Credit Card",
  investment: "Investment",
  loan: "Loan",
  other: "Account",
};

export function AccountCardsRow({ accounts }: AccountCardsRowProps) {
  if (accounts.length === 0) return null;

  return (
    <div
      className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4"
      style={{ scrollbarWidth: "none" }}
      // Hide webkit scrollbar via inline style — no className equivalent without
      // a plugin for ::-webkit-scrollbar
    >
      {accounts.map((account) => {
        const isError = account.itemStatus !== "active";
        const balance = account.currentBalance
          ? parseFloat(account.currentBalance)
          : null;

        return (
          <div
            key={account.id}
            className="relative flex min-w-[160px] max-w-[200px] shrink-0 flex-col gap-1.5 rounded-[var(--radius-card)] p-4"
            style={{ background: "var(--color-surface)" }}
          >
            {/* Error badge */}
            {isError && (
              <span
                className="absolute right-3 top-3 flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  background: "rgba(255,107,107,0.15)",
                  color: "var(--color-negative)",
                }}
              >
                <AlertTriangle size={10} aria-hidden="true" />
                {account.itemStatus === "login_required"
                  ? "Reconnect"
                  : account.itemStatus === "pending_disconnect"
                  ? "Expiring"
                  : "Error"}
              </span>
            )}

            <p
              className="truncate text-xs font-medium"
              style={{ color: "var(--color-text-muted)" }}
            >
              {account.institutionName}
            </p>
            <p
              className="truncate text-sm font-semibold"
              style={{ color: "var(--color-text)" }}
            >
              {account.name}
              {account.mask ? ` ••${account.mask}` : ""}
            </p>

            <div className="mt-1">
              {balance !== null ? (
                <Amount
                  value={balance}
                  variant="neutral"
                  size="md"
                  className="font-semibold tabular-nums"
                />
              ) : (
                <span
                  className="text-sm"
                  style={{ color: "var(--color-text-muted)" }}
                >
                  —
                </span>
              )}
            </div>

            <p
              className="text-[11px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {accountTypeLabel[account.type] ?? "Account"}
            </p>
          </div>
        );
      })}
    </div>
  );
}
