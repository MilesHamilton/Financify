/**
 * src/domain/mobile-shared.ts
 *
 * DB-touching adapters shared by mobile.ts, mobile-recurring.ts, and
 * mobile-networth.ts. Split out to avoid a circular import between those
 * three (mobile-recurring needs the Txn/account adapters for its detail
 * history endpoint; mobile.ts needs the recurring helpers for the dashboard's
 * next-payday/upcoming-bills fields).
 */

import "server-only";

import { db } from "@/db";
import { categories } from "@/db/schema";
import { getAccounts, type AccountRow } from "@/domain/metrics";
import { mapAccountGroup, buildCategoryMap } from "@/domain/mobile-helpers";
import type { AccountSummary, Category, Txn } from "@/contracts/mobile-api";

/** Minimal transaction row shape every Txn source (metrics rows, raw SQL) satisfies. */
export interface TxnSourceRow {
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
}

const FALLBACK_CATEGORY: Category = {
  id: "uncategorized",
  label: "Uncategorized",
  color: "#808080",
  icon: "Receipt",
  group: "expense",
};

export function toTxn(
  row: TxnSourceRow,
  accountNameById: Map<string, string>,
  categoryById: Map<string, Category>,
): Txn {
  return {
    id: row.id,
    accountId: row.accountId,
    accountName: accountNameById.get(row.accountId) ?? "",
    amount: parseFloat(row.amount),
    date: row.date,
    pending: row.pending,
    name: row.name,
    merchantName: row.merchantName,
    logoUrl: row.logoUrl,
    category: categoryById.get(row.categoryId) ?? FALLBACK_CATEGORY,
    isExcluded: row.isExcluded,
    note: row.note,
  };
}

export function mapAccountSummary(a: AccountRow): AccountSummary {
  return {
    id: a.id,
    itemId: a.itemId,
    name: a.name,
    institutionName: a.institutionName,
    mask: a.mask,
    type: a.type,
    subtype: a.subtype,
    group: mapAccountGroup(a.type, a.subtype),
    balance: parseFloat(a.currentBalance ?? "0"),
    isHidden: a.isHidden,
    itemStatus: a.itemStatus,
    lastSyncedAt: a.lastSyncedAt ? a.lastSyncedAt.toISOString() : null,
  };
}

export async function getAccountNameMap(): Promise<Map<string, string>> {
  const rows = await getAccounts();
  return new Map(rows.map((a) => [a.id, a.name]));
}

/** All categories (including archived) — used for Txn/breakdown lookups. */
export async function getCategoriesMapAll(): Promise<Map<string, Category>> {
  const rows = await db
    .select({
      id: categories.id,
      label: categories.label,
      color: categories.color,
      icon: categories.icon,
      group: categories.group,
    })
    .from(categories);
  return buildCategoryMap(rows);
}
