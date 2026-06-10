import Link from "next/link";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import { CategoryIcon } from "@/components/CategoryIcon";
import type { TransactionRow } from "@/domain/metrics";

interface RecentTransactionsCardProps {
  transactions: TransactionRow[];
}

export function RecentTransactionsCard({
  transactions,
}: RecentTransactionsCardProps) {
  return (
    <Card
      title="Recent Transactions"
      titleAction={
        <Link
          href="/transactions"
          className="text-xs font-medium min-h-[44px] inline-flex items-center px-1"
          style={{ color: "var(--color-accent)" }}
        >
          See all
        </Link>
      }
    >
      {transactions.length === 0 ? (
        <p
          className="py-6 text-center text-sm"
          style={{ color: "var(--color-text-muted)" }}
        >
          No transactions yet
        </p>
      ) : (
        <ul className="flex flex-col divide-y" style={{ borderColor: "var(--color-border)" }}>
          {transactions.map((txn) => {
            // Plaid sign convention: positive amount = outflow (expense),
            // negative = inflow (income). For display: show as-is with
            // variant="negative" for expenses (positive Plaid amount → red).
            const amount = parseFloat(txn.amount);
            const isExpense = amount > 0;
            const displayValue = isExpense ? amount : Math.abs(amount);
            const variant = isExpense ? "negative" : "positive";
            const displayName = txn.merchantName ?? txn.name;

            return (
              <li
                key={txn.id}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                style={{ opacity: txn.isExcluded ? 0.5 : 1 }}
              >
                <CategoryIcon
                  iconName={txn.categoryIcon}
                  colorToken={txn.categoryColor}
                  iconSize={16}
                />

                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    {displayName}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {txn.categoryLabel}
                    </p>
                    {txn.pending && (
                      <span
                        className="inline-flex shrink-0 rounded px-1.5 py-px text-[10px] font-medium"
                        style={{
                          background: "var(--color-surface-2)",
                          color: "var(--color-text-muted)",
                        }}
                      >
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                <Amount value={displayValue} variant={variant} size="sm" />
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
