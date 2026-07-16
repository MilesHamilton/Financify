/**
 * /budget — Budget screen (T-R40 redesign)
 *
 * Rebuilt to match the prototype (Financify Redesign.dc.html lines 27–135 +
 * screenshot-1.png). Screenshots show Bills & Utilities and Earnings SIDE BY
 * SIDE (the archived dc.html only had a stacked Bills card); per the task
 * brief we follow the screenshots.
 *
 * Data comes from getBudgetStatusV2(month) (all card math), getCategoryBreakdown
 * (category rows) and getMonthlyIncomeEstimate (income editor override — Phase-1
 * R2: this field has no v2 equivalent). The month is selected via ?month=YYYY-MM
 * (server re-fetch). There is NO database in this environment, so every data
 * fetch is wrapped so the screen degrades to an EmptyState instead of throwing.
 */

import { Suspense } from "react";
import { Wallet, Receipt, Banknote, DollarSign } from "lucide-react";
import {
  getBudgetStatusV2,
  getMonthlyIncomeEstimate,
  getCategoryBreakdown,
  getAccounts,
  currentNYMonth,
} from "@/domain/metrics";
import { db } from "@/db";
import { categories } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { EmptyState } from "@/components/EmptyState";
import { Skeleton } from "@/components/Skeleton";
import { SyncStatusPill } from "@/components/SyncStatusPill";
import {
  BudgetMetricCard,
  SavingsTargetCard,
} from "@/components/budget/BudgetStatusCard";
import {
  CategoryBudgetRow,
  fmtDollars,
} from "@/components/budget/CategoryBudgetRow";
import {
  MonthHeaderPills,
  AddBudgetPanel,
  type PanelCategory,
} from "@/components/budget/SpendingPlanEditors";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Month helpers
// ---------------------------------------------------------------------------

/** Subtract `n` months from a YYYY-MM string. */
function subMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  let year = y;
  let mon = m - n;
  while (mon <= 0) {
    mon += 12;
    year -= 1;
  }
  return `${year}-${String(mon).padStart(2, "0")}`;
}

/** Clamp a raw ?month= value into [minMonth, maxMonth]; default to maxMonth. */
function resolveMonth(
  raw: string | string[] | undefined,
  minMonth: string,
  maxMonth: string,
): string {
  if (!raw) return maxMonth;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!/^\d{4}-\d{2}$/.test(value)) return maxMonth;
  if (value > maxMonth) return maxMonth;
  if (value < minMonth) return minMonth;
  return value;
}

