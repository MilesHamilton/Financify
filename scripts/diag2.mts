import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.PROD_DB!);
const events = await sql`SELECT id, kind, item_id, payload, created_at FROM sync_events ORDER BY created_at DESC LIMIT 15`;
for (const e of events) console.log(e.created_at, "|", e.kind, "|", e.item_id, "|", JSON.stringify(e.payload)?.slice(0, 220));
