/**
 * Settings screen — output-rendering.md § Screen 5
 *
 * Sections (server-rendered, client islands as leaves):
 *   1. ItemHealthList   — one row per linked institution; status pill + Reconnect
 *   2. Link Account     — LinkAccountButton (standalone-mode-aware)
 *   3. Budget Manager   — expense categories with inline BudgetEditor
 *   4. InstallPrompt    — A2HS instruction card (hidden when standalone)
 *   5. App Version      — from package.json
 *   6. LogoutButton
 */

import { getAccounts } from "@/domain/metrics";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { LinkAccountButton } from "@/components/LinkAccountButton";
import { InstallPrompt } from "@/components/InstallPrompt";
import { LogoutButton } from "@/components/LogoutButton";
import { ReconnectButton } from "@/components/settings/ReconnectButton";
import { BudgetEditor } from "@/components/settings/BudgetEditor";
import pkgJson from "../../../package.json";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Status pill helper (server-side)
// ---------------------------------------------------------------------------

interface StatusPillProps {
  status: string;
}

function StatusPill({ status }: StatusPillProps) {
  const configs: Record<
    string,
    { label: string; bg: string; color: string }
  > = {
    active: {
      label: "Active",
      bg: "rgba(54,201,142,0.15)",
      color: "var(--color-positive)",
    },
    login_required: {
      label: "Login required",
      bg: "rgba(255,107,107,0.15)",
      color: "var(--color-negative)",
    },
    pending_disconnect: {
      label: "Reconnect soon",
      bg: "rgba(255,180,84,0.15)",
      color: "var(--color-chart-3)",
    },
    revoked: {
      label: "Revoked",
      bg: "rgba(255,107,107,0.15)",
      color: "var(--color-negative)",
    },
  };

  const cfg = configs[status] ?? {
    label: status,
    bg: "rgba(139,147,163,0.15)",
    color: "var(--color-text-muted)",
  };

  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Last-synced display helper
// ---------------------------------------------------------------------------

function formatLastSynced(date: Date | null): string {
  if (!date) return "Never synced";
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 2) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

// ---------------------------------------------------------------------------
// Section card wrapper
// ---------------------------------------------------------------------------

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <h2
        className="text-xs font-semibold uppercase tracking-wider mb-3 px-1"
        style={{ color: "var(--color-text-muted)" }}
      >
        {title}
      </h2>
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
        }}
      >
        {children}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SettingsPage() {
  // Fetch accounts for ItemHealthList
  const allAccounts = await getAccounts();

  // Derive one row per item (deduplicate by itemId)
  const seenItems = new Set<string>();
  const itemRows = allAccounts.filter((a) => {
    if (seenItems.has(a.itemId)) return false;
    seenItems.add(a.itemId);
    return true;
  });

  // Fetch expense categories with their current effective budget
  // Uses the same "latest effective_month <= today" pattern as FR-034.
  const today = new Date();
  const todayStr = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-01`;

  const expenseCategories = await db
    .select({
      id: categories.id,
      label: categories.label,
    })
    .from(categories)
    .where(eq(categories.group, "expense"))
    .orderBy(categories.sortOrder, categories.label);

  // Fetch current effective budget per category in one query
  const effectiveBudgetRows = await db.execute(sql`
    SELECT DISTINCT ON (category_id)
      category_id AS "categoryId",
      amount::text AS amount
    FROM budgets
    WHERE effective_month <= ${todayStr}::date
    ORDER BY category_id, effective_month DESC
  `);

  const budgetMap = new Map<string, string>();
  for (const row of effectiveBudgetRows.rows as Array<{
    categoryId: string;
    amount: string;
  }>) {
    budgetMap.set(row.categoryId, row.amount);
  }

  const appVersion: string = pkgJson.version;

  return (
    <main
      className="min-h-screen px-4 py-6 max-w-lg mx-auto"
      style={{ background: "var(--color-canvas)" }}
    >
      <h1
        className="text-xl font-semibold mb-8"
        style={{ color: "var(--color-text)" }}
      >
        Settings
      </h1>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Linked accounts + item health                                    */}
      {/* ------------------------------------------------------------------ */}
      <SectionCard title="Linked accounts">
        {itemRows.length === 0 ? (
          <p
            className="px-4 py-4 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            No accounts linked yet.
          </p>
        ) : (
          <ul>
            {itemRows.map((item, idx) => (
              <li
                key={item.itemId}
                className="px-4 py-3 flex items-center justify-between gap-3"
                style={{
                  borderTop:
                    idx === 0
                      ? "none"
                      : "1px solid var(--color-border)",
                }}
              >
                <div className="flex flex-col gap-1 min-w-0">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: "var(--color-text)" }}
                  >
                    {item.institutionName}
                  </span>
                  <div className="flex items-center gap-2">
                    <StatusPill status={item.itemStatus} />
                    <span
                      className="text-xs"
                      style={{ color: "var(--color-text-muted)" }}
                    >
                      {formatLastSynced(item.lastSyncedAt)}
                    </span>
                  </div>
                </div>
                {item.itemStatus !== "active" && (
                  <ReconnectButton itemId={item.itemId} />
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Link a new account                                               */}
      {/* ------------------------------------------------------------------ */}
      <SectionCard title="Add account">
        <div className="px-4 py-4">
          <LinkAccountButton />
        </div>
      </SectionCard>

      {/* ------------------------------------------------------------------ */}
      {/* 3. Budget management                                                */}
      {/* ------------------------------------------------------------------ */}
      <SectionCard title="Monthly budgets">
        {expenseCategories.length === 0 ? (
          <p
            className="px-4 py-4 text-sm"
            style={{ color: "var(--color-text-muted)" }}
          >
            No expense categories found.
          </p>
        ) : (
          <ul>
            {expenseCategories.map((cat, idx) => (
              <li
                key={cat.id}
                className="px-4"
                style={{
                  borderTop:
                    idx === 0 ? "none" : "1px solid var(--color-border)",
                }}
              >
                <BudgetEditor
                  categoryId={cat.id}
                  categoryLabel={cat.label}
                  currentBudget={budgetMap.get(cat.id) ?? null}
                />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Install prompt (hidden in standalone)                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="mb-6">
        <InstallPrompt />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* 5. App version + logout                                             */}
      {/* ------------------------------------------------------------------ */}
      <SectionCard title="App">
        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <span className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Version
          </span>
          <span
            className="text-sm tabular-nums"
            style={{ color: "var(--color-text)" }}
          >
            {appVersion}
          </span>
        </div>
        <div className="px-4 py-3">
          <LogoutButton />
        </div>
      </SectionCard>
    </main>
  );
}
