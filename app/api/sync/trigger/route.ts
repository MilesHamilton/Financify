/**
 * POST /api/sync/trigger
 *
 * Manual sync trigger — called by pull-to-refresh before router.refresh().
 * Immediately returns { queued, already_syncing } and schedules syncItem()
 * via after() so the HTTP response is not blocked by sync work.
 *
 * Debounce (FR-040, TR § 1.5): items whose sync_status is already 'SYNCING'
 * are reported in already_syncing and skipped; the in-flight sync handles them
 * via the resync_requested flag inside syncItem() if needed.
 *
 * References: FRS FR-040; TR.md § 1.5; runtime-execution.md § Process Lifecycle
 */

import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "../../../../auth";
import { db } from "@/db";
import { items } from "@/db/schema";
import { syncItem } from "@/lib/sync";

// ── Route configuration ──────────────────────────────────────────────────────
export const runtime = "nodejs";
export const maxDuration = 300;

// ── Request body schema ──────────────────────────────────────────────────────
const bodySchema = z.object({
  itemId: z.string().optional(),
});

// ── Handler ──────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth gate (FR-002 / middleware backs this up, but in-handler check is required)
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse body — treat an empty body as {}
  let rawBody: unknown;
  try {
    const text = await request.text();
    rawBody = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { itemId } = parsed.data;

  // Resolve target rows
  let rows: { id: string; syncStatus: string }[];

  if (itemId !== undefined) {
    rows = await db
      .select({ id: items.id, syncStatus: items.syncStatus })
      .from(items)
      .where(eq(items.id, itemId));

    if (rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
  } else {
    rows = await db
      .select({ id: items.id, syncStatus: items.syncStatus })
      .from(items)
      .where(eq(items.status, "active"));
  }

  // Debounce: partition by current sync_status
  const toQueue: string[] = [];
  const alreadySyncing: string[] = [];

  for (const row of rows) {
    if (row.syncStatus === "SYNCING") {
      alreadySyncing.push(row.id);
    } else {
      toQueue.push(row.id);
    }
  }

  // Schedule non-blocking sync work after the response is sent
  for (const id of toQueue) {
    after(() => syncItem(id));
  }

  return NextResponse.json({ queued: toQueue, already_syncing: alreadySyncing });
}
