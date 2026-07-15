import { NextRequest, NextResponse } from "next/server";
import { errInfo } from "@/lib/log-error";
import { eq } from "drizzle-orm";

import { db } from "@/db/index";
import { items } from "@/db/schema";
import { syncItem } from "@/lib/sync";
import { decryptToken } from "@/lib/crypto";
import { syncRecurringStreams } from "@/domain/recurring";

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

  // Fetch all active items — include accessTokenEnc for recurring sync (T-R31)
  const activeItems = await db
    .select({ id: items.id, accessTokenEnc: items.accessTokenEnc })
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
      console.error({ msg: "cron syncItem failed", itemId: item.id, error: errInfo(err) });
      failed.push({ id: item.id, error: message });
      // Transaction sync did not succeed — skip recurring sync for this item
      continue;
    }

    // T-R31: after successful transaction sync, sync recurring streams.
    // Failures degrade gracefully — a recurring-sync error must NOT fail the
    // cron job or the transaction sync that already completed above.
    try {
      const accessToken = decryptToken(item.accessTokenEnc);
      const recurringResult = await syncRecurringStreams(accessToken);
      if (recurringResult.error) {
        // syncRecurringStreams already logs internally; note item-level failure here
        console.error({
          msg: "cron syncRecurringStreams reported error",
          itemId: item.id,
        });
      }
    } catch (err) {
      // syncRecurringStreams never throws by contract, but guard defensively
      console.error({
        msg: "cron syncRecurringStreams unexpected error",
        itemId: item.id,
        error: errInfo(err),
      });
    }
  }

  return NextResponse.json({ synced, failed });
}
