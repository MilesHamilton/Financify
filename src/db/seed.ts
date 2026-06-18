/**
 * Idempotent seed script — categories (14 rows) + plaid_category_map (127 rows).
 *
 * Run:  npx tsx src/db/seed.ts
 *
 * Requires DATABASE_URL in environment. Loads .env.local via dotenv so it can
 * be run locally without manually exporting env vars.
 *
 * Source of truth:
 *   - categories:       TR.md § 2.4
 *   - plaid_category_map: abstraction-layer.md Mapping Tables section
 *   - taxonomy CSV:     src/db/pfc-taxonomy-all.csv (127 detailed codes)
 */

import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { sql } from "drizzle-orm";

dotenv.config({ path: ".env.local" });

// Import db after dotenv so DATABASE_URL is available.
import { db } from "./index";
import { appSettings, categories, plaidCategoryMap } from "./schema";
import type { NewCategory, NewPlaidCategoryMap } from "./schema";

// ---------------------------------------------------------------------------
// 1. Display categories — TR.md § 2.4
//    Fields: id, label, group, icon, color, sort_order
//    Icons use lucide-react names (kebab-case).
//    Colors are hex, chosen to match the Rocket-Money-style palette in the TR.
// ---------------------------------------------------------------------------

const SEED_CATEGORIES: NewCategory[] = [
  {
    id: "income",
    label: "Income",
    group: "income",
    icon: "trending-up",
    color: "#22c55e",
    sortOrder: 1,
  },
  {
    id: "housing",
    label: "Housing & Rent",
    group: "expense",
    icon: "home",
    color: "#6366f1",
    sortOrder: 2,
  },
  {
    id: "bills_utilities",
    label: "Bills & Utilities",
    group: "expense",
    icon: "zap",
    color: "#8b5cf6",
    sortOrder: 3,
  },
  {
    id: "groceries",
    label: "Groceries",
    group: "expense",
    icon: "shopping-cart",
    color: "#84cc16",
    sortOrder: 4,
  },
  {
    id: "dining_out",
    label: "Dining & Drinks",
    group: "expense",
    icon: "utensils",
    color: "#f97316",
    sortOrder: 5,
  },
  {
    id: "auto_transport",
    label: "Auto & Transport",
    group: "expense",
    icon: "car",
    color: "#0ea5e9",
    sortOrder: 6,
  },
  {
    id: "travel",
    label: "Travel",
    group: "expense",
    icon: "plane",
    color: "#06b6d4",
    sortOrder: 7,
  },
  {
    id: "shopping",
    label: "Shopping",
    group: "expense",
    icon: "shopping-bag",
    color: "#ec4899",
    sortOrder: 8,
  },
  {
    id: "entertainment",
    label: "Entertainment",
    group: "expense",
    icon: "music",
    color: "#a855f7",
    sortOrder: 9,
  },
  {
    id: "health",
    label: "Health & Wellness",
    group: "expense",
    icon: "heart-pulse",
    color: "#ef4444",
    sortOrder: 10,
  },
  {
    id: "fees_charges",
    label: "Fees & Charges",
    group: "expense",
    icon: "receipt",
    color: "#f59e0b",
    sortOrder: 11,
  },
  {
    id: "other_spending",
    label: "Other",
    group: "expense",
    icon: "circle-ellipsis",
    color: "#94a3b8",
    sortOrder: 12,
  },
  {
    id: "transfers",
    label: "Transfers & CC Payments",
    group: "transfer",
    icon: "arrow-left-right",
    color: "#64748b",
    sortOrder: 13,
  },
  {
    id: "uncategorized",
    label: "Uncategorized",
    group: "expense",
    icon: "help-circle",
    color: "#475569",
    sortOrder: 14,
  },
];

// ---------------------------------------------------------------------------
// 2. PFCv2 primary → display category mapping
//    Per abstraction-layer.md Mapping Tables section.
//
//    Special cases that override the primary-level default:
//      - FOOD_AND_DRINK_GROCERIES → groceries (rest of FOOD_AND_DRINK → dining_out)
//      - RENT_AND_UTILITIES_RENT → housing (rest of RENT_AND_UTILITIES → bills_utilities)
//      - LOAN_PAYMENTS_CREDIT_CARD_PAYMENT → transfers + exclude_default=true
//      - All LOAN_PAYMENTS (rest) → transfers + exclude_default=true
//      - All TRANSFER_IN_* → transfers + exclude_default=true
//      - All TRANSFER_OUT_* → transfers + exclude_default=true
//      - LOAN_DISBURSEMENTS → income (loan disbursements are money coming in)
//      - OTHER_OTHER → uncategorized
// ---------------------------------------------------------------------------

