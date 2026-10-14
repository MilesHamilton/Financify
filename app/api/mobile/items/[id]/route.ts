import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { items } from "@/db/schema";
import { requireSession } from "@/lib/api-auth";
import { decryptToken } from "@/lib/crypto";
import { errInfo } from "@/lib/log-error";
import { plaidClient } from "@/lib/plaid";
import { extractPlaidErrorCode } from "@/lib/sync";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// DELETE /api/mobile/items/[id] → { removed: true }
// Revokes the Plaid item, then deletes it; accounts, transactions and
// snapshots go with it via ON DELETE CASCADE.
// ---------------------------------------------------------------------------

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const [item] = await db.select({ token: items.accessTokenEnc }).from(items).where(eq(items.id, id));
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  try {
    await plaidClient.itemRemove({ access_token: decryptToken(item.token) });
  } catch (err: unknown) {
    // Already gone at Plaid is fine; anything else keeps the row so nothing is orphaned.
    const code = extractPlaidErrorCode(err);
    if (code !== "ITEM_NOT_FOUND" && code !== "INVALID_ACCESS_TOKEN") {
      console.error("[DELETE /api/mobile/items] plaid itemRemove failed", errInfo(err));
      return NextResponse.json({ error: "plaid_error", code }, { status: 502 });
    }
  }

  await db.delete(items).where(eq(items.id, id));
  return NextResponse.json({ removed: true });
}
