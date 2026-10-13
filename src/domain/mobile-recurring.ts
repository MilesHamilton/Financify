/**
 * src/domain/mobile-recurring.ts
 *
 * GET /api/mobile/recurring and /api/mobile/recurring/[id]. Unlike
 * getRecurringMonth (metrics.ts, bill streams matched to one calendar month),
 * these return every stream — inflow and outflow, active and inactive — with
 * a StreamKind classification for the "Recurring All" grouped list.
 */

import "server-only";

import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { recurringStreams, type RecurringStream as DbRecurringStream } from "@/db/schema";
import { getNextExpectedDate, getTodayNY } from "@/domain/metrics";
import { classifyStreamKind } from "@/domain/mobile-helpers";
import { toTxn, getAccountNameMap, getCategoriesMapAll } from "@/domain/mobile-shared";
import type {
  RecurringStream as MobileRecurringStream,
  RecurringResponse,
  RecurringDetailResponse,
} from "@/contracts/mobile-api";

// ---------------------------------------------------------------------------
// Helpers shared with mobile.ts (dashboard next-payday / upcoming bills)
// ---------------------------------------------------------------------------

export async function getAllStreams(): Promise<DbRecurringStream[]> {
  return db.select().from(recurringStreams);
}

export function mapStreamToContract(
  stream: DbRecurringStream,
  logoUrl: string | null,
): MobileRecurringStream {
  const averageAmount = parseFloat(stream.averageAmount);
  const direction: "inflow" | "outflow" = averageAmount < 0 ? "inflow" : "outflow";
  const kind = classifyStreamKind({
    isActive: stream.isActive,
    averageAmount,
    category: stream.category,
  });
  return {
    id: stream.id,
    name: stream.description,
    merchantName: stream.merchantName,
    logoUrl,
    amount: Math.abs(averageAmount),
    direction,
    frequency: stream.frequency as MobileRecurringStream["frequency"],
    kind,
    lastDate: stream.lastDate,
    nextDate: getNextExpectedDate(stream.lastDate, stream.frequency),
    isActive: stream.isActive,
  };
}

/**
 * Most recent transaction's logo_url among rows whose merchant_name or name
 * matches the stream's merchant_name/description (case-insensitive) — same
 * predicate used for the detail history below.
 *
 * shortcut: one query per stream (N+1). Fine at recurring-stream scale
 * (typically well under 100 rows); batch with a LATERAL join if that grows.
 */
export async function getLatestMatchingLogoUrl(stream: {
  merchantName: string | null;
  description: string;
}): Promise<string | null> {
  const matchName = stream.merchantName ?? stream.description;
  const rows = await db.execute(sql`
    SELECT logo_url
    FROM transactions
    WHERE (merchant_name IS NOT NULL AND lower(merchant_name) = lower(${matchName}))
       OR lower(name) = lower(${stream.description})
    ORDER BY date DESC, id DESC
    LIMIT 1
  `);
  return (rows.rows[0] as { logo_url: string | null } | undefined)?.logo_url ?? null;
}

// ---------------------------------------------------------------------------
// GET /api/mobile/recurring
// ---------------------------------------------------------------------------

export async function getRecurringStreamsData(): Promise<RecurringResponse> {
  const streams = await getAllStreams();
  const logoUrls = await Promise.all(streams.map(getLatestMatchingLogoUrl));
  const mapped = streams.map((s, i) => mapStreamToContract(s, logoUrls[i]));

  // Active streams first (soonest due date first); inactive streams last.
  mapped.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    if (!a.nextDate && !b.nextDate) return 0;
    if (!a.nextDate) return 1;
    if (!b.nextDate) return -1;
    return a.nextDate.localeCompare(b.nextDate);
  });

  return { today: getTodayNY(), streams: mapped };
}

// ---------------------------------------------------------------------------
// GET /api/mobile/recurring/[id]
// ---------------------------------------------------------------------------

export async function getRecurringStreamDetailData(
  id: string,
): Promise<RecurringDetailResponse | null> {
  const [stream] = await db
    .select()
    .from(recurringStreams)
    .where(eq(recurringStreams.id, id))
    .limit(1);
  if (!stream) return null;

  const matchName = stream.merchantName ?? stream.description;

  const [logoUrl, txRows, accountNameById, categoryById] = await Promise.all([
    getLatestMatchingLogoUrl(stream),
    db.execute(sql`
      SELECT
        t.id,
        t.account_id    AS "accountId",
        t.amount::text  AS amount,
        t.date::text    AS date,
        t.pending,
        t.name,
        t.merchant_name AS "merchantName",
        t.logo_url      AS "logoUrl",
        t.category_id   AS "categoryId",
        t.is_excluded   AS "isExcluded",
        t.note
      FROM transactions t
      WHERE (t.merchant_name IS NOT NULL AND lower(t.merchant_name) = lower(${matchName}))
         OR lower(t.name) = lower(${stream.description})
      ORDER BY t.date DESC, t.id DESC
      LIMIT 24
    `),
    getAccountNameMap(),
    getCategoriesMapAll(),
  ]);

  const history = (
    txRows.rows as Array<{
      id: string;
      accountId: string;
      amount: string;
      date: string;
      pending: boolean;
      name: string;
      merchantName: string | null;
      logoUrl: string | null;
      categoryId: string;
      isExcluded: boolean;
      note: string | null;
    }>
  ).map((r) => toTxn(r, accountNameById, categoryById));

  return {
    stream: mapStreamToContract(stream, logoUrl),
    history,
  };
}
