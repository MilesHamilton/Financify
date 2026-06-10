"use client";

import type { ReactNode } from "react";

/**
 * LoadMore — client component.
 *
 * Append-mode pagination: clicking "Load more" calls a server action that
 * fetches the next page and merges it into local state. The full accumulated
 * list of transactions is passed back to the parent render function for display.
 *
 * Design decision: URL-replace would swap out the entire RSC page showing only
 * the new cursor's page — the user would lose all previously-loaded rows
 * (no "append" effect). Instead, this component owns a client-side accumulator:
 *   - Initial page: server-rendered rows, passed as `initialRows` prop.
 *   - Subsequent pages: fetched via `fetchMoreAction` (server action), appended.
 *   - `nextCursor` tracks the keyset cursor for the next page.
 *
 * The parent page passes a typed server action as `fetchMoreAction`; this avoids
 * any API route for the subsequent fetches while keeping auth in the server action.
 */

import { useState, useTransition } from "react";
import type { TransactionRow } from "@/domain/metrics";

interface Category {
  id: string;
  label: string;
  icon: string;
  color: string;
  group: string;
}

interface LoadMoreProps {
  initialRows: TransactionRow[];
  initialNextCursor: string | null;
  categories: Category[];
  fetchMoreAction: (cursor: string) => Promise<{
    transactions: TransactionRow[];
    nextCursor: string | null;
  }>;
  /**
   * Render prop: the parent provides the list rendering, receiving the full
   * accumulated rows. This keeps grouping logic in one place (the page).
   */
  children: (rows: TransactionRow[], categories: Category[]) => ReactNode;
}

export function LoadMore({
  initialRows,
  initialNextCursor,
  categories,
  fetchMoreAction,
  children,
}: LoadMoreProps) {
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

  return (
    <>
      {children(rows, categories)}

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
