import nextDynamic from "next/dynamic";
import { Suspense } from "react";
import { PieChart } from "lucide-react";

import {
  getMonthSpend,
  getCategoryBreakdown,
  getMonthlySeries,
  currentNYMonth,
} from "@/domain/metrics";

import { Card } from "@/components/Card";
import { Skeleton } from "@/components/Skeleton";
import { EmptyState } from "@/components/EmptyState";

import { MonthPicker } from "@/components/spending/MonthPicker";
import { SpendTotalHeader } from "@/components/spending/SpendTotalHeader";
import { CategoryList } from "@/components/spending/CategoryList";

// Route segment config — force dynamic (authenticated, per-request). FR-042.
export const dynamic = "force-dynamic";

// Charts are code-split — Recharts only loads on this screen.
const MonthlySpendBarChart = nextDynamic(
  () =>
    import("@/components/spending/MonthlySpendBarChart").then(
      (m) => m.MonthlySpendBarChart
    ),
  {
    loading: () => <Skeleton className="h-40 w-full" />,
  }
);

const CategoryDonut = nextDynamic(
  () =>
    import("@/components/spending/CategoryDonut").then(
      (m) => m.CategoryDonut
    ),
  {
    loading: () => <Skeleton className="h-[220px] w-full" />,
  }
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Validate and clamp a raw ?month= searchParam.
 * Accepts YYYY-MM strings only; caps at the current NY month so the picker
 * can never navigate to a future month.
 */
function resolveMonth(
  raw: string | string[] | undefined,
  currentMonth: string
): string {
  if (!raw) return currentMonth;
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!/^\d{4}-\d{2}$/.test(value)) return currentMonth;
  return value <= currentMonth ? value : currentMonth;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface SpendingPageProps {
  // In Next.js 15+, searchParams is a Promise that must be awaited.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function SpendingPage({ searchParams }: SpendingPageProps) {
  const params = await searchParams;
  const currentMonth = currentNYMonth();
  const month = resolveMonth(params.month, currentMonth);

  const [spendData, breakdown, series] = await Promise.all([
    getMonthSpend(month),
    getCategoryBreakdown(month),
    getMonthlySeries(),
  ]);

  const hasSpend = parseFloat(spendData.totalSpend) > 0;

  return (
    <div className="flex flex-col gap-4 px-4 pb-6 pt-2">
      {/* Month picker — client component, prev/next arrows update ?month= */}
      <Card className="p-0 overflow-hidden">
        <MonthPicker month={month} maxMonth={currentMonth} />
      </Card>

      {/* Total spend + MoM delta */}
      <Card className="p-0">
        <SpendTotalHeader data={spendData} />
      </Card>

      {/* 12-month bar chart — tapping a bar navigates to that month */}
      <Card title="Monthly Spending">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <MonthlySpendBarChart series={series} selectedMonth={month} />
        </Suspense>
      </Card>

      {/* Donut + category list — shown only when there is spend data */}
      {hasSpend ? (
        <>
          <Card title="By Category">
            <Suspense fallback={<Skeleton className="h-[220px] w-full" />}>
              <CategoryDonut
                breakdown={breakdown}
                totalSpend={spendData.totalSpend}
              />
            </Suspense>
          </Card>

          <Card title="Categories">
            <CategoryList breakdown={breakdown} month={month} />
          </Card>
        </>
      ) : (
        <Card>
          <EmptyState
            icon={PieChart}
            headline="No spending this month"
            body="Transactions for this month will appear here once they're synced."
          />
        </Card>
      )}
    </div>
  );
}
