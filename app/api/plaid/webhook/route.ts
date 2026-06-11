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
import { handleSessionFinished } from "@/lib/link-session";
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

      // Plaid delivers this value lowercase ("success") despite docs showing
      // "SUCCESS" — compare case-insensitively or every session is dropped.
      if (status.toUpperCase() !== "SUCCESS") {
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
                // Recovery breadcrumb: lets an operator re-run the exchange
                // via /link/token/get while the session is still fresh.
                link_token,
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
          await handleSessionFinished(
            link_token,
            link_session_id,
            parsed.public_tokens,
          );
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
                link_token,
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

