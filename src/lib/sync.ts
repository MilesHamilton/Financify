import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  Transaction as PlaidTransaction,
  AccountBase,
  PersonalFinanceCategoryVersion,
  PlaidErrorType,
} from "plaid";

import { plaidClient } from "@/lib/plaid";
import { decryptToken } from "@/lib/crypto";
import { errInfo } from "@/lib/log-error";
import {
  loadCategorizationContext,
  resolveCategory,
  type CategorizationContext,
} from "@/lib/categorize";
import { db, getPool, getPoolDb } from "@/db";
import {
  items,
  accounts,
  transactions,
  accountBalanceSnapshots,
  syncEvents,
} from "@/db/schema";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Max pagination restarts on TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION. */
const MAX_MUTATION_RETRIES = 3;
/** Max re-loops when resync_requested is set after a successful apply. */
const MAX_RESYNCS = 2;
/** Plaid error code that forces a full loop restart. */
const MUTATION_ERROR = "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Transaction sync engine for a single Plaid Item.
 *
 * Implements FR-015, FR-016, TR § 3, runtime-execution.md § Sync Runner,
 * and abstraction-layer.md § Translation Mechanisms.
 *
 * @param itemId - Plaid item_id to sync.
 */
export async function syncItem(itemId: string): Promise<void> {
  for (let resyncs = 0; resyncs <= MAX_RESYNCS; resyncs++) {
    const ran = await runOnce(itemId);
    if (!ran) {
      // Lease not acquired — runOnce already set resync_requested=true.
      return;
    }

    // Atomically consume the resync flag — single conditional UPDATE so a
    // concurrent setter can never be silently cleared between a SELECT and
    // an UPDATE. Zero rows means no resync was requested.
    const consumed = await db.execute(sql`
      UPDATE items
         SET resync_requested = false, updated_at = now()
       WHERE id = ${itemId} AND resync_requested = true
      RETURNING id
    `);
    if ((consumed.rows?.length ?? 0) === 0) {
      return;
    }
    // Flag consumed — loop back to run again (bounded by MAX_RESYNCS).
  }
}

// ---------------------------------------------------------------------------
// Core single-run logic (one lease acquisition → paginate → apply → release)
// ---------------------------------------------------------------------------

/**
 * Attempts one full sync cycle.
 * Returns true when the lease was acquired and work was attempted.
 * Returns false when the lease was not acquired (another holder).
 */
