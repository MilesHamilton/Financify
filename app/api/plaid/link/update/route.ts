import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { auth } from "../../../../../auth";
import { db } from "@/db/index";
import { items } from "@/db/schema";
import { plaidClient } from "@/lib/plaid";
import { decryptToken } from "@/lib/crypto";
import { CountryCode } from "plaid";

export const runtime = "nodejs";

const bodySchema = z.object({
  itemId: z.string().min(1),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth gate
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse and validate body
  let parsed: z.infer<typeof bodySchema>;
  try {
    const raw: unknown = await request.json();
    parsed = bodySchema.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  // Load the items row
  const [row] = await db
    .select()
    .from(items)
    .where(eq(items.id, parsed.itemId))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Decrypt access token — only in server memory, never logged or returned
  let accessToken: string;
  try {
    accessToken = decryptToken(row.accessTokenEnc);
  } catch (err) {
    console.error("[plaid/link/update] token decrypt failed", {
      itemId: parsed.itemId,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 },
    );
  }

  // Call Plaid /link/token/create in update mode (FR-010, Flow 4)
  // - access_token: the existing decrypted token (triggers update mode)
  // - products: [] (MUST be empty in update mode per spec)
  // - No hosted_link.url_lifetime_seconds or completion_redirect_uri override needed;
  //   pass an empty hosted_link object to get the hosted_link_url back
  // - redirect_uri still required: institutions are OAuth-based (Amex, SoFi)
  // - webhook has no effect in update mode per Plaid docs, but included per spec
  let hostedLinkUrl: string;
  try {
    const response = await plaidClient.linkTokenCreate({
      client_name: "Financify",
      language: "en",
      country_codes: [CountryCode.Us],
      user: { client_user_id: "miles" },
      access_token: accessToken,
      products: [],
      webhook: process.env.PLAID_WEBHOOK_URL,
      redirect_uri: process.env.PLAID_REDIRECT_URI,
      hosted_link: {},
    });

    const url = response.data.hosted_link_url;
    if (!url) {
      console.error("[plaid/link/update] Plaid response missing hosted_link_url", {
        itemId: parsed.itemId,
        requestId: response.data.request_id,
      });
      return NextResponse.json(
        { error: "link_token_create_failed" },
        { status: 502 },
      );
    }
    hostedLinkUrl = url;
  } catch (err) {
    const plaidError = (err as { response?: { data?: { error_code?: string; request_id?: string } } })
      ?.response?.data;
    console.error("[plaid/link/update] Plaid linkTokenCreate failed", {
      itemId: parsed.itemId,
      error_code: plaidError?.error_code,
      request_id: plaidError?.request_id,
      message: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "link_token_create_failed" },
      { status: 502 },
    );
  }

  return NextResponse.json({ hosted_link_url: hostedLinkUrl });
}
