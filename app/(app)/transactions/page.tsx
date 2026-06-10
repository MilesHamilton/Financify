/**
 * Transactions screen — RSC, force-dynamic (FR-042).
 *
 * URL params: ?q=, ?month=, ?category=, ?account=
 * Cursor pagination is NOT URL-driven; TransactionFeed (client) accumulates
 * pages via a server action so the user always sees all loaded rows ("append mode").
 *
 * Structure:
 *   SearchBar (client) — debounced, writes ?q= via router.replace
 *   FilterChips (client) — shows/clears active month/category/account filters
 *   TransactionFeed (client) — holds accumulated rows + LoadMore state
 */

import "server-only";

import { Suspense } from "react";
import { Receipt } from "lucide-react";
import { getTransactions } from "@/domain/metrics";
import type { TransactionRow, TransactionFilters } from "@/domain/metrics";
import { db } from "@/db";
import { categories as categoriesTable } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { EmptyState } from "@/components/EmptyState";
import { TransactionFeed } from "@/components/TransactionFeed";
import { SearchBar } from "./SearchBar";
import { FilterChips } from "./FilterChips";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface PageSearchParams {
  q?: string;
  month?: string;
  category?: string;
  account?: string;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || undefined;
  const month = params.month || undefined;
  const category = params.category || undefined;
  const account = params.account || undefined;

  const filters: Omit<TransactionFilters, "cursor"> = {
    q,
    month,
    category,
    account,
    limit: 50,
  };

  // Parallel fetch: first page of transactions + all active categories.
  const [{ transactions, nextCursor }, allCategories] = await Promise.all([
    getTransactions(filters),
    db
      .select({
        id: categoriesTable.id,
        label: categoriesTable.label,
        icon: categoriesTable.icon,
        color: categoriesTable.color,
        group: categoriesTable.group,
      })
      .from(categoriesTable)
      .where(eq(categoriesTable.isArchived, false))
      .orderBy(asc(categoriesTable.sortOrder), asc(categoriesTable.label)),
  ]);

  // Server action: closed over `filters` so the client component can fetch
  // subsequent pages without re-sending filter state. Next.js serializes
  // the closure into an opaque server action reference — safe to pass as a prop.
  async function fetchMore(cursor: string): Promise<{
    transactions: TransactionRow[];
    nextCursor: string | null;
  }> {
    "use server";
    return getTransactions({ ...filters, cursor, limit: 50 });
  }

  const activeFilters = {
    q,
    month: month ?? null,
    category: category ?? null,
    account: account ?? null,
  };

  const hasActiveFilters = !!(q || month || category || account);

  return (
    <main className="min-h-screen bg-[var(--color-canvas)]">
      {/* Page header */}
      <div className="px-4 pb-2 pt-5">
        <h1 className="mb-4 text-xl font-semibold text-[var(--color-text)]">
          Transactions
        </h1>

        {/* Search — Suspense required because SearchBar uses useSearchParams */}
        <Suspense>
          <SearchBar defaultValue={q ?? ""} />
        </Suspense>

        {/* Active filter chips */}
        <Suspense>
          <FilterChips filters={activeFilters} />
        </Suspense>
      </div>

      {/* Feed */}
      {transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          headline="No transactions found"
          body={
            hasActiveFilters
              ? "Try clearing your filters to see more."
              : "Transactions will appear here once your accounts sync."
          }
          className="mt-8"
        />
      ) : (
        <div className="pb-6">
          <TransactionFeed
            initialRows={transactions}
            initialNextCursor={nextCursor}
            categories={allCategories}
            fetchMoreAction={fetchMore}
          />
        </div>
      )}
    </main>
  );
}