async function runOnce(itemId: string): Promise<boolean> {
  const startedAt = Date.now();

  // ── Step 1: Acquire CAS lease via single HTTP statement ─────────────────
  // TR § 3 + schema.ts note: $onUpdate does NOT fire on raw SQL; set
  // updated_at explicitly here.
  const leaseResult = await db.execute(sql`
    UPDATE items
       SET sync_status      = 'SYNCING',
           lease_expires_at = now() + interval '6 minutes',
           updated_at       = now()
     WHERE id = ${itemId}
       AND (sync_status = 'IDLE' OR lease_expires_at < now())
    RETURNING id
  `);

  if ((leaseResult.rows?.length ?? 0) === 0) {
    // Another sync holds the lease — flag ourselves for re-run.
    await db
      .update(items)
      .set({ resyncRequested: true, updatedAt: new Date() })
      .where(eq(items.id, itemId));
    return false;
  }

  // ── Step 2 & 3: Decrypt token + capture original cursor ─────────────────
  const [item] = await db
    .select({
      accessTokenEnc: items.accessTokenEnc,
      transactionsCursor: items.transactionsCursor,
    })
    .from(items)
    .where(eq(items.id, itemId))
    .limit(1);

  if (!item) {
    // Item was deleted between lease acquire and here — release and exit.
    await releaseLease(itemId);
    return true;
  }

  const accessToken = decryptToken(item.accessTokenEnc);
  const originalCursor = item.transactionsCursor ?? undefined;

  // ── Step 4: Pagination loop ──────────────────────────────────────────────
  type SyncBuffers = {
    added: PlaidTransaction[];
    modified: PlaidTransaction[];
    removedIds: string[];
    nextCursor: string;
    syncAccounts: AccountBase[];
  };

  let buffers: SyncBuffers | null = null;

  try {
    buffers = await paginate(accessToken, originalCursor);
  } catch (err) {
    await handlePaginationError(itemId, err, startedAt);
    return true;
  }

  const { added, modified, removedIds, nextCursor, syncAccounts } = buffers;

  // ── Step 5: Apply in one DB transaction ──────────────────────────────────
  const pool = getPool();
  try {
    const poolDb = getPoolDb(pool);

    await poolDb.transaction(async (tx) => {
      const ctx = await loadCategorizationContext();

      // 5a. Upsert accounts and insert balance snapshots FIRST — transactions
      //     reference accounts by FK, and a sync can carry transactions for
      //     accounts not yet in the DB (e.g. NEW_ACCOUNTS_AVAILABLE).
      await applyAccounts(tx, syncAccounts, itemId);

      // 5b. Process added[] — carry-over + upsert
      await applyAdded(tx, added, itemId, ctx);

      // 5c. Process modified[] — upsert Plaid-owned columns; re-resolve only
      //     when category_source != 'user'
      await applyModified(tx, modified, ctx);

      // 5d. Hard-delete removed[] (after carry-over reads in 5b are complete)
      if (removedIds.length > 0) {
        await tx
          .delete(transactions)
          .where(inArray(transactions.id, removedIds));
      }

      // 5e. Conditional cursor commit (optimistic guard per TR § 3)
      const cursorUpdate = await tx.execute(sql`
        UPDATE items
           SET transactions_cursor = ${nextCursor},
               sync_status         = 'IDLE',
               lease_expires_at    = NULL,
               last_synced_at      = now(),
               updated_at          = now()
         WHERE id = ${itemId}
           AND transactions_cursor IS NOT DISTINCT FROM ${originalCursor ?? null}
        RETURNING id
      `);

      if ((cursorUpdate.rows?.length ?? 0) === 0) {
        // Another writer advanced the cursor — we lost fairly. Throwing rolls
        // back the whole apply transaction; the catch below deliberately does
        // NOT release the lease (the current cursor owner manages it, and a
        // guarded release here could clobber a newer holder; the 6-min TTL
        // covers the no-holder edge case).
        throw new CursorConflictError();
      }
    });

    // 5f. Insert sync_events summary row (outside the apply tx, best-effort)
    const durationMs = Date.now() - startedAt;
    await insertSyncEvent(itemId, "sync", {
      added: added.length,
      modified: modified.length,
      removed: removedIds.length,
      duration_ms: durationMs,
      outcome: "success",
    });
  } catch (err) {
    if (err instanceof CursorConflictError) {
      // Cursor conflict is not a real error — we lost to another invocation.
      // Intentionally no lease release here (see comment at the throw site).
      return true;
    }

    // Unexpected error in the apply transaction — release lease, log, rethrow nothing.
    await safeReleaseLease(itemId);
    const durationMs = Date.now() - startedAt;
    await insertSyncEvent(itemId, "sync_error", {
      error: String(err),
      duration_ms: durationMs,
      outcome: "error",
    });
    console.error({ msg: "syncItem apply error", itemId, error: errInfo(err) });
  } finally {
    // Per runtime-execution.md: end WebSocket pool within the invocation.
    await pool.end().catch(() => {
      // Ignore pool end errors — connection already closed or never opened.
    });
  }

  return true;
}

// ---------------------------------------------------------------------------
// Sentinel for optimistic cursor conflict
// ---------------------------------------------------------------------------

class CursorConflictError extends Error {
  constructor() {
    super("Cursor conflict: another writer advanced the cursor");
    this.name = "CursorConflictError";
  }
}

// ---------------------------------------------------------------------------
// Pagination loop
// ---------------------------------------------------------------------------

