/**
 * GET /api/category-rules  — list all rules, priority ASC
 * POST /api/category-rules — create a new category rule
 *
 * Auth: session cookie required (FR-025, TR § 1.7)
 */

import { NextRequest, NextResponse } from "next/server";
import { errInfo } from "@/lib/log-error";
import { z } from "zod";
import { auth } from "../../../auth";
import { db } from "@/db";
import { categoryRules } from "@/db/schema";

export const runtime = "nodejs";

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

/**
 * Condition fields from the category_rules table.
 * At least one must be non-null per FR-025 ("all non-NULL conditions match").
 * A rule with zero conditions would match every transaction, which is never
 * the intended behaviour for a user-created rule.
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

const createRuleSchema = z
  .object({
    merchantEntityId: z.string().min(1).nullable().optional(),
    merchantNameLike: z.string().min(1).nullable().optional(),
    accountId: z.string().min(1).nullable().optional(),
    pfcDetailed: z.string().min(1).nullable().optional(),
    pfcPrimary: z.string().min(1).nullable().optional(),
    // Numeric condition bounds — accept as strings (numeric(14,2)) or numbers.
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
    // Action fields
    setCategoryId: z.string().min(1),
    setExcluded: z.boolean().nullable().optional(),
    priority: z.number().int().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) =>
      CONDITION_FIELDS.some(
        (field) => data[field] != null,
      ),
    {
      message:
        "At least one condition field (merchantEntityId, merchantNameLike, accountId, pfcDetailed, pfcPrimary, amountMin, amountMax) must be non-null",
      path: [],
    },
  );

// ---------------------------------------------------------------------------
// GET /api/category-rules
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rules = await db
    .select()
    .from(categoryRules)
    .orderBy(categoryRules.priority);

  return NextResponse.json(rules, { status: 200 });
}

// ---------------------------------------------------------------------------
// POST /api/category-rules
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_request", details: "Body must be valid JSON" },
      { status: 400 },
    );
  }

  const parsed = createRuleSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const {
    merchantEntityId,
    merchantNameLike,
    accountId,
    pfcDetailed,
    pfcPrimary,
    amountMin,
    amountMax,
    setCategoryId,
    setExcluded,
    priority,
    isActive,
  } = parsed.data;

  try {
    const [created] = await db
      .insert(categoryRules)
      .values({
        priority: priority ?? 100,
        merchantEntityId: merchantEntityId ?? null,
        merchantNameLike: merchantNameLike ?? null,
        accountId: accountId ?? null,
        pfcDetailed: pfcDetailed ?? null,
        pfcPrimary: pfcPrimary ?? null,
        amountMin: amountMin ?? null,
        amountMax: amountMax ?? null,
        setCategoryId,
        setExcluded: setExcluded ?? null,
        isActive: isActive ?? true,
      })
      .returning();

    return NextResponse.json(created, { status: 201 });
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

    console.error("[POST /api/category-rules] Unexpected error", errInfo(err));
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
