/**
 * PUT /api/category-rules/:id/apply
 *
 * Retroactively re-runs resolveCategory for all transactions whose
 * category_source is NOT 'user'. User overrides are never touched (FR-025,
 * abstraction-layer.md § Extension Points #2).
 *
 * Algorithm:
 *   1. Load the full categorization context once (2 DB queries total).
 *   2. Fetch all candidate transactions (category_source != 'user') — one query.
 *   3. Process in 500-row chunks; for each row call resolveCategory(row, ctx).
 *   4. Collect rows whose category_id, category_source, or is_excluded changed.
 *   5. Batch-update the changed rows using inArray — one UPDATE per chunk,
 *      not one per row, keeping this well below O(n) round-trips.
 *   6. Revalidate relevant paths.
 *
 * Response: { updated: <count> }
 *
 * Auth: session cookie required (TR § 1.7)
 */

import { NextRequest, NextResponse } from "next/server";
import { eq, ne, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { auth } from "../../../../../auth";
import { db } from "@/db";
import { transactions, categoryRules } from "@/db/schema";
import {
  loadCategorizationContext,
  resolveCategory,
} from "@/lib/categorize";

export const runtime = "nodejs";

const CHUNK_SIZE = 500;

// ---------------------------------------------------------------------------
// PUT /api/category-rules/:id/apply
// ---------------------------------------------------------------------------

export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify the rule exists and is active before doing any work.
  const [rule] = await db
    .select({ id: categoryRules.id })
    .from(categoryRules)
    .where(eq(categoryRules.id, id))
    .limit(1);

  if (!rule) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Load categorization context once — 2 queries regardless of transaction count.
  const ctx = await loadCategorizationContext();

  // Fetch all non-user-categorized transactions in a single query.
  // We select only the fields required by ResolvableTransaction plus the
  // current category columns needed to detect changes.
  const candidates = await db
    .select({
      id: transactions.id,
      accountId: transactions.accountId,
      merchantEntityId: transactions.merchantEntityId,
      merchantName: transactions.merchantName,
      name: transactions.name,
      pfcDetailed: transactions.pfcDetailed,
      pfcPrimary: transactions.pfcPrimary,
      amount: transactions.amount,
      // Current stored values — needed to skip rows that didn't change.
      currentCategoryId: transactions.categoryId,
      currentCategorySource: transactions.categorySource,
      currentIsExcluded: transactions.isExcluded,
    })
    .from(transactions)
    .where(ne(transactions.categorySource, "user"));

  let updatedCount = 0;

  // Process in chunks to avoid extremely large IN clauses while still avoiding
  // one round-trip per row. Each chunk produces at most one UPDATE statement.
  for (let offset = 0; offset < candidates.length; offset += CHUNK_SIZE) {
    const chunk = candidates.slice(offset, offset + CHUNK_SIZE);

    // Collect IDs of rows whose resolved category actually changed.
    const changedIds: string[] = [];
    const changedValues = new Map<
      string,
      { categoryId: string; categorySource: "plaid" | "rule"; isExcluded: boolean }
    >();

    for (const row of chunk) {
      const resolution = resolveCategory(
        {
          accountId: row.accountId,
          merchantEntityId: row.merchantEntityId,
          merchantName: row.merchantName,
          name: row.name,
          pfcDetailed: row.pfcDetailed,
          pfcPrimary: row.pfcPrimary,
          amount: row.amount,
        },
        ctx,
      );

      const changed =
        resolution.id !== row.currentCategoryId ||
        resolution.source !== row.currentCategorySource ||
        resolution.excluded !== row.currentIsExcluded;

      if (changed) {
        changedIds.push(row.id);
        changedValues.set(row.id, {
          categoryId: resolution.id,
          categorySource: resolution.source,
          isExcluded: resolution.excluded,
        });
      }
    }

    if (changedIds.length === 0) continue;

    // Drizzle does not support per-row SET in a single UPDATE, so we group
    // rows by their new (categoryId, categorySource, isExcluded) triple and
    // issue one UPDATE per distinct outcome. In practice, a single rule
    // application produces one outcome (the rule's set_category_id), so this
    // is typically one UPDATE per chunk.
    const outcomeGroups = new Map<
      string,
      { ids: string[]; categoryId: string; categorySource: "plaid" | "rule"; isExcluded: boolean }
    >();

    for (const txId of changedIds) {
      const v = changedValues.get(txId)!;
      const key = `${v.categoryId}|${v.categorySource}|${v.isExcluded}`;
      if (!outcomeGroups.has(key)) {
        outcomeGroups.set(key, { ids: [], ...v });
      }
      outcomeGroups.get(key)!.ids.push(txId);
    }

    for (const group of outcomeGroups.values()) {
      await db
        .update(transactions)
        .set({
          categoryId: group.categoryId,
          categorySource: group.categorySource,
          isExcluded: group.isExcluded,
        })
        .where(inArray(transactions.id, group.ids));

      updatedCount += group.ids.length;
    }
  }

  if (updatedCount > 0) {
    revalidatePath("/transactions");
    revalidatePath("/");
    revalidatePath("/spending");
  }

  return NextResponse.json({ updated: updatedCount }, { status: 200 });
}
