import { NextRequest, NextResponse } from "next/server";
import { errInfo } from "@/lib/log-error";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "../../../auth";
import { db } from "@/db/index";
import { budgets } from "@/db/schema";
import { sql } from "drizzle-orm";
import { currentNYMonth } from "@/domain/metrics";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Returns the first day of the current month as a "YYYY-MM-DD" string,
 * computed in America/New_York time via currentNYMonth().
 *
 * Fixes: 8pm–midnight ET month-attribution drift where UTC-based getUTCMonth()
 * would attribute transactions to the wrong month during those hours (FRD AC-7).
 */
function currentMonthFirstDay(): string {
  return `${currentNYMonth()}-01`;
}

/**
 * Converts a "YYYY-MM" param to the first-day-of-month "YYYY-MM-DD" string.
 * Returns null if the format is invalid.
 */
function parseMonthParam(raw: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(raw)) return null;
  const [y, m] = raw.split("-");
  // Validate month range
  const mNum = parseInt(m, 10);
  if (mNum < 1 || mNum > 12) return null;
  return `${y}-${m}-01`;
}

// ---------------------------------------------------------------------------
// POST body schema (FR-035, TR § 1.8)
//
// - categoryId: required, non-empty string
// - amount: number >= 0 (stored as numeric(14,2))
// - effectiveMonth: optional YYYY-MM-DD string that must be a first-of-month;
//   defaults to the first day of the current month when omitted.
//   TR § 1.8 specifies "YYYY-MM-DD | undefined" for this field.
// ---------------------------------------------------------------------------

const postBodySchema = z.object({
  categoryId: z.string().min(1),
  amount: z.number().min(0),
  effectiveMonth: z
    .string()
    .regex(
      /^\d{4}-\d{2}-01$/,
      "effectiveMonth must be a first-of-month date in YYYY-MM-DD format (day must be 01)",
    )
    .optional(),
});

// ---------------------------------------------------------------------------
// GET /api/budgets
//
// Returns the currently-effective budget per category for a target month.
// "Effective" = the row with the latest effective_month <= target month.
// (FR-034, abstraction-layer.md § Budgets, TR § 1.8)
//
// Query param: ?month=YYYY-MM  (optional; defaults to current month)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Resolve target month
  const monthParam = req.nextUrl.searchParams.get("month");
  let targetDay: string;

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
    targetDay = parsed;
  } else {
    targetDay = currentMonthFirstDay();
  }

  // For each category, find the single row with the highest effective_month
  // that is <= targetDay — this is the "effective budget" semantics from
  // FR-034 and abstraction-layer.md:
  //   SELECT DISTINCT ON (category_id) category_id, amount, effective_month
  //   FROM budgets
  //   WHERE effective_month <= $targetDay
  //   ORDER BY category_id, effective_month DESC
  //
  // Drizzle does not have a built-in DISTINCT ON, so we use a raw sql
  // template for the query. The result type is inferred from the columns.
  const rows = await db.execute(
    sql`
      SELECT DISTINCT ON (category_id)
        category_id   AS "categoryId",
        amount        AS "amount",
        effective_month AS "effectiveMonth"
      FROM budgets
      WHERE effective_month <= ${targetDay}
      ORDER BY category_id, effective_month DESC
    `,
  );

  const result = (rows as unknown as Array<{
    categoryId: string;
    amount: string;
    effectiveMonth: string;
  }>);

  return NextResponse.json({ budgets: result }, { status: 200 });
}

// ---------------------------------------------------------------------------
// POST /api/budgets
//
// Inserts a new budget row — never overwrites an existing row (FR-035).
// Budget history is preserved: each change appends a new row.
//
// On UNIQUE(category_id, effective_month) conflict → 409.
// On success → revalidatePath('/spending') (TR § 1.8 / FR-028).
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse and validate body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", details: "Request body must be valid JSON" },
      { status: 400 },
    );
  }

  const parseResult = postBodySchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        details: parseResult.error.issues,
      },
      { status: 400 },
    );
  }

  const { categoryId, amount, effectiveMonth } = parseResult.data;

  // Default effectiveMonth to first day of current month (FR-035)
  const resolvedEffectiveMonth = effectiveMonth ?? currentMonthFirstDay();

  // Format amount as a fixed-precision string for numeric(14,2) storage.
  const amountStr = amount.toFixed(2);

  try {
    const [inserted] = await db
      .insert(budgets)
      .values({
        categoryId,
        amount: amountStr,
        effectiveMonth: resolvedEffectiveMonth,
      })
      .returning({
        id: budgets.id,
        categoryId: budgets.categoryId,
        amount: budgets.amount,
        effectiveMonth: budgets.effectiveMonth,
      });

    revalidatePath("/spending");

    return NextResponse.json(inserted, { status: 201 });
  } catch (err: unknown) {
    // Postgres unique-constraint violation code: 23505
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        {
          error: "conflict",
          details: `A budget for category "${categoryId}" on effective_month "${resolvedEffectiveMonth}" already exists. To change the budget, post a new row with a later effective_month.`,
        },
        { status: 409 },
      );
    }

    // FK violation (category_id does not exist): 23503
    if (isForeignKeyViolation(err)) {
      return NextResponse.json(
        {
          error: "invalid_request",
          details: `Category "${categoryId}" does not exist.`,
        },
        { status: 400 },
      );
    }

    console.error("[POST /api/budgets] Unexpected error", errInfo(err));
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// DB error helpers
// ---------------------------------------------------------------------------

interface DbError {
  code: string;
}

function isDbError(err: unknown): err is DbError {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    typeof (err as DbError).code === "string"
  );
}

function isUniqueViolation(err: unknown): boolean {
  return isDbError(err) && err.code === "23505";
}

function isForeignKeyViolation(err: unknown): boolean {
  return isDbError(err) && err.code === "23503";
}
