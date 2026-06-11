import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "../../../../auth";
import { handleSessionFinished } from "@/lib/link-session";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * TEMPORARY operator recovery route: re-runs the SESSION_FINISHED token
 * exchange for a stranded Hosted Link session using the link_token stored
 * in the sync_events audit row. Session-auth gated. Remove once linking
 * has been stable in production.
 */
const bodySchema = z.object({
  link_token: z.string().startsWith("link-"),
  link_session_id: z.string().default("manual-recovery"),
});

export async function POST(request: Request): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    await handleSessionFinished(
      parsed.data.link_token,
      parsed.data.link_session_id,
    );
    return NextResponse.json({ recovered: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error({ msg: "recover_link_failed", err });
    return NextResponse.json(
      { recovered: false, error: message },
      { status: 502 },
    );
  }
}
