import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { errInfo } from "@/lib/log-error";
import { setAccountHidden } from "@/domain/mobile";

export const runtime = "nodejs";

const bodySchema = z.object({ isHidden: z.boolean() });

// ---------------------------------------------------------------------------
// PATCH /api/mobile/accounts/[id]  { isHidden: boolean } → AccountSummary
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await setAccountHidden(id, parsed.data.isHidden);
    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[PATCH /api/mobile/accounts/[id]] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
