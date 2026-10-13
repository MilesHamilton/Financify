import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errInfo } from "@/lib/log-error";
import { getDashboardData } from "@/domain/mobile";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/mobile/dashboard
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await getDashboardData();
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/mobile/dashboard] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
