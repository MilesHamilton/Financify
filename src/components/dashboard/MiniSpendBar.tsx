"use client";

import { BarChart, Bar, Cell, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthlySeriesRow } from "@/domain/metrics";

interface MiniSpendBarProps {
  /** Last 6 months of spend data, chronological order. */
  series: MonthlySeriesRow[];
  /** The current month string (YYYY-MM-DD first-of-month, as returned by getMonthlySeries). */
  currentMonth: string;
}

const chartConfig: ChartConfig = {
  totalSpend: {
    label: "Spent",
    color: "var(--color-chart-1)",
  },
};

/** Format a YYYY-MM-DD date string into a short month label like "Jan". */
function shortMonth(dateStr: string): string {
  // dateStr is YYYY-MM-DD (first of month)
  const [year, month] = dateStr.split("-");
  const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
  return date.toLocaleString("en-US", { month: "short" });
}

export function MiniSpendBar({ series, currentMonth }: MiniSpendBarProps) {
  if (series.length === 0) {
    return (
      <div
        className="flex h-[120px] items-center justify-center text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        No data yet
      </div>
    );
  }

  const data = series.map((row) => ({
    month: row.month,
    label: shortMonth(row.month),
    totalSpend: parseFloat(row.totalSpend),
  }));

  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  return (
    <ChartContainer config={chartConfig} className="h-[120px]">
      <BarChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
          interval={0}
        />
        <YAxis hide />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              config={chartConfig}
              formatter={(value) =>
                formatter.format(typeof value === "number" ? value : parseFloat(String(value)))
              }
            />
          }
        />
        <Bar dataKey="totalSpend" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell
              key={entry.month}
              fill={
                entry.month === currentMonth
                  ? "var(--color-chart-1)"
                  : "var(--color-surface-2)"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