// Primary-level default mapping (applied to all detailed codes under a primary
// unless overridden by the detailed-level map below).
const PRIMARY_TO_CATEGORY: Record<string, { categoryId: string; excludeDefault: boolean }> = {
  INCOME: { categoryId: "income", excludeDefault: false },
  LOAN_DISBURSEMENTS: { categoryId: "income", excludeDefault: false },
  LOAN_PAYMENTS: { categoryId: "transfers", excludeDefault: true },
  TRANSFER_IN: { categoryId: "transfers", excludeDefault: true },
  TRANSFER_OUT: { categoryId: "transfers", excludeDefault: true },
  BANK_FEES: { categoryId: "fees_charges", excludeDefault: false },
  ENTERTAINMENT: { categoryId: "entertainment", excludeDefault: false },
  FOOD_AND_DRINK: { categoryId: "dining_out", excludeDefault: false },
  GENERAL_MERCHANDISE: { categoryId: "shopping", excludeDefault: false },
  GENERAL_SERVICES: { categoryId: "other_spending", excludeDefault: false },
  GOVERNMENT_AND_NON_PROFIT: { categoryId: "other_spending", excludeDefault: false },
  HOME_IMPROVEMENT: { categoryId: "shopping", excludeDefault: false },
  MEDICAL: { categoryId: "health", excludeDefault: false },
  PERSONAL_CARE: { categoryId: "health", excludeDefault: false },
  RENT_AND_UTILITIES: { categoryId: "bills_utilities", excludeDefault: false },
  TRANSPORTATION: { categoryId: "auto_transport", excludeDefault: false },
  TRAVEL: { categoryId: "travel", excludeDefault: false },
  OTHER: { categoryId: "uncategorized", excludeDefault: false },
};

// Detailed-level overrides — only rows that differ from their primary default.
const DETAILED_OVERRIDE: Record<string, { categoryId: string; excludeDefault: boolean }> = {
  // FOOD_AND_DRINK: groceries is carved out; the rest stay as dining_out (primary default)
  FOOD_AND_DRINK_GROCERIES: { categoryId: "groceries", excludeDefault: false },

  // RENT_AND_UTILITIES: rent is carved out; the rest stay as bills_utilities (primary default)
  RENT_AND_UTILITIES_RENT: { categoryId: "housing", excludeDefault: false },
};

// ---------------------------------------------------------------------------
// 3. Parse CSV
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = path.join(__dirname, "pfc-taxonomy-all.csv");

interface CsvRow {
  primary: string;
  detailed: string;
}

function parseCsv(filePath: string): CsvRow[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  // Skip header
  const dataLines = lines.slice(1);
  return dataLines.map((line) => {
    // Only split on the first two commas — description may contain commas
    const commaIdx = line.indexOf(",");
    const primary = line.slice(0, commaIdx).trim();
    const rest = line.slice(commaIdx + 1);
    const commaIdx2 = rest.indexOf(",");
    const detailed = rest.slice(0, commaIdx2).trim();
    return { primary, detailed };
  });
}

// ---------------------------------------------------------------------------
// 4. Build plaid_category_map rows
// ---------------------------------------------------------------------------

function buildMapRows(csvRows: CsvRow[]): NewPlaidCategoryMap[] {
  return csvRows.map(({ primary, detailed }) => {
    const override = DETAILED_OVERRIDE[detailed];
    const primaryDefault = PRIMARY_TO_CATEGORY[primary];

    if (!primaryDefault) {
      // Unknown primary — fall back to uncategorized; log loudly
      console.warn(`[seed] Unknown PFC primary "${primary}" for detailed "${detailed}" — mapping to uncategorized`);
      return {
        pfcDetailed: detailed,
        pfcPrimary: primary,
        categoryId: "uncategorized",
        excludeDefault: false,
      };
    }

    const resolved = override ?? primaryDefault;
    return {
      pfcDetailed: detailed,
      pfcPrimary: primary,
      categoryId: resolved.categoryId,
      excludeDefault: resolved.excludeDefault,
    };
  });
}

// ---------------------------------------------------------------------------
// 5. Assertions
// ---------------------------------------------------------------------------

