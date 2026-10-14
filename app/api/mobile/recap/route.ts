import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errInfo } from "@/lib/log-error";
import { currentNYMonth } from "@/domain/metrics";
import { priorMonthOf } from "@/domain/mobile-helpers";
import { getRecapData } from "@/domain/mobile";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/mobile/recap?month=YYYY-MM (default: last month)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const current = currentNYMonth();
  const month = req.nextUrl.searchParams.get("month") ?? priorMonthOf(current);
  const m = /^\d{4}-(\d{2})$/.exec(month);
  if (!m || +m[1] < 1 || +m[1] > 12) {
    return NextResponse.json(
      { error: "invalid_param", details: "month must be in YYYY-MM format" },
      { status: 400 },
    );
  }
  // Recaps are for finished months only.
  if (month >= current) {
    return NextResponse.json({ error: "month_not_finished" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getRecapData(month), { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/mobile/recap] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
