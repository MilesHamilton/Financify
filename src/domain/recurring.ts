/**
 * recurring.ts — Plaid recurring-stream sync service (T-R22)
 *
 * Single exported function: syncRecurringStreams(accessToken)
 *
 * Caller contract (Wave 3 T-R31):
 *   For each active item in the cron loop, after syncItem(itemId) completes:
 *     const accessToken = decryptToken(item.accessTokenEnc);
 *     await syncRecurringStreams(accessToken);
 *
 *   The function accepts the *already-decrypted* access token so the cron
 *   caller retains full control over decryption and can reuse the token it
 *   already holds from the syncItem call.
 *
 *   No accountId parameter is needed — each TransactionStream returned by
 *   Plaid carries its own account_id, which becomes the FK on upsert.
 *   If an item has multiple accounts, all their streams arrive in one API
 *   response and are upserted in a single batch.
 *
 * Error handling (TR §4.4 / §6):
 *   All errors are caught, logged via errInfo() only (never the raw axios
 *   error or the access_token), and treated as zero streams.  The function
 *   never throws to the caller — a sync failure is non-fatal to the wider
 *   cron job.
 */

import "server-only";

import { sql } from "drizzle-orm";
import {
  TransactionStream,
  TransactionStreamStatus,
  RecurringTransactionFrequency,
} from "plaid";

import { plaidClient } from "@/lib/plaid";
import { errInfo } from "@/lib/log-error";
import { db } from "@/db";
import { recurringStreams, NewRecurringStream } from "@/db/schema";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * PFC primary categories that default is_bill = TRUE per TR §1.1.
 * All other categories default to FALSE.
 */
const BILL_CATEGORIES = new Set<string>([
  "RENT_AND_UTILITIES",
  "LOAN_PAYMENTS",
  "INSURANCE",
]);

/**
 * Frequency values accepted by the recurring_streams CHECK constraint.
 * RecurringTransactionFrequency.Unknown ("UNKNOWN") is intentionally absent
 * — streams with that value cannot be stored and are skipped with a warning.
 */
