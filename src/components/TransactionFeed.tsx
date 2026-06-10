"use client";

/**
 * TransactionFeed — client component.
 *
 * Owns the append-mode pagination state and the grouped-by-date rendering
 * of transaction rows. The initial page is supplied from the RSC as props;
 * subsequent pages are fetched via the `fetchMoreAction` server action and
 * appended to local state.
 *
 * This is a client component so that:
 *   1. It can hold the accumulated `rows` state across server action calls.
 *   2. It can render TransactionGroup and TransactionRow (which are shared/client)
 *      with the freshly-fetched data without crossing the RSC boundary via a
 *      non-serializable render prop.
 */

import { useState, useTransition } from "react";
import type { TransactionRow } from "@/domain/metrics";
import { TransactionGroup } from "@/components/TransactionGroup";
import { TransactionRow as TxRow } from "@/components/TransactionRow";

interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  group: string;
}

interface TransactionFeedProps {
  initialRows: TransactionRow[];
  initialNextCursor: string | null;
  categories: Category[];
  fetchMoreAction: (cursor: string) => Promise<{
    transactions: TransactionRow[];
    nextCursor: string | null;
  }>;
}

function groupByDate(rows: TransactionRow[]): Map<string, TransactionRow[]> {
  const map = new Map<string, TransactionRow[]>();
  for (const tx of rows) {
    const existing = map.get(tx.date);
    if (existing) {
      existing.push(tx);
    } else {
      map.set(tx.date, [tx]);
    }
  }
  return map;
}

export function TransactionFeed({
  initialRows,
  initialNextCursor,
  categories,
  fetchMoreAction,
}: TransactionFeedProps) {
  const [rows, setRows] = useState<TransactionRow[]>(initialRows);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleLoadMore() {
    if (!nextCursor) return;
    setError(null);
    startTransition(async () => {
      try {
        const result = await fetchMoreAction(nextCursor);
        setRows((prev) => [...prev, ...result.transactions]);
        setNextCursor(result.nextCursor);
      } catch {
        setError("Failed to load more. Please try again.");
      }
    });
  }

  const grouped = groupByDate(rows);

  return (
    <>
      {Array.from(grouped.entries()).map(([date, txns]) => {
        // Daily total: sum of positive Plaid amounts (outflows) for the header.
        const dailyTotal = txns.reduce((sum, t) => {
          const amount = parseFloat(t.amount);
          return amount > 0 ? sum + amount : sum;
        }, 0);

        return (
          <TransactionGroup key={date} date={date} dailyTotal={dailyTotal}>
            {txns.map((tx) => (
              <TxRow key={tx.id} transaction={tx} categories={categories} />
            ))}
          </TransactionGroup>
        );
      })}

      {error && (
        <p className="px-4 py-3 text-sm text-[var(--color-negative)]">{error}</p>
      )}

      {nextCursor && (
        <div className="flex justify-center px-4 py-6">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isPending}
            className="rounded-xl bg-[var(--color-surface)] px-6 py-3 text-sm font-semibold text-[var(--color-accent)] transition-colors active:opacity-70 disabled:opacity-50"
          >
            {isPending ? "Loading..." : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