async function paginate(
  accessToken: string,
  originalCursor: string | undefined,
): Promise<{
  added: PlaidTransaction[];
  modified: PlaidTransaction[];
  removedIds: string[];
  nextCursor: string;
  syncAccounts: AccountBase[];
}> {
  let added: PlaidTransaction[] = [];
  let modified: PlaidTransaction[] = [];
  let removedIds: string[] = [];
  let syncAccounts: AccountBase[] = [];
  let cursor = originalCursor;
  let mutationRetries = 0;

  while (true) {
    let resp;
    try {
      resp = await plaidClient.transactionsSync({
        access_token: accessToken,
        cursor: cursor,
        count: 500,
        options: {
          include_original_description: true,
          personal_finance_category_version:
            PersonalFinanceCategoryVersion.V2,
        },
      });
    } catch (err) {
      const code = extractPlaidErrorCode(err);
      if (code === MUTATION_ERROR) {
        if (mutationRetries >= MAX_MUTATION_RETRIES) {
          throw new Error(
            `Exceeded max retries (${MAX_MUTATION_RETRIES}) for ${MUTATION_ERROR}`,
          );
        }
        mutationRetries++;
        // Per Plaid docs: restart from the original cursor, clear all buffers.
        cursor = originalCursor;
        added = [];
        modified = [];
        removedIds = [];
        syncAccounts = [];
        continue;
      }
      throw err;
    }

    const data = resp.data;

    // Buffer this page's results
    added = added.concat(data.added);
    modified = modified.concat(data.modified);
    for (const r of data.removed) {
      removedIds.push(r.transaction_id);
    }
    // Accounts are returned on every page; latest page wins (most up-to-date).
    if (data.accounts.length > 0) {
      syncAccounts = data.accounts;
    }
    cursor = data.next_cursor;

    if (!data.has_more) {
      break;
    }
  }

  return {
    added,
    modified,
    removedIds,
    // cursor is always a string by this point (next_cursor is string in the SDK)
    nextCursor: cursor ?? "",
    syncAccounts,
  };
}

// ---------------------------------------------------------------------------
// Apply: added[]
// ---------------------------------------------------------------------------

async function applyAdded(
   
  tx: any,
  added: PlaidTransaction[],
  itemId: string,
  ctx: CategorizationContext,
): Promise<void> {
  for (const t of added) {
    let categoryId = "uncategorized";
    let categorySource: "plaid" | "rule" | "user" = "plaid";
    let isExcluded = false;
    let note: string | null = null;

    // FR-022: pending → posted carry-over
    if (t.pending_transaction_id) {
      const prev = await tx.query.transactions.findFirst({
        where: eq(transactions.id, t.pending_transaction_id),
      });

      if (prev && prev.categorySource === "user") {
        categoryId = prev.categoryId;
        categorySource = "user";
        isExcluded = prev.isExcluded;
        note = prev.note ?? null;
      } else {
        const resolution = resolveCategory(plaidTxToResolvable(t, itemId), ctx);
        categoryId = resolution.id;
        categorySource = resolution.source;
        isExcluded = resolution.excluded;
      }
    } else {
      const resolution = resolveCategory(plaidTxToResolvable(t, itemId), ctx);
      categoryId = resolution.id;
      categorySource = resolution.source;
      isExcluded = resolution.excluded;
    }

    const row = buildTransactionRow(
      t,
      categoryId,
      categorySource,
      isExcluded,
      note,
    );

    // Idempotent upsert: on webhook re-delivery, update Plaid-owned columns
    // but preserve user-controlled columns (category_id, category_source,
    // is_excluded, note) when existing category_source = 'user'.
    await tx
      .insert(transactions)
      .values(row)
      .onConflictDoUpdate({
        target: transactions.id,
        set: plaidOwnedSet(t, row),
      });
  }
}

// ---------------------------------------------------------------------------
// Apply: modified[]
// ---------------------------------------------------------------------------

