import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { errInfo } from "@/lib/log-error";
import { getNetWorthData } from "@/domain/mobile";

export const runtime = "nodejs";

const rangeSchema = z.enum(["1M", "3M", "6M", "1Y", "ALL"]);

// ---------------------------------------------------------------------------
// GET /api/mobile/net-worth?range=1M|3M|6M|1Y|ALL
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rangeParam = req.nextUrl.searchParams.get("range") ?? "1M";
  const parsed = rangeSchema.safeParse(rangeParam);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_param", details: "range must be one of 1M, 3M, 6M, 1Y, ALL" },
      { status: 400 },
    );
  }

  try {
    const result = await getNetWorthData(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/mobile/net-worth] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
