/**
 * Database client module — two connection modes, used deliberately.
 *
 * HTTP mode (`db`): neon() HTTP driver over a single fetch round-trip.
 * Lowest latency for one-shot queries; no connection lifecycle overhead.
 * Used for all UI reads (RSC), single-statement writes, and the lease
 * CAS UPDATE (a single statement — HTTP is sufficient per runtime-execution.md).
 *
 * WebSocket Pool mode (`getPoolDb()`): pg-compatible Pool over WebSocket.
 * Required only inside the transactional sync-apply step, where multiple
 * statements (upsert pages + conditional cursor UPDATE + rowcount check)
 * must run in a single interactive transaction. Open, use, and end the
 * pool within the invocation — do not hold it open across requests.
 *
 * See: job-queue/product-financify/runtime-execution.md § Serverless Postgres
 * connection strategy.
 *
 * NOTE: `import "server-only"` is intentionally omitted. Seed scripts and
 * drizzle-kit commands import this module outside the Next.js runtime, so
 * adding server-only would break those tools. TR.md § 6.2 does not require
 * it on this module; route handlers and RSC files that need the boundary
 * should enforce it at their own layer.
 */

import { neon } from "@neondatabase/serverless";
import { Pool } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// HTTP mode — lazily-initialized singleton, reused across warm invocations.
// Lazy because Next.js imports route modules at build time (page-data
// collection) where DATABASE_URL is not set; eager neon() would fail the build.
type HttpDb = ReturnType<typeof drizzleHttp<typeof schema>>;
let _db: HttpDb | null = null;

function getDb(): HttpDb {
  if (!_db) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _db = drizzleHttp(neon(url), { schema });
  }
  return _db;
}

export const db: HttpDb = new Proxy({} as HttpDb, {
  get(_target, prop) {
    const real = getDb();
    const value = Reflect.get(real, prop, real);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

// WebSocket Pool mode — lazily created on first call to getPool().
// Callers are responsible for calling pool.end() after the transaction.
// Node 20+ and Vercel's Node runtime provide a native WebSocket global;
// no explicit webSocketConstructor assignment is needed.
let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  }
  return _pool;
}

export function getPoolDb() {
  return drizzleWs(getPool(), { schema });
}
