/**
 * POST /api/plaid/webhook
 *
 * The highest-stakes route in the app. Receives all Plaid webhook deliveries.
 *
 * Security model: ES256 JWT verification (FR-019) is non-negotiable. The only
 * non-200 response this route ever returns is 401 on verification failure.
 * Every verified webhook — including ones that trigger downstream errors —
 * returns 200 (FR-020, ack-fast doctrine). Plaid stops delivery to endpoints
 * that reject >90% of webhooks over 24 h.
 *
 * References: FRS FR-009, FR-013, FR-014, FR-018, FR-019, FR-020
 *             TR.md § 1.3, § 4.2
 *             runtime-execution.md § Process Lifecycle (webhook receive)
 *             integration-layer.md § Flow 2, Flow 3
 */

import { after } from "next/server";
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { verifyWebhook } from "@/lib/webhook-verify";
import { parseWebhook } from "@/lib/webhooks-schema";
import { plaidClient, plaidEnv } from "@/lib/plaid";
import { encryptToken } from "@/lib/crypto";
import { syncItem } from "@/lib/sync";
import { db } from "@/db/index";
import { items, accounts, syncEvents } from "@/db/schema";

// ── Route configuration (FR-014) ────────────────────────────────────────────
export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// ── Plaid axios-error type guard (mirrors pattern from link/start/route.ts) ─
interface PlaidErrorShape {
  response: {
    data: {
      error_type: string;
      error_code: string;
      error_message?: string;
      display_message?: string | null;
      request_id?: string;
    };
  };
}

function isPlaidError(err: unknown): err is PlaidErrorShape {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    typeof (err as PlaidErrorShape).response === "object" &&
    (err as PlaidErrorShape).response !== null &&
    "data" in (err as PlaidErrorShape).response &&
    typeof (err as PlaidErrorShape).response.data === "object" &&
    "error_code" in (err as PlaidErrorShape).response.data
  );
}

