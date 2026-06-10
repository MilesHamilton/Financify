"use client";

import { useRouter } from "next/navigation";
import {
  BarChart,
  Bar,
  XAxis,
  Cell,
  ResponsiveContainer,
} from "recharts";
import type { MonthlySeriesRow } from "@/domain/metrics";

interface MonthlySpendBarChartProps {
  series: MonthlySeriesRow[];
  /** Currently selected month as YYYY-MM. */
  selectedMonth: string;
}

/** Convert a MonthlySeriesRow.month (YYYY-MM-DD first-of-month) to YYYY-MM. */
function toMonthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/** Abbreviated month label, e.g. "Jan", "Feb". */
function shortMonth(isoDate: string): string {
  const [yearStr, monthStr] = isoDate.split("-");
  const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

export function MonthlySpendBarChart({
  series,
  selectedMonth,
}: MonthlySpendBarChartProps) {
  const router = useRouter();

  const data = series.map((row) => ({
    month: toMonthKey(row.month),
    label: shortMonth(row.month),
    value: parseFloat(row.totalSpend),
  }));

  function handleBarClick(entry: { month: string }) {
    router.replace(`/spending?month=${entry.month}`);
  }

  return (
    <div className="h-40 w-full" aria-label="Monthly spending bar chart">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          barCategoryGap="20%"
          margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
        >
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{
              fontSize: 10,
              fill: "var(--color-text-muted)",
            }}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            cursor="pointer"
            onClick={(entry) => handleBarClick(entry as unknown as { month: string })}
          >
            {data.map((entry) => (
              <Cell
                key={entry.month}
                fill={
                  entry.month === selectedMonth
                    ? "var(--color-accent)"
                    : "var(--color-surface-2)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
