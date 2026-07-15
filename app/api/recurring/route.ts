import { NextRequest, NextResponse } from "next/server";
import { errInfo } from "@/lib/log-error";
import { auth } from "../../../auth";
import { currentNYMonth, getRecurringMonth } from "@/domain/metrics";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Validates a "YYYY-MM" month query parameter.
 * Returns the validated month string on success, or null if the format is
 * invalid — matching the parseMonthParam pattern used in /api/budgets.
 */
function parseMonthParam(raw: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [, m] = raw.split("-");
  const mNum = parseInt(m, 10);
  if (mNum < 1 || mNum > 12) return null;
  return raw;
}

// ---------------------------------------------------------------------------
// GET /api/recurring
//
// Returns the RecurringMonthResult for a given month: leftToPay, paidSoFar,
// upcoming bill streams (sorted by dueDate ASC), and paid bill streams
// (sorted by paidDate DESC). See TR §3.2 and FRD AC-4.
//
// Query param: ?month=YYYY-MM  (optional; defaults to current NY month)
// Auth-gated. Runtime: nodejs.
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Resolve target month
  const monthParam = req.nextUrl.searchParams.get("month");
  let month: string;

  if (monthParam !== null) {
    const parsed = parseMonthParam(monthParam);
    if (!parsed) {
      return NextResponse.json(
        {
          error: "invalid_param",
          details: "month must be in YYYY-MM format",
        },
        { status: 400 },
      );
    }
    month = parsed;
  } else {
    month = currentNYMonth();
  }

  try {
    const result = await getRecurringMonth(month);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/recurring] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
