import { NextResponse, after } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { items } from "@/db/schema";
import { errInfo } from "@/lib/log-error";
import { handleSessionFinished, latestLinkStart } from "@/lib/link-session";
import { syncItem } from "@/lib/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

const bodySchema = z.object({
  public_token: z.string().startsWith("public-"),
  link_session_id: z.string().default("app-link"),
});

/**
 * Called by /link and /plaid/oauth-return when Plaid Link succeeds. No bearer
 * token: it often runs in Safari after a bank's app. It only acts on a Link
 * session the app started in the last 30 minutes (latestLinkStart), and a
 * public_token is only issued by a session on that link_token.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const start = await latestLinkStart();
  if (!start) return NextResponse.json({ error: "no_link_session" }, { status: 409 });

  try {
    if (start.item_id) {
      // Update mode: the item already exists; Plaid has repaired its login.
      const itemId = start.item_id;
      await db.update(items).set({ status: "active", updatedAt: new Date() }).where(eq(items.id, itemId));
      after(() => syncItem(itemId));
    } else {
      await handleSessionFinished(start.link_token, parsed.data.link_session_id, [parsed.data.public_token]);
    }
  } catch (err) {
    console.error("[link/complete] failed", errInfo(err));
    return NextResponse.json({ error: "link_complete_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
