import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-auth";
import { errInfo } from "@/lib/log-error";
import { currentNYMonth } from "@/domain/metrics";
import { getSpendingData } from "@/domain/mobile";

export const runtime = "nodejs";

/**
 * Validates a "YYYY-MM" month query parameter.
 * Returns the validated month string on success, or null if the format is
 * invalid — matching the parseMonthParam pattern used in /api/recurring.
 */
function parseMonthParam(raw: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [, m] = raw.split("-");
  const mNum = parseInt(m, 10);
  if (mNum < 1 || mNum > 12) return null;
  return raw;
}

// ---------------------------------------------------------------------------
// GET /api/mobile/spending?month=YYYY-MM
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const monthParam = req.nextUrl.searchParams.get("month");
  let month: string;

  if (monthParam !== null) {
    const parsed = parseMonthParam(monthParam);
    if (!parsed) {
      return NextResponse.json(
        { error: "invalid_param", details: "month must be in YYYY-MM format" },
        { status: 400 },
      );
    }
    month = parsed;
  } else {
    month = currentNYMonth();
  }

  try {
    const result = await getSpendingData(month);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/mobile/spending] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
