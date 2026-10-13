import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/api-auth";
import { errInfo } from "@/lib/log-error";
import { getMobileTransactionsData } from "@/domain/mobile";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "month must be in YYYY-MM format")
    .optional(),
  category: z.string().optional(),
  account: z.string().optional(),
  cursor: z.string().optional(),
});

// ---------------------------------------------------------------------------
// GET /api/mobile/transactions?q=&month=&category=&account=&cursor=
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const parsed = querySchema.safeParse({
    q: sp.get("q") ?? undefined,
    month: sp.get("month") ?? undefined,
    category: sp.get("category") ?? undefined,
    account: sp.get("account") ?? undefined,
    cursor: sp.get("cursor") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_param", details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await getMobileTransactionsData(parsed.data);
    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/mobile/transactions] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
