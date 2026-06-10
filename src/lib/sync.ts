/**
 * ============================================================
 * STUB — DO NOT IMPLEMENT HERE
 * ============================================================
 * This file is a Wave-5 stub. The real sync engine is a Wave-6
 * deliverable and will OVERWRITE this file entirely.
 *
 * The function signature below is a FIXED CONTRACT shared by:
 *   - app/api/plaid/webhook/route.ts  (after() callback)
 *   - app/api/cron/sync/route.ts      (daily backstop)
 *   - app/api/sync/trigger/route.ts   (manual "sync now")
 *
 * DO NOT change the export name or parameter type.
 * ============================================================
 */

/**
 * Stub sync runner. Logs invocation and returns immediately.
 * Wave-6 will replace this with the full CAS-lease / pagination / upsert engine
 * described in runtime-execution.md § Core Execution Engine and FRS FR-015.
 *
 * @param itemId - The Plaid item_id whose transactions should be synced.
 */
export async function syncItem(itemId: string): Promise<void> {
  console.log({ msg: "syncItem stub invoked", itemId });
}
