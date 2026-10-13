import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errInfo } from "@/lib/log-error";
import { getRecurringStreamDetailData } from "@/domain/mobile";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/mobile/recurring/[id]
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const result = await getRecurringStreamDetailData(id);
    if (!result) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/mobile/recurring/[id]] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
