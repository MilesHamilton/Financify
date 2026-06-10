/**
 * Drizzle schema — source of truth for all 9 Postgres tables.
 *
 * Matches TR.md § 2 exactly. Column order follows the spec SQL blocks.
 *
 * updated_at lifecycle note: TR.md specifies `DEFAULT now()` and an
 * `updated_at` trigger on items, accounts, and transactions. Rather than
 * a migration-level trigger we implement this via Drizzle's `$onUpdate`
 * lifecycle hook, which sets the value on every ORM-mediated UPDATE.
 * Raw SQL updates (e.g. the CAS lease UPDATE) must set updated_at
 * explicitly — this is the documented trade-off of the ORM lifecycle
 * approach vs. a DB-side trigger.
 *
 * sync_events.id: TR.md specifies `bigint GENERATED ALWAYS AS IDENTITY`.
 * Drizzle implements this via bigint('id', { mode: 'number' })
 * .generatedAlwaysAsIdentity(). Values are returned as JS numbers
 * (safe up to 2^53-1; at ~1 row/webhook this is functionally unlimited).
 *
 * categories.group: "group" is a reserved SQL keyword. The DB column name
 * is `group` (per spec); the TS property is also named `group` (valid as
 * an object key). Drizzle quotes reserved words automatically in DDL.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  boolean,
  integer,
  numeric,
  date,
  timestamp,
  jsonb,
  uuid,
  bigint,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// 1. items
// ---------------------------------------------------------------------------

export const items = pgTable("items", {
  id: text("id").primaryKey(),
  accessTokenEnc: text("access_token_enc").notNull(),
  institutionId: text("institution_id").notNull(),
  institutionName: text("institution_name").notNull(),
  status: text("status").notNull().default("active"),
  syncStatus: text("sync_status").notNull().default("IDLE"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  resyncRequested: boolean("resync_requested").notNull().default(false),
  transactionsCursor: text("transactions_cursor"),
  initialUpdateComplete: boolean("initial_update_complete")
    .notNull()
    .default(false),
  historicalUpdateComplete: boolean("historical_update_complete")
    .notNull()
    .default(false),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastSyncError: text("last_sync_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// 2. accounts
// ---------------------------------------------------------------------------

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  officialName: text("official_name"),
  mask: text("mask"),
  type: text("type").notNull(),
  subtype: text("subtype"),
  currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 14, scale: 2 }),
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
  isoCurrencyCode: text("iso_currency_code").notNull().default("USD"),
  isHidden: boolean("is_hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

// ---------------------------------------------------------------------------
// 4. categories (defined before transactions because transactions FK → categories)
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: text("id").primaryKey(),
  label: text("label").notNull(),
  icon: text("icon").notNull(),
  color: text("color").notNull(),
  group: text("group").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isArchived: boolean("is_archived").notNull().default(false),
});

// ---------------------------------------------------------------------------
// 3. transactions (defined after categories due to FK dependency)
// ---------------------------------------------------------------------------

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    isoCurrencyCode: text("iso_currency_code").notNull().default("USD"),
    date: date("date").notNull(),
    datetime: timestamp("datetime", { withTimezone: true }),
    authorizedDate: date("authorized_date"),
    pending: boolean("pending").notNull().default(false),
    pendingTransactionId: text("pending_transaction_id"),
    name: text("name").notNull(),
    merchantName: text("merchant_name"),
    merchantEntityId: text("merchant_entity_id"),
    logoUrl: text("logo_url"),
    website: text("website"),
    paymentChannel: text("payment_channel"),
    pfcPrimary: text("pfc_primary"),
    pfcDetailed: text("pfc_detailed"),
    pfcConfidence: text("pfc_confidence"),
    pfcIconUrl: text("pfc_icon_url"),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id)
      .default("uncategorized"),
    categorySource: text("category_source").notNull().default("plaid"),
    isExcluded: boolean("is_excluded").notNull().default(false),
    note: text("note"),
    raw: jsonb("raw").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("tx_date_idx").on(t.date),
    index("tx_account_date").on(t.accountId, t.date),
    index("tx_category_date").on(t.categoryId, t.date),
    index("tx_merchant_entity")
      .on(t.merchantEntityId)
      .where(sql`merchant_entity_id IS NOT NULL`),
    index("tx_pending_link")
      .on(t.pendingTransactionId)
      .where(sql`pending_transaction_id IS NOT NULL`),
  ],
);

// ---------------------------------------------------------------------------
// 5. plaid_category_map
// ---------------------------------------------------------------------------

export const plaidCategoryMap = pgTable("plaid_category_map", {
  pfcDetailed: text("pfc_detailed").primaryKey(),
  pfcPrimary: text("pfc_primary").notNull(),
  categoryId: text("category_id")
    .notNull()
    .references(() => categories.id),
  excludeDefault: boolean("exclude_default").notNull().default(false),
});

// ---------------------------------------------------------------------------
// 6. category_rules
// ---------------------------------------------------------------------------

export const categoryRules = pgTable(
  "category_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    priority: integer("priority").notNull().default(100),
    merchantEntityId: text("merchant_entity_id"),
    merchantNameLike: text("merchant_name_like"),
    accountId: text("account_id").references(() => accounts.id, {
      onDelete: "cascade",
    }),
    pfcDetailed: text("pfc_detailed"),
    pfcPrimary: text("pfc_primary"),
    amountMin: numeric("amount_min", { precision: 14, scale: 2 }),
    amountMax: numeric("amount_max", { precision: 14, scale: 2 }),
    setCategoryId: text("set_category_id").references(() => categories.id),
    setExcluded: boolean("set_excluded"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("rules_priority")
      .on(t.priority)
      .where(sql`is_active = true`),
  ],
);

// ---------------------------------------------------------------------------
// 7. budgets
// ---------------------------------------------------------------------------

export const budgets = pgTable(
  "budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    effectiveMonth: date("effective_month").notNull(),
  },
  (t) => [
    uniqueIndex("budgets_category_month_uniq").on(
      t.categoryId,
      t.effectiveMonth,
    ),
  ],
);

// ---------------------------------------------------------------------------
// 8. account_balance_snapshots
// ---------------------------------------------------------------------------

export const accountBalanceSnapshots = pgTable(
  "account_balance_snapshots",
  {
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    asOfDate: date("as_of_date").notNull(),
    currentBalance: numeric("current_balance", { precision: 14, scale: 2 }),
    availableBalance: numeric("available_balance", {
      precision: 14,
      scale: 2,
    }),
    creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.asOfDate] })],
);

// ---------------------------------------------------------------------------
// 9. sync_events
// ---------------------------------------------------------------------------

export const syncEvents = pgTable(
  "sync_events",
  {
    id: bigint("id", { mode: "number" })
      .generatedAlwaysAsIdentity()
      .primaryKey(),
    itemId: text("item_id"),
    kind: text("kind").notNull(),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("sync_events_item_time")
      .on(t.itemId, t.createdAt)
      .where(sql`item_id IS NOT NULL`),
  ],
);

// ---------------------------------------------------------------------------
// Inferred row types — $inferSelect (read) and $inferInsert (write) for all 9 tables
// ---------------------------------------------------------------------------

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;

export type PlaidCategoryMap = typeof plaidCategoryMap.$inferSelect;
export type NewPlaidCategoryMap = typeof plaidCategoryMap.$inferInsert;

export type CategoryRule = typeof categoryRules.$inferSelect;
export type NewCategoryRule = typeof categoryRules.$inferInsert;

export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;

export type AccountBalanceSnapshot = typeof accountBalanceSnapshots.$inferSelect;
export type NewAccountBalanceSnapshot =
  typeof accountBalanceSnapshots.$inferInsert;

export type SyncEvent = typeof syncEvents.$inferSelect;
export type NewSyncEvent = typeof syncEvents.$inferInsert;