/** Format YYYY-MM as "July 2026". */
function formatMonthLabel(month: string): string {
  const [y, m] = month.split("-");
  const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function SectionHeader({
  children,
  action,
  className = "",
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between px-0.5 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-[1.2px] text-[var(--color-text-muted)]">
        {children}
      </span>
      {action}
    </div>
  );
}

function BudgetSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-[136px] w-full" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-[120px] w-full" />
        <Skeleton className="h-[120px] w-full" />
      </div>
      <Skeleton className="mt-4 h-[190px] w-full" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data + content (Suspense boundary)
// ---------------------------------------------------------------------------

async function BudgetContent({
  month,
  isCurrent,
}: {
  month: string;
  isCurrent: boolean;
}) {
  let budget: Awaited<ReturnType<typeof getBudgetStatusV2>>;
  let income: Awaited<ReturnType<typeof getMonthlyIncomeEstimate>>;
  let breakdown: Awaited<ReturnType<typeof getCategoryBreakdown>>;
  let catList: Array<{
    id: string;
    label: string;
    icon: string;
    color: string;
  }>;

  try {
    [budget, income, breakdown, catList] = await Promise.all([
      getBudgetStatusV2(month),
      getMonthlyIncomeEstimate(),
      getCategoryBreakdown(month),
      db
        .select({
          id: categories.id,
          label: categories.label,
          icon: categories.icon,
          color: categories.color,
        })
        .from(categories)
        .where(eq(categories.group, "expense"))
        .orderBy(asc(categories.label)),
    ]);
  } catch {
    // No database / query failure → degrade gracefully (never throw).
    return (
      <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)]">
        <EmptyState
          icon={Wallet}
          headline="No budget data yet"
          body="Connect an account and set a budget to see your spending plan."
        />
      </div>
    );
  }

  // Map current budget per category for the management panel.
  const budgetByCat = new Map(breakdown.map((r) => [r.categoryId, r.budget]));
  const panelCategories: PanelCategory[] = catList.map((c) => ({
    id: c.id,
    label: c.label,
    budget: budgetByCat.get(c.id) ?? null,
  }));

  const addBudgetTrigger = (
    <AddBudgetPanel
      categories={panelCategories}
      currentTarget={budget.savingsTarget}
      currentOverride={income.incomeOverride}
    />
  );

  // No income → cannot compute a meaningful budget. Offer the editor flow.
  if (budget.noIncomeData) {
    return (
      <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)]">
        <EmptyState
          icon={DollarSign}
          headline="No income yet"
          body="Set your monthly income to unlock your budget and daily spending rate."
          action={addBudgetTrigger}
        />
      </div>
    );
  }

  // ── Spending card ──────────────────────────────────────────────────────────
  const leftToSpendNum = parseFloat(budget.leftToSpend);
  const safePerDay = parseFloat(budget.safeToSpendPerDay);
  const overBudget = leftToSpendNum < 0;
  const dayChip = isCurrent
    ? `$${Math.round(safePerDay)}/day for ${budget.daysRemaining}d`
    : null;
  const spendHeadline = overBudget
    ? `${fmtDollars(-leftToSpendNum)} over budget`
    : `${fmtDollars(leftToSpendNum)} ${isCurrent ? "left to spend" : "under budget"}`;

  // ── Bills card ─────────────────────────────────────────────────────────────
  const billsLeft = parseFloat(budget.billsLeftToPay);
  const billsPaid = parseFloat(budget.billsPaidThisMonth);
  const billsHeadline = isCurrent
    ? `${fmtDollars(billsLeft)} left to pay`
    : "All bills paid";

  // ── Earnings card ──────────────────────────────────────────────────────────
  const incomeNum = parseFloat(budget.monthlyIncome);
  const earned = parseFloat(budget.earnedThisMonth);
  const toEarn = Math.max(0, incomeNum - earned);
  const earnedPct = incomeNum > 0 ? Math.min(1, earned / incomeNum) : 1;
  const earningsHeadline = isCurrent
    ? `${fmtDollars(toEarn)} to earn`
    : "All earned";

  // ── Savings target card ────────────────────────────────────────────────────
  const target = parseFloat(budget.savingsTarget);
  const projected = parseFloat(budget.projectedSavings);
  const onTrack = budget.savingsStatus === "on_track";
  const targetTick =
    target >= 1000
      ? `$${Math.round(target / 100) / 10}k`
      : fmtDollars(target);
  const advicePerDay = parseFloat(budget.advicePerDay);
  const advice =
    isCurrent && !onTrack
      ? {
          title: "Try to slow down your spending.",
          body: `You can still meet your savings target by limiting flexible spend to $${Math.max(
            0,
            Math.round(advicePerDay),
          )}/day for the rest of the month.`,
        }
      : null;

  // ── Category rows (only categories with a budget set) ──────────────────────
  const catRows = breakdown.filter(
    (r) => r.budget != null && parseFloat(r.budget) > 0,
  );

  return (
    <div className="flex flex-col">
      {/* Spending card */}
      <BudgetMetricCard
        icon={Wallet}
        caption="Spending"
        headline={spendHeadline}
        negative={overBudget}
        pct={budget.spendPct}
        footerLeft={`${fmtDollars(parseFloat(budget.flexibleSpentThisMonth))} spent`}
        footerRight={`${fmtDollars(parseFloat(budget.budgetedTotal))} budgeted`}
        chip={dayChip}
      />

      {/* Bills & Utilities + Earnings, side by side */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <BudgetMetricCard
          icon={Receipt}
          caption="Bills & Utilities"
          headline={billsHeadline}
          pct={budget.billsPct}
          footerLeft={`${fmtDollars(billsPaid)} paid`}
        />
        <BudgetMetricCard
          icon={Banknote}
          caption="Earnings"
          headline={earningsHeadline}
          pct={earnedPct}
          footerLeft={`${fmtDollars(earned)} earned`}
        />
      </div>

      {/* Savings target */}
      <SectionHeader className="mb-2.5 mt-[22px]">SAVINGS TARGET</SectionHeader>
      <SavingsTargetCard
        caption={isCurrent ? "Projected Savings" : "Saved"}
        projectedLabel={fmtDollars(projected)}
        ofTargetLabel={`Of ${fmtDollars(target)} Target`}
        riskLabel={
          isCurrent
            ? onTrack
              ? "On Track"
              : "At Risk"
            : onTrack
              ? "Target Met"
              : "Missed"
        }
        atRisk={!onTrack}
        targetTick={targetTick}
        savingsBarPct={budget.savingsBarPct}
        advice={advice}
      />

      {/* Category budgets */}
      <SectionHeader className="mb-2.5 mt-[22px]" action={addBudgetTrigger}>
        CATEGORY BUDGETS
      </SectionHeader>
      {catRows.length > 0 ? (
        <div className="flex flex-col gap-2">
          {catRows.map((r) => (
            <CategoryBudgetRow
              key={r.categoryId}
              name={r.label}
              color={r.color}
              icon={r.icon}
              spent={r.spent}
              budgetAmount={parseFloat(r.budget as string)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[var(--radius-card)] bg-[var(--color-surface)]">
          <EmptyState
            icon={Wallet}
            headline="No category budgets"
            body="Add a budget to unlock the daily rate and per-category tracking."
            action={addBudgetTrigger}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface BudgetPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function BudgetPage({ searchParams }: BudgetPageProps) {
  const params = await searchParams;
  const currentMonth = currentNYMonth();
  const minMonth = subMonths(currentMonth, 11);
  const month = resolveMonth(params.month, minMonth, currentMonth);
  const isCurrent = month === currentMonth;
  const monthLabel = isCurrent ? "This Month" : formatMonthLabel(month);

  // Sync-pill data — resilient (no DB in this env → degrade silently).
  let lastSyncedAt: Date | null = null;
  let itemsInError = 0;
  try {
    const accounts = await getAccounts();
    const itemMap = new Map<
      string,
      { lastSyncedAt: Date | null; status: string }
    >();
    for (const account of accounts) {
      const existing = itemMap.get(account.itemId);
      if (!existing) {
        itemMap.set(account.itemId, {
          lastSyncedAt: account.lastSyncedAt,
          status: account.itemStatus,
        });
      } else if (
        account.lastSyncedAt &&
        (!existing.lastSyncedAt || account.lastSyncedAt > existing.lastSyncedAt)
      ) {
        existing.lastSyncedAt = account.lastSyncedAt;
      }
    }
    for (const item of itemMap.values()) {
      if (item.status !== "active") itemsInError++;
      if (
        item.lastSyncedAt &&
        (!lastSyncedAt || item.lastSyncedAt > lastSyncedAt)
      ) {
        lastSyncedAt = item.lastSyncedAt;
      }
    }
  } catch {
    // No accounts / DB — SyncStatusPill renders its "failed" state.
  }

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* Header: title + sync pill */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <h1 className="text-[28px] font-bold tracking-[-0.5px] text-[var(--color-text)]">
          Budget
        </h1>
        <SyncStatusPill lastSyncedAt={lastSyncedAt} itemsInError={itemsInError} />
      </div>

      {/* Month selector pills */}
      <MonthHeaderPills
        month={month}
        label={monthLabel}
        minMonth={minMonth}
        maxMonth={currentMonth}
      />

      <Suspense fallback={<BudgetSkeleton />}>
        <BudgetContent month={month} isCurrent={isCurrent} />
      </Suspense>
    </div>
  );
}