async function applyModified(
   
  tx: any,
  modified: PlaidTransaction[],
  ctx: CategorizationContext,
): Promise<void> {
  for (const t of modified) {
    // Update Plaid-owned columns first
    await tx
      .update(transactions)
      .set(buildPlaidOwnedColumns(t))
      .where(eq(transactions.id, t.transaction_id));

    // Re-resolve category only when the existing row is NOT user-set (FR-023)
    const existing = await tx.query.transactions.findFirst({
      where: eq(transactions.id, t.transaction_id),
    });

    if (existing && existing.categorySource !== "user") {
      const resolution = resolveCategory(plaidTxToResolvable(t, null), ctx);
      await tx
        .update(transactions)
        .set({
          categoryId: resolution.id,
          categorySource: resolution.source,
          isExcluded: resolution.excluded,
          updatedAt: new Date(),
        })
        .where(eq(transactions.id, t.transaction_id));
    }
  }
}

// ---------------------------------------------------------------------------
// Apply: accounts[] + balance snapshots
// ---------------------------------------------------------------------------

async function applyAccounts(
   
  tx: any,
  syncAccounts: AccountBase[],
  itemId: string,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  for (const a of syncAccounts) {
    const bal = a.balances;

    // Upsert accounts row (balance columns updated)
    await tx
      .insert(accounts)
      .values({
        id: a.account_id,
        itemId: itemId,
        name: a.name,
        officialName: a.official_name ?? null,
        mask: a.mask ?? null,
        type: String(a.type),
        subtype: a.subtype ? String(a.subtype) : null,
        currentBalance: bal.current != null ? String(bal.current) : null,
        availableBalance: bal.available != null ? String(bal.available) : null,
        creditLimit: bal.limit != null ? String(bal.limit) : null,
        isoCurrencyCode: bal.iso_currency_code ?? "USD",
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          name: a.name,
          officialName: a.official_name ?? null,
          mask: a.mask ?? null,
          type: String(a.type),
          subtype: a.subtype ? String(a.subtype) : null,
          currentBalance: bal.current != null ? String(bal.current) : null,
          availableBalance:
            bal.available != null ? String(bal.available) : null,
          creditLimit: bal.limit != null ? String(bal.limit) : null,
          isoCurrencyCode: bal.iso_currency_code ?? "USD",
          updatedAt: new Date(),
        },
      });

    // FR-016: insert today's balance snapshot, last write of day wins
    await tx
      .insert(accountBalanceSnapshots)
      .values({
        accountId: a.account_id,
        asOfDate: today,
        currentBalance: bal.current != null ? String(bal.current) : null,
        availableBalance: bal.available != null ? String(bal.available) : null,
        creditLimit: bal.limit != null ? String(bal.limit) : null,
      })
      .onConflictDoUpdate({
        target: [accountBalanceSnapshots.accountId, accountBalanceSnapshots.asOfDate],
        set: {
          currentBalance: bal.current != null ? String(bal.current) : null,
          availableBalance:
            bal.available != null ? String(bal.available) : null,
          creditLimit: bal.limit != null ? String(bal.limit) : null,
        },
      });
  }
}

// ---------------------------------------------------------------------------
// Error handlers
// ---------------------------------------------------------------------------