function runAssertions(mapRows: NewPlaidCategoryMap[]): void {
  // Assert LOAN_PAYMENTS_CREDIT_CARD_PAYMENT is exclude_default=true
  const ccPayment = mapRows.find((r) => r.pfcDetailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT");
  if (!ccPayment) {
    throw new Error("Assertion failed: LOAN_PAYMENTS_CREDIT_CARD_PAYMENT not found in map rows");
  }
  if (!ccPayment.excludeDefault) {
    throw new Error("Assertion failed: LOAN_PAYMENTS_CREDIT_CARD_PAYMENT must have exclude_default=true");
  }

  // Assert ALL TRANSFER_IN_* and TRANSFER_OUT_* rows have exclude_default=true
  const transferRows = mapRows.filter(
    (r) => r.pfcPrimary === "TRANSFER_IN" || r.pfcPrimary === "TRANSFER_OUT",
  );
  const nonExcludedTransfers = transferRows.filter((r) => !r.excludeDefault);
  if (nonExcludedTransfers.length > 0) {
    throw new Error(
      `Assertion failed: these transfer rows are missing exclude_default=true: ${nonExcludedTransfers.map((r) => r.pfcDetailed).join(", ")}`,
    );
  }

  // Assert LOAN_PAYMENTS_* rows have exclude_default=true
  const loanPaymentRows = mapRows.filter((r) => r.pfcPrimary === "LOAN_PAYMENTS");
  const nonExcludedLoanPayments = loanPaymentRows.filter((r) => !r.excludeDefault);
  if (nonExcludedLoanPayments.length > 0) {
    throw new Error(
      `Assertion failed: these loan payment rows are missing exclude_default=true: ${nonExcludedLoanPayments.map((r) => r.pfcDetailed).join(", ")}`,
    );
  }

  // Assert total mapped row count matches CSV detailed-code count (127)
  const csvRows = parseCsv(csvPath);
  if (mapRows.length !== csvRows.length) {
    throw new Error(
      `Assertion failed: map row count (${mapRows.length}) !== CSV detailed code count (${csvRows.length})`,
    );
  }

  console.log(`[seed] Assertions passed:`);
  console.log(`  - LOAN_PAYMENTS_CREDIT_CARD_PAYMENT: exclude_default=true ✓`);
  console.log(
    `  - ${transferRows.length} TRANSFER_IN_*/TRANSFER_OUT_* rows: all exclude_default=true ✓`,
  );
  console.log(
    `  - ${loanPaymentRows.length} LOAN_PAYMENTS_* rows: all exclude_default=true ✓`,
  );
  console.log(`  - Total map rows: ${mapRows.length} === CSV detailed codes: ${csvRows.length} ✓`);
}

// ---------------------------------------------------------------------------
// 6. Log mapping coverage summary
// ---------------------------------------------------------------------------

function logCoverage(mapRows: NewPlaidCategoryMap[]): void {
  const counts: Record<string, number> = {};
  for (const row of mapRows) {
    counts[row.categoryId] = (counts[row.categoryId] ?? 0) + 1;
  }
  console.log("\n[seed] Mapping coverage (rows per display category):");
  for (const cat of SEED_CATEGORIES) {
    const count = counts[cat.id] ?? 0;
    console.log(`  ${cat.id.padEnd(20)} ${String(count).padStart(3)} row(s)  [${cat.group}]  "${cat.label}"`);
  }
}

// ---------------------------------------------------------------------------
// 7. Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[seed] Starting seed...");

  // Parse CSV
  const csvRows = parseCsv(csvPath);
  console.log(`[seed] Parsed ${csvRows.length} detailed PFC codes from CSV`);

  // Build map rows
  const mapRows = buildMapRows(csvRows);

  // Run assertions before touching the DB
  runAssertions(mapRows);

  // Log coverage
  logCoverage(mapRows);

  // Upsert categories
  console.log(`\n[seed] Upserting ${SEED_CATEGORIES.length} categories...`);
  for (const cat of SEED_CATEGORIES) {
    await db
      .insert(categories)
      .values(cat)
      .onConflictDoUpdate({
        target: categories.id,
        set: {
          label: cat.label,
          icon: cat.icon,
          color: cat.color,
          group: cat.group,
          sortOrder: cat.sortOrder,
        },
      });
  }
  console.log(`[seed] Categories upserted: ${SEED_CATEGORIES.length}`);

  // Upsert plaid_category_map
  console.log(`[seed] Upserting ${mapRows.length} plaid_category_map rows...`);
  // Batch in chunks of 50 to stay well under Postgres's 65535 parameter limit.
  const chunkSize = 50;
  for (let i = 0; i < mapRows.length; i += chunkSize) {
    const chunk = mapRows.slice(i, i + chunkSize);
    await db
      .insert(plaidCategoryMap)
      .values(chunk)
      .onConflictDoUpdate({
        target: plaidCategoryMap.pfcDetailed,
        set: {
          // Use EXCLUDED pseudo-table so re-runs update to the seeded values.
          pfcPrimary: sql`excluded.pfc_primary`,
          categoryId: sql`excluded.category_id`,
          excludeDefault: sql`excluded.exclude_default`,
        },
      });
  }
  console.log(`[seed] plaid_category_map upserted: ${mapRows.length}`);

  // Seed single-row app-settings default (savings target 0, no income override).
  await db
    .insert(appSettings)
    .values({ id: "app", monthlySavingsTarget: "0", monthlyIncomeOverride: null })
    .onConflictDoNothing();
  console.log(`[seed] app_settings default row ensured`);

  console.log("\n[seed] Done.");
}

main().catch((err) => {
  console.error("[seed] Fatal error:", err);
  process.exit(1);
});
