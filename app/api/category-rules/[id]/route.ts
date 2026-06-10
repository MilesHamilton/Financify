/**
 * PUT /api/category-rules/:id — update an existing category rule
 *
 * TR § 1.7 defines GET, POST, PUT, and PUT apply for this resource.
 * No DELETE is specified — only the four listed operations are implemented.
 *
 * Auth: session cookie required (FR-025, TR § 1.7)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "../../../../auth";
import { db } from "@/db";
import { categoryRules } from "@/db/schema";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Validation schema — all fields optional for a partial update
// ---------------------------------------------------------------------------

/**
 * Condition fields that count toward the "at least one non-null" constraint.
 * On a PUT we only re-check this constraint if the caller explicitly clears
 * all condition fields; if the caller omits them, existing DB values remain.
 * Since we can't know the DB state without a query, we permit partial updates
 * freely and let the application maintain the invariant at creation time.
 * The same set is validated on PUT if ALL condition fields are supplied and
 * all are null (an explicit attempt to blank them all out is rejected).
 */
const CONDITION_FIELDS = [
  "merchantEntityId",
  "merchantNameLike",
  "accountId",
  "pfcDetailed",
  "pfcPrimary",
  "amountMin",
  "amountMax",
] as const;

const updateRuleSchema = z
  .object({
    merchantEntityId: z.string().min(1).nullable().optional(),
    merchantNameLike: z.string().min(1).nullable().optional(),
    accountId: z.string().min(1).nullable().optional(),
    pfcDetailed: z.string().min(1).nullable().optional(),
    pfcPrimary: z.string().min(1).nullable().optional(),
    amountMin: z
      .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().min(0)])
      .nullable()
      .optional()
      .transform((v) => (v != null ? String(v) : null)),
    amountMax: z
      .union([z.string().regex(/^\d+(\.\d{1,2})?$/), z.number().min(0)])
      .nullable()
      .optional()
      .transform((v) => (v != null ? String(v) : null)),
    setCategoryId: z.string().min(1).optional(),
    setExcluded: z.boolean().nullable().optional(),
    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Only reject if the caller explicitly sets EVERY condition field to null.
      const allExplicitlySet = CONDITION_FIELDS.every(
        (field) => field in data,
      );
      if (!allExplicitlySet) return true;
      return CONDITION_FIELDS.some((field) => data[field] != null);
    },
    {
      message:
        "At least one condition field must be non-null when all condition fields are provided",
      path: [],
    },
  );

// ---------------------------------------------------------------------------
// PUT /api/category-rules/:id
// ---------------------------------------------------------------------------

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", details: "Body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = updateRuleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  // Build the update payload — only include fields that were explicitly provided
  // by the caller (present in the raw body). This way omitted fields are not
  // overwritten with undefined/null.
  const data = parsed.data;
  const update: Partial<typeof categoryRules.$inferInsert> = {};

  if ("merchantEntityId" in data) update.merchantEntityId = data.merchantEntityId ?? null;
  if ("merchantNameLike" in data) update.merchantNameLike = data.merchantNameLike ?? null;
  if ("accountId" in data) update.accountId = data.accountId ?? null;
  if ("pfcDetailed" in data) update.pfcDetailed = data.pfcDetailed ?? null;
  if ("pfcPrimary" in data) update.pfcPrimary = data.pfcPrimary ?? null;
  if ("amountMin" in data) update.amountMin = data.amountMin ?? null;
  if ("amountMax" in data) update.amountMax = data.amountMax ?? null;
  if ("setCategoryId" in data && data.setCategoryId !== undefined) {
    update.setCategoryId = data.setCategoryId;
  }
  if ("setExcluded" in data) update.setExcluded = data.setExcluded ?? null;
  if ("priority" in data && data.priority !== undefined) {
    update.priority = data.priority;
  }
  if ("isActive" in data && data.isActive !== undefined) {
    update.isActive = data.isActive;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "invalid_request", details: "No updatable fields provided" },
      { status: 400 },
    );
  }

  try {
    const rows = await db
      .update(categoryRules)
      .set(update)
      .where(eq(categoryRules.id, id))
      .returning();

    if (rows.length === 0) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    return NextResponse.json(rows[0], { status: 200 });
  } catch (err: unknown) {
    if (isForeignKeyViolation(err)) {
      return NextResponse.json(
        {
          error: "invalid_request",
          details: "Referenced accountId or setCategoryId does not exist.",
        },
        { status: 400 },
      );
    }

    console.error("[PUT /api/category-rules/:id] Unexpected error", err);
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

function isForeignKeyViolation(err: unknown): boolean {
  return isDbError(err) && err.code === "23503";
}
