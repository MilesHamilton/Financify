# Migration Pending

## Status

Migration `0000_steady_tarantula.sql` was generated and SQL-reviewed on 2026-06-10.

`npx drizzle-kit migrate` must be run once `DATABASE_URL_UNPOOLED` points at the real
database (Neon direct connection string). This is deferred — no database exists yet.

## What was reviewed

The generated SQL was verified line by line against TR.md § 2:

- All 9 tables present with correct column names, types, nullability, and defaults.
- Composite PRIMARY KEY on `account_balance_snapshots (account_id, as_of_date)`.
- All foreign keys with correct ON DELETE behavior (cascade where spec requires it).
- 5 CHECK constraints: `items.status`, `items.sync_status`, `categories.group`,
  `transactions.category_source`, `budgets.amount >= 0`.
- UNIQUE index on `budgets (category_id, effective_month)`.
- Partial indexes with WHERE clauses: `tx_merchant_entity`, `tx_pending_link`,
  `rules_priority`, `sync_events_item_time` — WHERE clauses confirmed present in SQL.
- Descending sort order confirmed on: `tx_date_idx`, `tx_account_date`,
  `tx_category_date`, `sync_events_item_time`.
- `sync_events.id`: `bigint GENERATED ALWAYS AS IDENTITY` with explicit sequence bounds.

## Drift found and fixed before final generation

Two categories of drift were found in the initial schema.ts and corrected before
the final migration was generated:

1. CHECK constraints absent: `items` (status, sync_status), `transactions`
   (category_source), `categories` (group), and `budgets` (amount >= 0) were
   missing. Added via Drizzle `check()` in the table extras array.

2. Index sort order: `tx_date_idx`, `tx_account_date`, `tx_category_date`, and
   `sync_events_item_time` were missing `.desc()` on the date/created_at columns.
   TR.md spec requires DESC for keyset pagination. Added `.desc()` to the relevant
   column references.

## How to apply

Once `DATABASE_URL_UNPOOLED` is set to the Neon direct (non-pooled) connection string:

```bash
npx drizzle-kit migrate
```

Then run the seed script to insert 14 categories and 127 plaid_category_map rows
(see TR.md § 2.4 and § 2.5).
