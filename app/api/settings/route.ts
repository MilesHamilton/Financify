import { NextRequest, NextResponse } from "next/server";
import { errInfo } from "@/lib/log-error";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { db } from "@/db/index";
import { appSettings } from "@/db/schema";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// GET /api/settings
//
// Returns the single app_settings row. If no row has been seeded yet,
// returns the column defaults so callers never see a 404.
// ---------------------------------------------------------------------------

export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const rows = await db
      .select({
        monthlySavingsTarget: appSettings.monthlySavingsTarget,
        monthlyIncomeOverride: appSettings.monthlyIncomeOverride,
      })
      .from(appSettings)
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        { monthlySavingsTarget: "0.00", monthlyIncomeOverride: null },
        { status: 200 },
      );
    }

    return NextResponse.json(rows[0], { status: 200 });
  } catch (err: unknown) {
    console.error("[GET /api/settings] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT /api/settings
//
// Partial update via upsert on the single 'app' row.
// Both fields are optional — only supplied fields are written.
// ---------------------------------------------------------------------------

const bodySchema = z.object({
  monthlySavingsTarget: z.number().min(0).optional(),
  monthlyIncomeOverride: z.number().min(0).nullable().optional(),
});

export async function PUT(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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

  const data = parsed.data;

  // Build the insert values object — id is always "app".
  const values: {
    id: "app";
    monthlySavingsTarget?: string;
    monthlyIncomeOverride?: string | null;
  } = { id: "app" };

  if (data.monthlySavingsTarget !== undefined) {
    values.monthlySavingsTarget = data.monthlySavingsTarget.toFixed(2);
  }
  if (data.monthlyIncomeOverride !== undefined) {
    values.monthlyIncomeOverride =
      data.monthlyIncomeOverride === null
        ? null
        : data.monthlyIncomeOverride.toFixed(2);
  }

  // Build the conflict-update set — always bump updatedAt; only touch
  // the fields that were actually provided.
  const conflictSet: {
    updatedAt: Date;
    monthlySavingsTarget?: string;
    monthlyIncomeOverride?: string | null;
  } = { updatedAt: new Date() };

  if (values.monthlySavingsTarget !== undefined) {
    conflictSet.monthlySavingsTarget = values.monthlySavingsTarget;
  }
  if (data.monthlyIncomeOverride !== undefined) {
    conflictSet.monthlyIncomeOverride = values.monthlyIncomeOverride;
  }

  try {
    await db
      .insert(appSettings)
      .values(values)
      .onConflictDoUpdate({ target: appSettings.id, set: conflictSet });

    const [updated] = await db
      .select({
        monthlySavingsTarget: appSettings.monthlySavingsTarget,
        monthlyIncomeOverride: appSettings.monthlyIncomeOverride,
      })
      .from(appSettings)
      .limit(1);

    revalidatePath("/budget");
    revalidatePath("/spending");

    return NextResponse.json(updated, { status: 200 });
  } catch (err: unknown) {
    console.error("[PUT /api/settings] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
