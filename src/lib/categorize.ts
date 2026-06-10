/**
 * Category resolution engine — pure resolution logic; no Plaid API calls.
 *
 * ## Intended call pattern for the sync engine (Wave 6)
 *
 *   // At the top of syncItem(), before the apply loop:
 *   const ctx = await loadCategorizationContext();
 *
 *   // Inside the add/modify loops — pure, no DB access per call:
 *   const resolution = resolveCategory(plaidTx, ctx);
 *
 * `loadCategorizationContext()` performs exactly two queries (rules + map)
 * regardless of batch size, eliminating N+1 on the per-transaction hot path.
 *
 * ## User overrides are NOT resolved here
 * Rows with `category_source = 'user'` are owned by the recategorization
 * endpoint (`PATCH /api/transactions/:id`). The sync engine must check
 * `prev.categorySource === 'user'` before calling resolveCategory and skip
 * this function entirely for those rows — they win forever.
 */

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { categoryRules, plaidCategoryMap } from "@/db/schema";
import type { CategoryRule, PlaidCategoryMap } from "@/db/schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * The resolved category result written to transactions.category_id,
 * transactions.category_source, and transactions.is_excluded at ingest time.
 */
export type CategoryResolution = {
  id: string;
  source: "plaid" | "rule";
  excluded: boolean;
};

/**
 * Minimal transaction shape required for resolution.
 * Covers both Plaid wire objects (added/modified arrays) and Drizzle row
 * types — use the intersection of their common fields.
 */
export type ResolvableTransaction = {
  accountId?: string | null;
  merchantEntityId?: string | null;
  /** Plaid-enriched merchant name (nullable). */
  merchantName?: string | null;
  /** Raw institution description — always present. */
  name: string;
  pfcDetailed?: string | null;
  pfcPrimary?: string | null;
  /** Plaid amount string or number: positive = outflow, negative = inflow. */
  amount: string | number;
};

/**
 * Pre-loaded context passed to the pure resolver.
 * Fetch once per sync run with `loadCategorizationContext()`.
 */
export type CategorizationContext = {
  /** Active rules ordered by priority ASC (lowest number = highest priority). */
  rules: CategoryRule[];
  /**
   * Map from pfc_detailed code → plaid_category_map row.
   * Key is the raw pfc_detailed string (e.g. "FOOD_AND_DRINK_GROCERIES").
   */
  map: Map<string, PlaidCategoryMap>;
};

// ---------------------------------------------------------------------------
// Context loader — call ONCE per sync run, not per transaction
// ---------------------------------------------------------------------------

/**
 * Fetches all active category rules (priority ASC) and the full
 * plaid_category_map in two queries.
 *
 * Call this at the start of the sync apply loop and pass the result to
 * every `resolveCategory()` call in the batch.
 */
export async function loadCategorizationContext(): Promise<CategorizationContext> {
  const [rules, mapRows] = await Promise.all([
    db
      .select()
      .from(categoryRules)
      .where(eq(categoryRules.isActive, true))
      .orderBy(categoryRules.priority),
    db.select().from(plaidCategoryMap),
  ]);

  const map = new Map<string, PlaidCategoryMap>();
  for (const row of mapRows) {
    map.set(row.pfcDetailed, row);
  }

  return { rules, map };
}

// ---------------------------------------------------------------------------
// Pure resolver
// ---------------------------------------------------------------------------

/**
 * Resolves the display category for a transaction using the four-step
 * priority order defined in FR-021 and abstraction-layer.md.
 *
 * Resolution order:
 *   1. First active category_rule (priority ASC) where ALL non-null
 *      conditions match → source 'rule'
 *   2. plaid_category_map[pfc_detailed]           → source 'plaid'
 *   3. plaid_category_map[pfc_primary + '_OTHER'] (primary fallback)
 *      → source 'plaid'
 *   4. { id: 'uncategorized', source: 'plaid', excluded: false }
 *
 * This function is synchronous and pure — all DB data is in `ctx`.
 *
 * NOTE: If `ctx` is omitted the function throws a TypeError at runtime.
 * The overload without ctx is not provided to prevent accidental N+1 usage.
 */
