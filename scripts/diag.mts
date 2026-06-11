import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.PROD_DB!);
const items = await sql`SELECT id, institution_name, status, sync_status, transactions_cursor IS NOT NULL AS has_cursor, last_synced_at, created_at FROM items ORDER BY created_at`;
console.log("ITEMS:", JSON.stringify(items, null, 1));
const counts = await sql`SELECT (SELECT count(*) FROM accounts) accounts, (SELECT count(*) FROM transactions) txns, (SELECT count(*) FROM account_balance_snapshots) snaps, (SELECT count(*) FROM sync_events) events`;
console.log("COUNTS:", JSON.stringify(counts[0]));
const events = await sql`SELECT event_type, item_id, payload, created_at FROM sync_events ORDER BY created_at DESC LIMIT 12`;
console.log("RECENT EVENTS:", JSON.stringify(events, null, 1));