const VALID_FREQUENCIES = new Set<string>([
  RecurringTransactionFrequency.Weekly,       // "WEEKLY"
  RecurringTransactionFrequency.Biweekly,     // "BIWEEKLY"
  RecurringTransactionFrequency.SemiMonthly,  // "SEMI_MONTHLY"
  RecurringTransactionFrequency.Monthly,      // "MONTHLY"
  RecurringTransactionFrequency.Annually,     // "ANNUALLY"
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Result returned by syncRecurringStreams. Never throws. */
export interface SyncRecurringResult {
  /** Number of rows written (inserted or updated) via the upsert. */
  upserted: number;
  /** True when an error prevented a complete sync (Plaid API or DB failure). */
  error?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps Plaid's TransactionStreamStatus to the lowercase values allowed by
 * the recurring_streams status CHECK constraint.
 */
function mapStatus(status: TransactionStreamStatus): string {
  switch (status) {
    case TransactionStreamStatus.Mature:
      return "mature";
    case TransactionStreamStatus.EarlyDetection:
      return "early_detection";
    // TOMBSTONED and UNKNOWN both map to "unknown"
    default:
      return "unknown";
  }
}

/**
 * Converts a stream into a NewRecurringStream row, or returns null if the
 * stream is malformed or uses an unsupported frequency.
 */
function mapStream(stream: TransactionStream): NewRecurringStream | null {
  // TR §6: skip rows missing stream_id
  if (!stream.stream_id) {
    console.warn({
      msg: "syncRecurringStreams: stream missing stream_id — skipping",
      error: errInfo(new Error("stream_id absent on TransactionStream")),
    });
    return null;
  }

  // Skip frequency values the DB CHECK constraint does not accept
  const freq: string = stream.frequency;
  if (!VALID_FREQUENCIES.has(freq)) {
    console.warn({
      msg: "syncRecurringStreams: unsupported frequency — skipping",
      stream_id: stream.stream_id,
      frequency: freq,
    });
    return null;
  }

  // PFC primary category drives isBill logic (TR §1.1 / T-R00 handoff)
  const category: string | null =
    stream.personal_finance_category?.primary ?? null;
  const isBill: boolean =
    category !== null && BILL_CATEGORIES.has(category);

  // averageAmount is NOT NULL in the schema; fall back to "0.00" if absent
  const avgAmt = stream.average_amount.amount;
  const averageAmount: string = avgAmt !== undefined ? String(avgAmt) : "0.00";

  // lastAmount is nullable
  const lastAmt = stream.last_amount.amount;
  const lastAmount: string | null =
    lastAmt !== undefined ? String(lastAmt) : null;

  return {
    id: stream.stream_id,
    accountId: stream.account_id,
    description: stream.description,
    merchantName: stream.merchant_name ?? null,
    category,
    frequency: freq,
    averageAmount,
    lastAmount,
    lastDate: stream.last_date ?? null,
    isActive: stream.is_active,
    isBill,
    status: mapStatus(stream.status),
    // updatedAt is set explicitly in the conflict SET clause below;
    // the DB default (now()) covers the INSERT path.
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches recurring transaction streams for one Plaid item and upserts them
 * into `recurring_streams`.
 *
 * Merges `outflow_streams` and `inflow_streams` from the Plaid response into
 * a single batch upsert.  On conflict (same stream_id), all mutable columns
 * are updated so the row always reflects the latest Plaid data.
 *
 * @param accessToken - Decrypted Plaid access token for the item.
 *   DO NOT pass the raw `accessTokenEnc` string — decrypt it first via
 *   `decryptToken` from `@/lib/crypto`.
 *
 * @returns SyncRecurringResult — always resolves, never rejects.
 *
 * Wave 3 T-R31 call site:
 * ```ts
 * const accessToken = decryptToken(item.accessTokenEnc);
 * const result = await syncRecurringStreams(accessToken);
 * ```
 */
export async function syncRecurringStreams(
  accessToken: string,
): Promise<SyncRecurringResult> {
  // ── 1. Fetch recurring streams from Plaid ──────────────────────────────
  let outflowStreams: TransactionStream[];
  let inflowStreams: TransactionStream[];

  try {
    const resp = await plaidClient.transactionsRecurringGet({
      access_token: accessToken,
    });
    outflowStreams = resp.data.outflow_streams;
    inflowStreams = resp.data.inflow_streams;
  } catch (err) {
    // TR §4.4: treat API failure as zero streams; log safely; do not throw
    console.error({
      msg: "syncRecurringStreams: Plaid API error",
      error: errInfo(err),
    });
    return { upserted: 0, error: true };
  }

  // ── 2. Merge and map streams ───────────────────────────────────────────
  const allStreams: TransactionStream[] = [...outflowStreams, ...inflowStreams];

  if (allStreams.length === 0) {
    return { upserted: 0 };
  }

  const rows: NewRecurringStream[] = [];
  for (const stream of allStreams) {
    const row = mapStream(stream);
    if (row !== null) {
      rows.push(row);
    }
  }

  if (rows.length === 0) {
    return { upserted: 0 };
  }

  // ── 3. Upsert into recurring_streams ──────────────────────────────────
  // On conflict: update all mutable columns, including updatedAt (TR §1.1).
  // Uses EXCLUDED pseudo-table to reference the proposed new row values so
  // a batch insert always writes the latest data for each stream_id.
  try {
    await db
      .insert(recurringStreams)
      .values(rows)
      .onConflictDoUpdate({
        target: recurringStreams.id,
        set: {
          accountId: sql`excluded.account_id`,
          description: sql`excluded.description`,
          merchantName: sql`excluded.merchant_name`,
          category: sql`excluded.category`,
          frequency: sql`excluded.frequency`,
          averageAmount: sql`excluded.average_amount`,
          lastAmount: sql`excluded.last_amount`,
          lastDate: sql`excluded.last_date`,
          isActive: sql`excluded.is_active`,
          isBill: sql`excluded.is_bill`,
          status: sql`excluded.status`,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error({
      msg: "syncRecurringStreams: DB upsert error",
      error: errInfo(err),
    });
    return { upserted: 0, error: true };
  }

  return { upserted: rows.length };
}