// ── Main handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Read raw body BEFORE any JSON parse (TR § 4.2 step 1) ──────
  const rawBody = await request.text();

  // ── Step 2–7: Full ES256 JWT verification (delegated to verifyWebhook) ──
  // verifyWebhook also checks for missing header (returns false → 401).
  const verified = await verifyWebhook(
    rawBody,
    request.headers.get("plaid-verification"),
  );

  if (!verified) {
    // 401 is the ONLY non-200 response this route may return (FR-019, FR-020).
    console.error({
      msg: "webhook_rejected",
      reason: "verification_failed",
      path: "/api/plaid/webhook",
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Step 8: Parse JSON + Zod-discriminate (TR § 4.2 step 8) ────────────
  // Post-verification malformed JSON: log + 200 (FR-019 step 8 intent).
  let parsed: ReturnType<typeof parseWebhook>;
  try {
    const json: unknown = JSON.parse(rawBody);
    parsed = parseWebhook(json);
  } catch (err) {
    console.error({
      msg: "webhook_parse_error",
      reason: "json_or_schema_parse_failed",
      err,
    });
    // FR-019: malformed post-verification payload → log + 200.
    return NextResponse.json({}, { status: 200 });
  }

  // ── Step 9: Environment check (TR § 4.2 step 9) ─────────────────────────
  // For the `unknown` catch-all kind, `environment` may not be present; only
  // check when the field is actually a string.
  const payloadEnv =
    "environment" in parsed && typeof parsed.environment === "string"
      ? parsed.environment
      : null;

  if (payloadEnv !== null && payloadEnv !== plaidEnv) {
    console.error({
      msg: "webhook_rejected",
      reason: "environment_mismatch",
      payload_env: payloadEnv,
      expected_env: plaidEnv,
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Ack fast: respond 200 before all after() work begins (FR-013, FR-020) ─
  // All remaining work runs inside after(), which is backed by Vercel
  // waitUntil and bounded by maxDuration = 300 s. The 200 is sent before
  // any sync/DB work so Plaid's 10-second deadline is never threatened.

  const kind = parsed.kind;

  switch (kind) {
    // ── TRANSACTIONS / SYNC_UPDATES_AVAILABLE ───────────────────────────
    case "sync_updates_available": {
      const itemId = parsed.item_id;
      after(async () => {
        try {
          await db.insert(syncEvents).values({
            itemId,
            kind: "webhook",
            payload: {
              webhook_type: parsed.webhook_type,
              webhook_code: parsed.webhook_code,
              initial_update_complete: parsed.initial_update_complete,
              historical_update_complete: parsed.historical_update_complete,
            },
          });
        } catch (err) {
          console.error({ msg: "sync_events_insert_failed", itemId, err });
        }
        await syncItem(itemId);
      });
      break;
    }

    // ── LINK / SESSION_FINISHED ─────────────────────────────────────────
    // FR-009: only act when status === 'SUCCESS'.
    case "link_session_finished": {
      const { link_token, link_session_id, status } = parsed;

      if (status !== "SUCCESS") {
        // Non-success sessions (EXIT, ERROR) — log for audit, no token exchange.
        after(async () => {
          try {
            await db.insert(syncEvents).values({
              itemId: null,
              kind: "webhook",
              payload: {
                webhook_type: parsed.webhook_type,
                webhook_code: parsed.webhook_code,
                link_session_id,
                status,
              },
            });
          } catch (err) {
            console.error({
              msg: "sync_events_insert_failed",
              link_session_id,
              err,
            });
          }
        });
        break;
      }

      // Successful session — full token-exchange flow runs post-response.
      after(async () => {
        try {
          await handleSessionFinished(link_token, link_session_id);
        } catch (err) {
          // Top-level catch: log fully, never re-throw. Data recovery is the
          // cron's job; a crash here must not surface as a 5xx to Plaid.
          console.error({
            msg: "session_finished_handler_failed",
            link_session_id,
            err,
          });
          // Audit row so the failure is visible even when the handler threw.
          try {
            await db.insert(syncEvents).values({
              itemId: null,
              kind: "webhook",
              payload: {
                webhook_type: "LINK",
                webhook_code: "SESSION_FINISHED",
                link_session_id,
                status: "handler_error",
                error: err instanceof Error ? err.message : String(err),
              },
            });
          } catch {
            // Ignore secondary DB failure — already lost.
          }
        }
      });
      break;
    }

    // ── ITEM / ERROR ─────────────────────────────────────────────────────
    // FR-018: ITEM_LOGIN_REQUIRED → status='login_required'
    case "item_error": {
      const itemId = parsed.item_id;
      const errorCode = parsed.error.error_code;
      after(async () => {
        try {
          if (errorCode === "ITEM_LOGIN_REQUIRED") {
            await db
              .update(items)
              .set({ status: "login_required", updatedAt: new Date() })
              .where(eq(items.id, itemId));
          }
          await db.insert(syncEvents).values({
            itemId,
            kind: "webhook",
            payload: {
              webhook_type: parsed.webhook_type,
              webhook_code: parsed.webhook_code,
              error_code: errorCode,
              error_type: parsed.error.error_type,
            },
          });
        } catch (err) {
          console.error({ msg: "item_error_handler_failed", itemId, err });
        }
      });
      break;
    }

    // ── ITEM / PENDING_DISCONNECT ────────────────────────────────────────
    // FR-018: → status='pending_disconnect'
    case "item_pending_disconnect": {
      const itemId = parsed.item_id;
      after(async () => {
        try {
          await db
            .update(items)
            .set({ status: "pending_disconnect", updatedAt: new Date() })
            .where(eq(items.id, itemId));
          await db.insert(syncEvents).values({
            itemId,
            kind: "webhook",
            payload: {
              webhook_type: parsed.webhook_type,
              webhook_code: parsed.webhook_code,
              reason: parsed.reason ?? null,
            },
          });
        } catch (err) {
          console.error({
            msg: "item_pending_disconnect_handler_failed",
            itemId,
            err,
          });
        }
      });
      break;
    }

    // ── ITEM / USER_PERMISSION_REVOKED ───────────────────────────────────
    // FR-018: → status='revoked'
    case "item_user_permission_revoked": {
      const itemId = parsed.item_id;
      after(async () => {
        try {
          await db
            .update(items)
            .set({ status: "revoked", updatedAt: new Date() })
            .where(eq(items.id, itemId));
          await db.insert(syncEvents).values({
            itemId,
            kind: "webhook",
            payload: {
              webhook_type: parsed.webhook_type,
              webhook_code: parsed.webhook_code,
            },
          });
        } catch (err) {
          console.error({
            msg: "item_user_permission_revoked_handler_failed",
            itemId,
            err,
          });
        }
      });
      break;
    }

    // ── ITEM / LOGIN_REPAIRED ────────────────────────────────────────────
    // FR-018: → status='active'
    case "item_login_repaired": {
      const itemId = parsed.item_id;
      after(async () => {
        try {
          await db
            .update(items)
            .set({ status: "active", updatedAt: new Date() })
            .where(eq(items.id, itemId));
          await db.insert(syncEvents).values({
            itemId,
            kind: "webhook",
            payload: {
              webhook_type: parsed.webhook_type,
              webhook_code: parsed.webhook_code,
            },
          });
        } catch (err) {
          console.error({
            msg: "item_login_repaired_handler_failed",
            itemId,
            err,
          });
        }
      });
      break;
    }

    // ── ITEM / NEW_ACCOUNTS_AVAILABLE ────────────────────────────────────
    // FR-018: log to sync_events; no other action in v1.
    case "item_new_accounts_available": {
      const itemId = parsed.item_id;
      after(async () => {
        try {
          await db.insert(syncEvents).values({
            itemId,
            kind: "webhook",
            payload: {
              webhook_type: parsed.webhook_type,
              webhook_code: parsed.webhook_code,
            },
          });
        } catch (err) {
          console.error({
            msg: "item_new_accounts_available_handler_failed",
            itemId,
            err,
          });
        }
      });
      break;
    }

    // ── ITEM / WEBHOOK_UPDATE_ACKNOWLEDGED ───────────────────────────────
    // FR-018: log to sync_events.
    case "item_webhook_update_acknowledged": {
      const itemId = parsed.item_id;
      after(async () => {
        try {
          await db.insert(syncEvents).values({
            itemId,
            kind: "webhook",
            payload: {
              webhook_type: parsed.webhook_type,
              webhook_code: parsed.webhook_code,
            },
          });
        } catch (err) {
          console.error({
            msg: "item_webhook_update_acknowledged_handler_failed",
            itemId,
            err,
          });
        }
      });
      break;
    }

    // ── Unknown / unrecognized webhook code ──────────────────────────────
    // Never return 4xx/5xx for unknown codes — Plaid disables delivery at
    // >90% rejection. Log and audit-insert only.
    case "unknown":
    default: {
      const webhookType =
        "webhook_type" in parsed ? String(parsed.webhook_type) : "unknown";
      const webhookCode =
        "webhook_code" in parsed ? String(parsed.webhook_code) : "unknown";
      console.log({
        msg: "webhook_unrecognized",
        webhook_type: webhookType,
        webhook_code: webhookCode,
      });
      after(async () => {
        try {
          await db.insert(syncEvents).values({
            itemId: null,
            kind: "webhook",
            payload: {
              webhook_type: webhookType,
              webhook_code: webhookCode,
            },
          });
        } catch (err) {
          console.error({ msg: "sync_events_insert_failed_unknown", err });
        }
      });
      break;
    }
  }

  return NextResponse.json({}, { status: 200 });
}

// ── SESSION_FINISHED helper ──────────────────────────────────────────────────
/**
 * Handles a successful Plaid Hosted Link SESSION_FINISHED webhook (FR-009).
 *
 * Runs entirely inside after() — never on the hot path. Steps:
 * 1. Call /link/token/get to retrieve session metadata (public_token, institution).
 * 2. Exchange the public_token for {access_token, item_id}.
 * 3. Encrypt the access_token (AES-256-GCM).
 * 4. INSERT the items row (ON CONFLICT DO NOTHING for idempotency).
 * 5. Fetch accounts via /accounts/get and upsert into the accounts table.
 * 6. Insert a sync_events audit row.
 * 7. Call syncItem() for the initial backfill.
 */
async function handleSessionFinished(
  linkToken: string,
  linkSessionId: string,
): Promise<void> {
  // ── 1. Fetch session metadata from Plaid ──────────────────────────────
  const tokenGetResp = await plaidClient.linkTokenGet({ link_token: linkToken });
  const tokenGetData = tokenGetResp.data;

  // Find the matching session in the response (may be the only entry).
  const sessions = tokenGetData.link_sessions ?? [];
  const matchedSession = sessions.find(
    (s) => s.link_session_id === linkSessionId,
  );

  // Plaid's on_success carries public_token + institution metadata.
  const onSuccess = matchedSession?.on_success;

  // Extract the public_token. The SESSION_FINISHED webhook payload also
  // carries public_tokens[] directly; fall through to that if linkTokenGet
  // does not surface it (timing edge case).
  const publicToken = onSuccess?.public_token;

  if (!publicToken) {
    throw new Error(
      `SESSION_FINISHED: no public_token found for session ${linkSessionId}`,
    );
  }

  // Institution metadata — best-effort from session success metadata.
  const institution = onSuccess?.metadata?.institution;
  const institutionId = institution?.institution_id ?? "unknown";
  const institutionName = institution?.name ?? "Unknown Institution";

  // ── 2. Exchange public_token → {access_token, item_id} ───────────────
  const exchangeResp = await plaidClient.itemPublicTokenExchange({
    public_token: publicToken,
  });
  const { access_token: plainAccessToken, item_id: itemId } =
    exchangeResp.data;

  // ── 3. Encrypt the access_token before it ever touches the DB ─────────
  const accessTokenEnc = encryptToken(plainAccessToken);

  // ── 4. INSERT items row ───────────────────────────────────────────────
  // ON CONFLICT DO NOTHING ensures webhook retries are fully idempotent.
  // The items row uses id=item_id (Plaid's item_id) as the PK per TR § 2.1.
  await db
    .insert(items)
    .values({
      id: itemId,
      accessTokenEnc,
      institutionId,
      institutionName,
      status: "active",
      syncStatus: "IDLE",
      transactionsCursor: null,
      initialUpdateComplete: false,
      historicalUpdateComplete: false,
    })
    .onConflictDoNothing();

  // ── 5. Fetch accounts and upsert ─────────────────────────────────────
  const accountsResp = await plaidClient.accountsGet({
    access_token: plainAccessToken,
  });

  // Each account is upserted individually. At item-link time there are
  // typically 1–5 accounts; N single-row upserts are negligible.
  for (const acct of accountsResp.data.accounts) {
    await db
      .insert(accounts)
      .values({
        id: acct.account_id,
        itemId,
        name: acct.name,
        officialName: acct.official_name ?? null,
        mask: acct.mask ?? null,
        type: String(acct.type),
        subtype: acct.subtype != null ? String(acct.subtype) : null,
        currentBalance:
          acct.balances.current != null
            ? String(acct.balances.current)
            : null,
        availableBalance:
          acct.balances.available != null
            ? String(acct.balances.available)
            : null,
        creditLimit:
          acct.balances.limit != null ? String(acct.balances.limit) : null,
        isoCurrencyCode: acct.balances.iso_currency_code ?? "USD",
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          name: acct.name,
          officialName: acct.official_name ?? null,
          mask: acct.mask ?? null,
          type: String(acct.type),
          subtype: acct.subtype != null ? String(acct.subtype) : null,
          currentBalance:
            acct.balances.current != null
              ? String(acct.balances.current)
              : null,
          availableBalance:
            acct.balances.available != null
              ? String(acct.balances.available)
              : null,
          creditLimit:
            acct.balances.limit != null
              ? String(acct.balances.limit)
              : null,
          isoCurrencyCode: acct.balances.iso_currency_code ?? "USD",
          updatedAt: new Date(),
        },
      });
  }

  // ── 6. Audit row ──────────────────────────────────────────────────────
  await db.insert(syncEvents).values({
    itemId,
    kind: "webhook",
    payload: {
      webhook_type: "LINK",
      webhook_code: "SESSION_FINISHED",
      link_session_id: linkSessionId,
      institution_id: institutionId,
      institution_name: institutionName,
      accounts_count: accountsResp.data.accounts.length,
    },
  });

  // ── 7. Initial backfill ───────────────────────────────────────────────
  await syncItem(itemId);
}
