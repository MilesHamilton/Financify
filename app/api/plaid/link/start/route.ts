import { NextRequest, NextResponse } from "next/server";
import { errInfo } from "@/lib/log-error";
import { z } from "zod";
import { auth } from "../../../../../auth";
import { plaidClient } from "@/lib/plaid";
import { CountryCode, Products } from "plaid";

// Node runtime required — plaid SDK (axios-based) does not run on Edge.
// TR.md § 1.2 / TR.md § 3 architecture decisions.
export const runtime = "nodejs";

// Response schema — only hosted_link_url is sent to the client.
// link_token is intentionally excluded per TR.md § 1.2 ("Does NOT return: link_token").
const responseSchema = z.object({
  hosted_link_url: z.string().url(),
});

export async function POST(_req: NextRequest): Promise<NextResponse> {
  // Auth-gate: defense in depth behind middleware (FR-004, TR § 1.2).
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Validate required env vars before hitting Plaid.
  const webhookUrl = process.env.PLAID_WEBHOOK_URL;
  const redirectUri = process.env.PLAID_REDIRECT_URI;
  const appBaseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_BASE_URL;

  if (!webhookUrl) {
    console.error("[link/start] Missing required env var: PLAID_WEBHOOK_URL");
    return NextResponse.json(
      { error: "link_token_create_failed" },
      { status: 500 },
    );
  }

  if (!redirectUri) {
    console.error("[link/start] Missing required env var: PLAID_REDIRECT_URI");
    return NextResponse.json(
      { error: "link_token_create_failed" },
      { status: 500 },
    );
  }

  // completion_redirect_uri: spec (integration-layer.md § Flow 1) shows
  // "https://financify.vercel.app/linked". Derive from APP_BASE_URL env if
  // available, otherwise fall back to a path-only value that Plaid will
  // reject — this surfaces a clear misconfiguration error at startup rather
  // than a silent wrong redirect.
  const completionRedirectUri = appBaseUrl
    ? `${appBaseUrl}/linked`
    : `${redirectUri.replace("/plaid/oauth-return", "")}/linked`;

  try {
    // linkTokenCreate params — all fields required by FR-008 / TR § 1.2 / integration-layer.md § Flow 1.
    //
    // Note on options.personal_finance_category_version: FR-008 specifies this field,
    // but the Plaid Node SDK's LinkTokenCreateRequest type does not expose an `options`
    // object with this key. The v2 taxonomy pin is applied at /transactions/sync time
    // via TransactionsSyncRequest options.personal_finance_category_version (FR-015).
    // Customers onboarded after December 2025 receive v2 by default (TR § 3).
    const response = await plaidClient.linkTokenCreate({
      client_name: "Financify",
      user: {
        client_user_id: "miles",
      },
      products: [Products.Transactions],
      transactions: {
        days_requested: 730,
      },
      hosted_link: {
        url_lifetime_seconds: 1800,
        completion_redirect_uri: completionRedirectUri,
        is_mobile_app: false,
      },
      webhook: webhookUrl,
      redirect_uri: redirectUri,
      country_codes: [CountryCode.Us],
      language: "en",
    });

    const hostedLinkUrl = response.data.hosted_link_url;

    if (!hostedLinkUrl) {
      console.error(
        "[link/start] Plaid response missing hosted_link_url",
        { request_id: response.data.request_id },
      );
      return NextResponse.json(
        { error: "link_token_create_failed" },
        { status: 502 },
      );
    }

    // Zod-validate the outbound response shape before returning.
    const parsed = responseSchema.parse({ hosted_link_url: hostedLinkUrl });

    return NextResponse.json(parsed, { status: 200 });
  } catch (err: unknown) {
    // Distinguish Plaid API errors (axios response with error body) from
    // unexpected errors. Log request_id for Plaid support; never log tokens.
    if (isPlaidError(err)) {
      console.error("[link/start] Plaid API error", {
        error_type: err.response.data.error_type,
        error_code: err.response.data.error_code,
        request_id: err.response.data.request_id,
        display_message: err.response.data.display_message,
      });
      return NextResponse.json(
        { error: "link_token_create_failed" },
        { status: 502 },
      );
    }

    console.error("[link/start] Unexpected error during linkTokenCreate", errInfo(err));
    return NextResponse.json(
      { error: "link_token_create_failed" },
      { status: 500 },
    );
  }
}

// Plaid SDK throws axios errors; the structured error body lives at
// err.response.data when the request reached Plaid.
interface PlaidErrorResponse {
  response: {
    data: {
      error_type: string;
      error_code: string;
      error_message: string;
      display_message: string | null;
      request_id: string;
    };
  };
}

function isPlaidError(err: unknown): err is PlaidErrorResponse {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as PlaidErrorResponse).response === "object" &&
    (err as PlaidErrorResponse).response !== null &&
    "data" in (err as PlaidErrorResponse).response &&
    typeof (err as PlaidErrorResponse).response.data === "object" &&
    "error_code" in (err as PlaidErrorResponse).response.data
  );
}
