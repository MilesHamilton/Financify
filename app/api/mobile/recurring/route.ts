import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errInfo } from "@/lib/log-error";
import { getRecurringStreamsData } from "@/domain/mobile";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/mobile/recurring
//
// All recurring streams — inflow and outflow, active and inactive — with a
// StreamKind classification, for the iOS "Recurring All" grouped list. For
// the bill-streams-matched-to-a-month view see /api/recurring.
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await getRecurringStreamsData();
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/mobile/recurring] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
