import { DollarSign } from "lucide-react";

import {
  getBudgetStatus,
  getMonthlyIncomeEstimate,
  getAccounts,
  currentNYMonth,
} from "@/domain/metrics";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import { EmptyState } from "@/components/EmptyState";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import { BudgetStatusCard } from "@/components/budget/BudgetStatusCard";
import {
  SavingsTargetEditor,
  IncomeOverrideEditor,
} from "@/components/budget/SpendingPlanEditors";

export const dynamic = "force-dynamic";

export default async function BudgetPage() {
  const [budget, income, accounts] = await Promise.all([
    getBudgetStatus(currentNYMonth()),
    getMonthlyIncomeEstimate(),
    getAccounts(),
  ]);

  // Derive sync status — mirrors dashboard derivation exactly.
  const itemMap = new Map<string, { lastSyncedAt: Date | null; status: string }>();
  for (const account of accounts) {
    const existing = itemMap.get(account.itemId);
    if (!existing) {
      itemMap.set(account.itemId, {
        lastSyncedAt: account.lastSyncedAt,
        status: account.itemStatus,
      });
    } else {
      if (
        account.lastSyncedAt &&
        (!existing.lastSyncedAt || account.lastSyncedAt > existing.lastSyncedAt)
      ) {
        existing.lastSyncedAt = account.lastSyncedAt;
      }
    }
  }

  let lastSyncedAt: Date | null = null;
  let itemsInError = 0;
  for (const item of itemMap.values()) {
    if (item.status !== "active") itemsInError++;
    if (item.lastSyncedAt && (!lastSyncedAt || item.lastSyncedAt > lastSyncedAt)) {
      lastSyncedAt = item.lastSyncedAt;
    }
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* Header row: title + sync pill */}
      <div className="flex items-center justify-between gap-2">
        <h1
          className="text-lg font-semibold"
          style={{ color: "var(--color-text)" }}
        >
          Budget
        </h1>
        <SyncStatusPill lastSyncedAt={lastSyncedAt} itemsInError={itemsInError} />
      </div>

      {/* Spending plan editors */}
      <Card title="Spending Plan">
        <SavingsTargetEditor currentTarget={income.savingsTarget} />
        <div style={{ borderTop: "1px solid var(--color-border)" }} />
        <IncomeOverrideEditor currentOverride={income.incomeOverride} />
      </Card>

      {/* Hero or empty state */}
      {budget.noIncomeData ? (
        <Card>
          <EmptyState
            icon={DollarSign}
            headline="No income data"
            body="Set a monthly income override above to get started."
          />
        </Card>
      ) : (
        <Card>
          {/* Safe-to-spend hero */}
          <div className="flex flex-col items-center gap-1 pb-4">
            <span
              className="text-xs font-medium uppercase tracking-wide"
              style={{ color: "var(--color-text-muted)" }}
            >
              Safe to spend per day
            </span>
            <div className="flex items-baseline gap-1">
              <Amount
                value={parseFloat(budget.safeToSpendPerDay)}
                variant="auto"
                size="xl"
              />
              <span
                className="text-sm"
                style={{ color: "var(--color-text-muted)" }}
              >
                /day
              </span>
            </div>
          </div>

          {/* Expandable status card */}
          <BudgetStatusCard
            status={budget.status}
            daysRemaining={budget.daysRemaining}
            leftToSpend={budget.leftToSpend}
            past30dAvgPerDay={budget.past30dAvgPerDay}
          />
        </Card>
      )}
    </div>
  );
}
