import { auth } from "../../../../auth";
import { db } from "@/db";
import { transactions } from "@/db/schema";
import { createUpdateSchema } from "drizzle-zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Derive a fully-optional update schema from the transactions table, then
// pick only the three user-editable fields (FR-024). `.strict()` rejects any
// key not in the pick set, satisfying the "reject unknown fields" requirement.
const patchSchema = createUpdateSchema(transactions)
  .pick({ categoryId: true, isExcluded: true, note: true })
  .strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth gate — 401 if no session.
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Parse and validate the request body.
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request", details: ["Body must be valid JSON"] }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const { categoryId, isExcluded, note } = parsed.data;

  // Build the update payload. category_source is set to 'user' whenever
  // category_id is present in the patch (FR-024).
  const updatePayload: Partial<typeof transactions.$inferInsert> = {};

  if (categoryId !== undefined) {
    updatePayload.categoryId = categoryId;
    updatePayload.categorySource = "user";
  }
  if (isExcluded !== undefined) {
    updatePayload.isExcluded = isExcluded;
  }
  if (note !== undefined) {
    updatePayload.note = note;
  }

  // Nothing to update (all fields omitted) — still a valid no-op; return
  // the existing row by doing a lookup, or simply 404-check and return success.
  const rows = await db
    .update(transactions)
    .set(updatePayload)
    .where(eq(transactions.id, id))
    .returning({
      id: transactions.id,
      accountId: transactions.accountId,
      amount: transactions.amount,
      date: transactions.date,
      pending: transactions.pending,
      name: transactions.name,
      merchantName: transactions.merchantName,
      categoryId: transactions.categoryId,
      categorySource: transactions.categorySource,
      isExcluded: transactions.isExcluded,
      note: transactions.note,
    });

  if (rows.length === 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  revalidatePath("/transactions");
  revalidatePath("/");

  return NextResponse.json({ success: true });
}
