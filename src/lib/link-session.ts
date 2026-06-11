import "server-only";

import { plaidClient } from "@/lib/plaid";
import { encryptToken } from "@/lib/crypto";
import { syncItem } from "@/lib/sync";
import { db } from "@/db";
import { items, accounts, syncEvents } from "@/db/schema";

/**
 * Handles a successful Plaid Hosted Link SESSION_FINISHED (FR-009).
 * Shared by the webhook route (normal path) and the admin recovery route.
 *
 * Steps:
 * 1. Call /link/token/get to retrieve session metadata (public_token, institution).
 * 2. Exchange the public_token for {access_token, item_id}.
 * 3. Encrypt the access_token (AES-256-GCM).
 * 4. INSERT the items row (ON CONFLICT DO NOTHING for idempotency).
 * 5. Fetch accounts via /accounts/get and upsert into the accounts table.
 * 6. Insert a sync_events audit row.
 * 7. Call syncItem() for the initial backfill.
 */
export async function handleSessionFinished(
  linkToken: string,
  linkSessionId: string,
  webhookPublicTokens?: string[],
): Promise<void> {
  // ── 1. Fetch session metadata from Plaid ──────────────────────────────
  const tokenGetResp = await plaidClient.linkTokenGet({ link_token: linkToken });
  const tokenGetData = tokenGetResp.data;

  // Find the matching session in the response (may be the only entry).
  const sessions = tokenGetData.link_sessions ?? [];
  const matchedSession =
    sessions.find((s) => s.link_session_id === linkSessionId) ?? sessions[0];

  // Modern API shape: results.item_add_results[] (on_success is legacy-only
  // and null for new integrations — reading only it strands every session).
  const itemAdd = matchedSession?.results?.item_add_results?.[0];
  const onSuccess = matchedSession?.on_success;

  // public_token resolution order: item_add_results → legacy on_success →
  // the SESSION_FINISHED webhook's own public_tokens[] (final fallback).
  const publicToken =
    itemAdd?.public_token ??
    onSuccess?.public_token ??
    webhookPublicTokens?.[0];

  if (!publicToken) {
    throw new Error(
      `SESSION_FINISHED: no public_token found for session ${linkSessionId}`,
    );
  }

  // Institution metadata — best-effort across both shapes.
  const institution = itemAdd?.institution ?? onSuccess?.metadata?.institution;
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
