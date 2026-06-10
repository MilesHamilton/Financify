"use client";

/**
 * TransactionRow — client component.
 *
 * Renders a single transaction: logo/icon, merchant name, category chip,
 * amount, and a pending badge. Tapping opens TransactionDetailSheet.
 *
 * Amount sign convention (FR-048, metrics.ts):
 *   Plaid amount > 0 = outflow (expense) → display as negative (red, e.g. -$12.50)
 *   Plaid amount < 0 = inflow (income)   → display as positive (green, e.g. +$500.00)
 * We negate the stored value so positive-Plaid reads as a red debit on screen.
 */

import { useState } from "react";
import Image from "next/image";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Amount } from "@/components/Amount";
import { TransactionDetailSheet } from "@/components/TransactionDetailSheet";
import { cn } from "@/lib/utils";
import type { TransactionRow as TxRow } from "@/domain/metrics";

interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  group: string;
}

interface TransactionRowProps {
  transaction: TxRow;
  categories: Category[];
}

export function TransactionRow({ transaction, categories }: TransactionRowProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const displayName = transaction.merchantName ?? transaction.name;

  // Negate Plaid amount: positive Plaid = outflow = show negative (red).
  const displayAmount = -parseFloat(transaction.amount);

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={cn(
          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-[var(--color-surface-2)]",
          transaction.isExcluded && "opacity-50",
        )}
        aria-label={`${displayName} transaction, ${transaction.categoryLabel}`}
      >
        {/* Logo or CategoryIcon */}
        <div className="shrink-0">
          {transaction.logoUrl ? (
            <div
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl"
              style={{ background: transaction.categoryColor }}
            >
              <Image
                src={transaction.logoUrl}
                alt={displayName}
                width={36}
                height={36}
                className="h-9 w-9 object-cover"
                unoptimized
              />
            </div>
          ) : (
            <CategoryIcon
              iconName={transaction.categoryIcon}
              colorToken={transaction.categoryColor}
              iconSize={18}
            />
          )}
        </div>

        {/* Name + category chip */}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm font-medium",
              transaction.isExcluded
                ? "text-[var(--color-text-muted)]"
                : "text-[var(--color-text)]",
            )}
          >
            {displayName}
          </p>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span
              className="inline-block max-w-[120px] truncate rounded px-1.5 py-0.5 text-[10px] font-semibold text-white"
              style={{ backgroundColor: transaction.categoryColor }}
            >
              {transaction.categoryLabel}
            </span>
            {transaction.pending && (
              <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
                Pending
              </span>
            )}
          </div>
        </div>

        {/* Amount */}
        <div className="shrink-0 text-right">
          <Amount
            value={displayAmount}
            variant="auto"
            size="sm"
          />
        </div>
      </button>

      <TransactionDetailSheet
        transaction={transaction}
        categories={categories}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
