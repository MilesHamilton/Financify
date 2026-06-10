import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db/index";
import { items } from "@/db/schema";
import { syncItem } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Guard: CRON_SECRET must be set in env
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("CRON_SECRET is not set");
    return NextResponse.json(
      { error: "server_misconfiguration" },
      { status: 500 },
    );
  }

  // Guard: Authorization header must equal `Bearer ${CRON_SECRET}`
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Fetch all active items
  const activeItems = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.status, "active"));

  const synced: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  // Run syncItem sequentially — FR-017 requires one at a time
  for (const item of activeItems) {
    try {
      await syncItem(item.id);
      synced.push(item.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error({ msg: "cron syncItem failed", itemId: item.id, err });
      failed.push({ id: item.id, error: message });
    }
  }

  return NextResponse.json({ synced, failed });
}