async function handlePaginationError(
  itemId: string,
  err: unknown,
  startedAt: number,
): Promise<void> {
  const code = extractPlaidErrorCode(err);
  const type = extractPlaidErrorType(err);

  const durationMs = Date.now() - startedAt;

  if (code === "ITEM_LOGIN_REQUIRED") {
    // FR-018: mark item as login_required, release lease
    await db
      .update(items)
      .set({
        status: "login_required",
        syncStatus: "IDLE",
        leaseExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(items.id, itemId));
    await insertSyncEvent(itemId, "sync_error", {
      error: code,
      error_type: type,
      duration_ms: durationMs,
      outcome: "login_required",
    });
    return;
  }

  if (
    type === PlaidErrorType.RateLimitExceeded ||
    code === "INSTITUTION_DOWN" ||
    type === PlaidErrorType.InstitutionError
  ) {
    // Release lease but do not rethrow — logged below
    await safeReleaseLease(itemId);
    await insertSyncEvent(itemId, "sync_error", {
      error: code ?? String(err),
      error_type: type,
      duration_ms: durationMs,
      outcome: "transient_error",
    });
    console.error({ msg: "syncItem transient Plaid error", itemId, code, type });
    return;
  }

  // For all other errors: release lease, log, and do not propagate
  await safeReleaseLease(itemId);
  await insertSyncEvent(itemId, "sync_error", {
    error: String(err),
    error_type: type,
    duration_ms: durationMs,
    outcome: "error",
  });
  console.error({ msg: "syncItem pagination error", itemId, error: errInfo(err) });
}

// ---------------------------------------------------------------------------
// Lease management
// ---------------------------------------------------------------------------

/** Release a lease this invocation holds. Guarded on sync_status='SYNCING' so
 *  a stale invocation can never clobber a lease re-acquired by another holder. */
async function releaseLease(itemId: string): Promise<void> {
  await db
    .update(items)
    .set({
      syncStatus: "IDLE",
      leaseExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(and(eq(items.id, itemId), eq(items.syncStatus, "SYNCING")));
}

/** Release lease without throwing — used in error paths. */
async function safeReleaseLease(itemId: string): Promise<void> {
  try {
    // Only reset if sync_status is still 'SYNCING' and this invocation holds it.
    // Using raw SQL to add the guard without a second SELECT.
    await db.execute(sql`
      UPDATE items
         SET sync_status      = 'IDLE',
             lease_expires_at = NULL,
             updated_at       = now()
       WHERE id = ${itemId}
         AND sync_status = 'SYNCING'
    `);
  } catch {
    // Best-effort; the TTL will expire the lease automatically.
  }
}

// ---------------------------------------------------------------------------
// sync_events helper
// ---------------------------------------------------------------------------

async function insertSyncEvent(
  itemId: string,
  kind: "sync" | "sync_error" | "webhook",
  payload: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(syncEvents).values({ itemId, kind, payload });
  } catch {
    // Best-effort audit log — must not mask real errors.
  }
}

// ---------------------------------------------------------------------------
// Transaction mapping helpers
// ---------------------------------------------------------------------------

/**
 * Maps a Plaid Transaction to the ResolvableTransaction shape expected by
 * resolveCategory(). itemId is used for the accountId field (optional).
 */
function plaidTxToResolvable(
  t: PlaidTransaction,
  _itemId: string | null,
) {
  return {
    accountId: t.account_id,
    merchantEntityId: t.merchant_entity_id ?? null,
    merchantName: t.merchant_name ?? null,
    name: t.name,
    pfcDetailed: t.personal_finance_category?.detailed ?? null,
    pfcPrimary: t.personal_finance_category?.primary ?? null,
    amount: t.amount,
  };
}

/**
 * Builds the full transaction insert row from a Plaid Transaction.
 */
function buildTransactionRow(
  t: PlaidTransaction,
  categoryId: string,
  categorySource: "plaid" | "rule" | "user",
  isExcluded: boolean,
  note: string | null,
) {
  return {
    id: t.transaction_id,
    accountId: t.account_id,
    amount: String(t.amount),
    isoCurrencyCode: t.iso_currency_code ?? "USD",
    date: t.date,
    datetime: t.datetime ? new Date(t.datetime) : null,
    authorizedDate: t.authorized_date ?? null,
    pending: t.pending,
    pendingTransactionId: t.pending_transaction_id ?? null,
    name: t.name,
    merchantName: t.merchant_name ?? null,
    merchantEntityId: t.merchant_entity_id ?? null,
    logoUrl: t.logo_url ?? null,
    website: t.website ?? null,
    paymentChannel: t.payment_channel ?? null,
    pfcPrimary: t.personal_finance_category?.primary ?? null,
    pfcDetailed: t.personal_finance_category?.detailed ?? null,
    pfcConfidence: t.personal_finance_category?.confidence_level ?? null,
    pfcIconUrl: t.personal_finance_category_icon_url ?? null,
    categoryId,
    categorySource,
    isExcluded,
    note,
    raw: t as unknown as Record<string, unknown>,
  };
}

/**
 * Builds the Drizzle `set` object for the onConflictDoUpdate in the added[]
 * upsert. On re-delivery of an already-inserted row, updates Plaid-owned
 * columns but does NOT unconditionally overwrite category/is_excluded/note —
 * those are preserved by the Drizzle onConflict set clause which only sets
 * Plaid-owned fields (category fields come from the resolved values above,
 * which for a re-delivery will match what is already stored).
 *
 * For added[], idempotency is achieved by including the category values in
 * the conflict update set — this is correct because a conflicting re-delivery
 * of an added[] row means the transaction is being seen again with the same
 * Plaid data, so we can safely re-apply the same resolution. The only time
 * we must NOT overwrite is on modified[] where user edits may have happened.
 */
function plaidOwnedSet(
  t: PlaidTransaction,
  row: ReturnType<typeof buildTransactionRow>,
) {
  return {
    accountId: row.accountId,
    amount: row.amount,
    isoCurrencyCode: row.isoCurrencyCode,
    date: row.date,
    datetime: row.datetime,
    authorizedDate: row.authorizedDate,
    pending: row.pending,
    pendingTransactionId: row.pendingTransactionId,
    name: row.name,
    merchantName: row.merchantName,
    merchantEntityId: row.merchantEntityId,
    logoUrl: row.logoUrl,
    website: row.website,
    paymentChannel: row.paymentChannel,
    pfcPrimary: row.pfcPrimary,
    pfcDetailed: row.pfcDetailed,
    pfcConfidence: row.pfcConfidence,
    pfcIconUrl: row.pfcIconUrl,
    // For added[] re-delivery: update category fields only when NOT user-set.
    // Drizzle's onConflictDoUpdate does not support conditional set per-column,
    // so we use a SQL CASE expression to preserve user overrides.
    categoryId: sql`CASE WHEN ${transactions.categorySource} = 'user' THEN ${transactions.categoryId} ELSE ${row.categoryId} END`,
    categorySource: sql`CASE WHEN ${transactions.categorySource} = 'user' THEN ${transactions.categorySource} ELSE ${row.categorySource} END`,
    isExcluded: sql`CASE WHEN ${transactions.categorySource} = 'user' THEN ${transactions.isExcluded} ELSE ${row.isExcluded} END`,
    note: sql`CASE WHEN ${transactions.categorySource} = 'user' THEN ${transactions.note} ELSE ${row.note} END`,
    raw: row.raw,
    updatedAt: new Date(),
  };
}

/**
 * Builds the set of columns that Plaid owns — used for the modified[] update.
 * Never includes category_id, category_source, is_excluded, or note.
 */
function buildPlaidOwnedColumns(t: PlaidTransaction) {
  return {
    accountId: t.account_id,
    amount: String(t.amount),
    isoCurrencyCode: t.iso_currency_code ?? "USD",
    date: t.date,
    datetime: t.datetime ? new Date(t.datetime) : null,
    authorizedDate: t.authorized_date ?? null,
    pending: t.pending,
    pendingTransactionId: t.pending_transaction_id ?? null,
    name: t.name,
    merchantName: t.merchant_name ?? null,
    merchantEntityId: t.merchant_entity_id ?? null,
    logoUrl: t.logo_url ?? null,
    website: t.website ?? null,
    paymentChannel: t.payment_channel ?? null,
    pfcPrimary: t.personal_finance_category?.primary ?? null,
    pfcDetailed: t.personal_finance_category?.detailed ?? null,
    pfcConfidence: t.personal_finance_category?.confidence_level ?? null,
    pfcIconUrl: t.personal_finance_category_icon_url ?? null,
    raw: t as unknown as Record<string, unknown>,
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Plaid error extraction helpers
// ---------------------------------------------------------------------------

function extractPlaidErrorCode(err: unknown): string | null {
  if (
    err !== null &&
    typeof err === "object" &&
    "response" in err
  ) {
    const response = (err as { response?: { data?: { error_code?: string } } })
      .response;
    return response?.data?.error_code ?? null;
  }
  return null;
}

function extractPlaidErrorType(err: unknown): string | null {
  if (
    err !== null &&
    typeof err === "object" &&
    "response" in err
  ) {
    const response = (err as { response?: { data?: { error_type?: string } } })
      .response;
    return response?.data?.error_type ?? null;
  }
  return null;
}
