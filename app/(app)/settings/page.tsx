/**
 * Settings screen — UI Redesign Phase 2, T-R43
 * Design source: docs/specs/ui-redesign/design/Financify Redesign.dc.html lines 273-309.
 *
 * Two card sections, matching the prototype:
 *   BUDGET   — "Monthly budget" / "Savings target" trigger rows. Tapping a
 *              row expands it in place to reveal the *existing* editor
 *              component(s) for that setting — nothing about the editors
 *              themselves changed, only how they're revealed:
 *                - Monthly budget  → IncomeOverrideEditor (monthly income
 *                  override) + the per-category BudgetEditor list — this is
 *                  the exact "Monthly budgets" section the pre-redesign
 *                  Settings page always showed open; it now lives behind
 *                  this row's disclosure.
 *                - Savings target  → SavingsTargetEditor.
 *              All three editor components are reused unchanged from
 *              src/components/settings/BudgetEditor.tsx and
 *              src/components/budget/SpendingPlanEditors.tsx.
 *   ACCOUNT  — one row per linked institution (Landmark icon + name +
 *              accent "Reconnect" link reusing the same /api/plaid/link/update
 *              flow as the existing ReconnectButton components), a
 *              visual-only Notifications toggle stub, and a Log out row
 *              reusing the same sign-out flow as LogoutButton.
 *
 * Deviation from the pre-redesign page: the "Add account" (LinkAccountButton)
 * and "Install prompt" (InstallPrompt / A2HS) sections are not part of the
 * prototype's Settings screen and have been dropped here to match it
 * exactly — see redesign-phase2 working-memory Handoff notes for T-R43.
 */

import { Landmark, Bell } from "lucide-react";

import {
  getAccounts,
  getBudgetStatusV2,
  getMonthlyIncomeEstimate,
  currentNYMonth,
} from "@/domain/metrics";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { EmptyState } from "@/components/EmptyState";
import { BudgetEditor } from "@/components/settings/BudgetEditor";
import { ExpandableEditorRow } from "@/components/settings/ExpandableEditorRow";
import { ReconnectLink } from "@/components/settings/ReconnectLink";
import { NotificationsToggle } from "@/components/settings/NotificationsToggle";
import { LogoutRow } from "@/components/settings/LogoutRow";
import {
  SavingsTargetEditor,
  IncomeOverrideEditor,
} from "@/components/budget/SpendingPlanEditors";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Formatting — matches the prototype's fmt(): '$' + rounded, thousands commas
// ---------------------------------------------------------------------------

function fmt(amount: string): string {
  return "$" + Math.round(parseFloat(amount)).toLocaleString("en-US");
}

// ---------------------------------------------------------------------------
// Layout helpers
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="mb-2.5 px-1 text-xs font-bold uppercase"
      style={{ color: "var(--color-text-muted)", letterSpacing: "1.2px" }}
    >
      {children}
    </h2>
  );
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mb-6 overflow-hidden rounded-[var(--radius-card)] px-4"
      style={{ background: "var(--color-surface)" }}
    >
      {children}
    </div>
  );
}

function StaticRow({
  children,
  isLast,
}: {
  children: React.ReactNode;
  isLast?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 py-3.5"
      style={{ borderBottom: isLast ? "none" : "1px solid var(--color-border)" }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function SettingsPage() {
  const month = currentNYMonth();

  const [allAccounts, budgetStatus, income] = await Promise.all([
    getAccounts(),
    getBudgetStatusV2(month),
    // Kept solely to supply currentOverride to IncomeOverrideEditor —
    // BudgetStatusV2Result does not expose incomeOverride (see /budget page).
    getMonthlyIncomeEstimate(),
  ]);

  // One row per institution/item (dedupe by itemId) — same derivation the
  // pre-redesign Settings page used.
  const seenItems = new Set<string>();
  const itemRows = allAccounts.filter((a) => {
    if (seenItems.has(a.itemId)) return false;
    seenItems.add(a.itemId);
    return true;
  });

  // Expense categories + current effective budget per category, feeding the
  // per-category BudgetEditor list revealed under "Monthly budget" — same
  // query the pre-redesign Settings page ran (FR-034 "latest effective_month
  // <= today" pattern).
  const todayStr = `${new Date().getUTCFullYear()}-${String(
    new Date().getUTCMonth() + 1,
  ).padStart(2, "0")}-01`;

  const expenseCategories = await db
    .select({ id: categories.id, label: categories.label })
    .from(categories)
    .where(eq(categories.group, "expense"))
    .orderBy(categories.sortOrder, categories.label);

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

  return (
    <main
      className="mx-auto min-h-screen max-w-lg px-4 py-6 pb-24"
      style={{ background: "var(--color-canvas)" }}
    >
      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.5px",
          color: "var(--color-text)",
          padding: "6px 2px 14px",
        }}
      >
        Settings
      </h1>

      {/* -------------------------------------------------------------- */}
      {/* BUDGET                                                          */}
      {/* -------------------------------------------------------------- */}
      <SectionHeader>BUDGET</SectionHeader>
      <SettingsCard>
        <ExpandableEditorRow label="Monthly budget" value={fmt(budgetStatus.budgetedTotal)}>
          <IncomeOverrideEditor currentOverride={income.incomeOverride} />
          <div style={{ borderTop: "1px solid var(--color-border)" }} />
          {expenseCategories.length === 0 ? (
            <p
              className="px-1 py-3 text-sm"
              style={{ color: "var(--color-text-muted)" }}
            >
              No expense categories found.
            </p>
          ) : (
            expenseCategories.map((cat, idx) => (
              <div
                key={cat.id}
                style={{
                  borderTop: idx === 0 ? "none" : "1px solid var(--color-border)",
                }}
              >
                <BudgetEditor
                  categoryId={cat.id}
                  categoryLabel={cat.label}
                  currentBudget={budgetMap.get(cat.id) ?? null}
                />
              </div>
            ))
          )}
        </ExpandableEditorRow>

        <ExpandableEditorRow
          label="Savings target"
          value={fmt(budgetStatus.savingsTarget)}
          isLast
        >
          <SavingsTargetEditor currentTarget={budgetStatus.savingsTarget} />
        </ExpandableEditorRow>
      </SettingsCard>

      {/* -------------------------------------------------------------- */}
      {/* ACCOUNT                                                         */}
      {/* -------------------------------------------------------------- */}
      <SectionHeader>ACCOUNT</SectionHeader>
      <SettingsCard>
        {itemRows.length === 0 ? (
          <div className="py-2">
            <EmptyState
              icon={Landmark}
              headline="No accounts linked"
              body="Connect your bank or credit card to see reconnect status here."
            />
          </div>
        ) : (
          itemRows.map((item) => (
            <StaticRow key={item.itemId}>
              <Landmark
                size={17}
                aria-hidden="true"
                style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
              />
              <span
                className="flex-1 truncate text-[15px] font-medium"
                style={{ color: "var(--color-text)" }}
              >
                {item.institutionName}
              </span>
              <ReconnectLink itemId={item.itemId} />
            </StaticRow>
          ))
        )}

        <StaticRow>
          <Bell
            size={17}
            aria-hidden="true"
            style={{ color: "var(--color-text-muted)", flexShrink: 0 }}
          />
          <span
            className="flex-1 text-[15px] font-medium"
            style={{ color: "var(--color-text)" }}
          >
            Notifications
          </span>
          <NotificationsToggle />
        </StaticRow>

        <LogoutRow />
      </SettingsCard>
    </main>
  );
}