export function resolveCategory(
  txn: ResolvableTransaction,
  ctx: CategorizationContext,
): CategoryResolution {
  // ── Step 1: category_rules ──────────────────────────────────────────────
  const ruleMatch = matchRule(txn, ctx.rules);
  if (ruleMatch !== null) {
    return ruleMatch;
  }

  // ── Step 2: plaid_category_map[pfc_detailed] ────────────────────────────
  if (txn.pfcDetailed) {
    const mapRow = ctx.map.get(txn.pfcDetailed);
    if (mapRow) {
      return {
        id: mapRow.categoryId,
        source: "plaid",
        excluded: mapRow.excludeDefault,
      };
    }
  }

  // ── Step 3: primary OTHER fallback ──────────────────────────────────────
  // Every PFCv2 primary has an OTHER detailed code (e.g. FOOD_AND_DRINK_OTHER).
  // The map seed covers all 127 codes so a miss here means an unknown primary.
  if (txn.pfcPrimary) {
    const otherKey = buildOtherKey(txn.pfcPrimary, ctx.map);
    if (otherKey) {
      const fallbackRow = ctx.map.get(otherKey);
      if (fallbackRow) {
        return {
          id: fallbackRow.categoryId,
          source: "plaid",
          excluded: fallbackRow.excludeDefault,
        };
      }
    }
  }

  // ── Step 4: uncategorized ───────────────────────────────────────────────
  return { id: "uncategorized", source: "plaid", excluded: false };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Iterates active rules (already sorted priority ASC) and returns the first
 * match, or null if no rule matches.
 *
 * A rule matches when ALL non-null condition fields match (AND semantics).
 * Per FR-021 / abstraction-layer.md:
 *   - merchant_entity_id: exact equality
 *   - merchant_name_like: case-insensitive substring match against
 *     merchant_name OR name (mirrors SQL ILIKE '%value%')
 *   - account_id: exact equality
 *   - pfc_detailed: exact equality
 *   - pfc_primary: exact equality
 *   - amount_min: amount >= amount_min (rule field name is "min <=", i.e.
 *     the rule fires when the transaction amount is at or above the min)
 *   - amount_max: amount <= amount_max
 */
function matchRule(
  txn: ResolvableTransaction,
  rules: CategoryRule[],
): CategoryResolution | null {
  const amount = parseFloat(String(txn.amount));

  for (const rule of rules) {
    if (!ruleConditionsMatch(txn, rule, amount)) {
      continue;
    }

    // A rule without set_category_id is a no-op; skip it defensively.
    if (!rule.setCategoryId) {
      continue;
    }

    return {
      id: rule.setCategoryId,
      source: "rule",
      excluded: rule.setExcluded ?? false,
    };
  }

  return null;
}

function ruleConditionsMatch(
  txn: ResolvableTransaction,
  rule: CategoryRule,
  amount: number,
): boolean {
  // merchant_entity_id — exact match
  if (rule.merchantEntityId !== null && rule.merchantEntityId !== undefined) {
    if (txn.merchantEntityId !== rule.merchantEntityId) return false;
  }

  // merchant_name_like — case-insensitive substring (ILIKE '%value%') against
  // merchant_name OR name, as specified in abstraction-layer.md and FR-021.
  if (rule.merchantNameLike !== null && rule.merchantNameLike !== undefined) {
    const pattern = rule.merchantNameLike.toLowerCase();
    const inMerchantName =
      txn.merchantName !== null &&
      txn.merchantName !== undefined &&
      txn.merchantName.toLowerCase().includes(pattern);
    const inName = txn.name.toLowerCase().includes(pattern);
    if (!inMerchantName && !inName) return false;
  }

  // account_id — exact match
  if (rule.accountId !== null && rule.accountId !== undefined) {
    if (txn.accountId !== rule.accountId) return false;
  }

  // pfc_detailed — exact match
  if (rule.pfcDetailed !== null && rule.pfcDetailed !== undefined) {
    if (txn.pfcDetailed !== rule.pfcDetailed) return false;
  }

  // pfc_primary — exact match
  if (rule.pfcPrimary !== null && rule.pfcPrimary !== undefined) {
    if (txn.pfcPrimary !== rule.pfcPrimary) return false;
  }

  // amount_min — transaction amount must be >= rule.amount_min
  if (rule.amountMin !== null && rule.amountMin !== undefined) {
    if (amount < parseFloat(rule.amountMin)) return false;
  }

  // amount_max — transaction amount must be <= rule.amount_max
  if (rule.amountMax !== null && rule.amountMax !== undefined) {
    if (amount > parseFloat(rule.amountMax)) return false;
  }

  return true;
}

/**
 * Finds the OTHER detailed code key for a given pfc_primary by scanning the
 * map for a key matching `<PRIMARY>_OTHER*`. Returns the key string or null
 * if not found (unknown primary or map not yet seeded).
 *
 * The PFCv2 taxonomy guarantees one OTHER code per primary; scanning is safe
 * at our map size (127 entries).
 */
function buildOtherKey(
  pfcPrimary: string,
  map: Map<string, PlaidCategoryMap>,
): string | null {
  const prefix = pfcPrimary + "_OTHER";
  for (const key of map.keys()) {
    if (key.startsWith(prefix)) {
      return key;
    }
  }
  return null;
}
