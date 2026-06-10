"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { BalanceHistoryRow } from "@/domain/metrics";

interface BalanceLineChartProps {
  rows: BalanceHistoryRow[];
}

const chartConfig: ChartConfig = {
  balance: {
    label: "Balance",
    color: "var(--color-chart-1)",
  },
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const tooltipCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats an ISO date string (YYYY-MM-DD) to a short month/day label (e.g. "Jun 1").
 * Used for sparse x-axis ticks.
 */
function formatDateLabel(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Returns a subset of date strings to use as x-axis ticks, targeting ~4-6 ticks
 * spread evenly across the data range.
 */
function sparseTicks(rows: BalanceHistoryRow[], targetCount = 4): string[] {
  if (rows.length <= targetCount) return rows.map((r) => r.asOfDate);
  const step = Math.floor((rows.length - 1) / (targetCount - 1));
  const ticks: string[] = [];
  for (let i = 0; i < targetCount - 1; i++) {
    ticks.push(rows[i * step].asOfDate);
  }
  ticks.push(rows[rows.length - 1].asOfDate);
  return ticks;
}

/**
 * BalanceLineChart — Recharts LineChart via ChartContainer.
 *
 * Renders the balance history for "all" accounts (net worth line) or a single
 * account. Uses --color-chart-1 stroke, dark CartesianGrid, sparse x-axis ticks,
 * and a currency tooltip (FR-047).
 *
 * Dynamically imported by the Accounts page to keep Recharts out of non-chart
 * route bundles (FR-047, output-rendering.md § Performance Optimization).
 */
export function BalanceLineChart({ rows }: BalanceLineChartProps) {
  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-[var(--color-text-muted)]">
          No history data yet
        </p>
      </div>
    );
  }

  const data = rows.map((r) => ({
    date: r.asOfDate,
    balance: r.currentBalance !== null ? parseFloat(r.currentBalance) : null,
  }));

  const ticks = sparseTicks(rows);

  return (
    <ChartContainer config={chartConfig} className="h-full">
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid
          vertical={false}
          stroke="var(--color-border)"
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="date"
          ticks={ticks}
          tickFormatter={formatDateLabel}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
          dy={4}
        />
        <YAxis
          tickFormatter={(v: number) => currencyFormatter.format(v)}
          axisLine={false}
          tickLine={false}
          tick={{ fill: "var(--color-text-muted)", fontSize: 11 }}
          width={60}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              config={chartConfig}
              formatter={(value) =>
                typeof value === "number"
                  ? tooltipCurrencyFormatter.format(value)
                  : String(value)
              }
            />
          }
          labelFormatter={(label) => formatDateLabel(String(label))}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "var(--color-chart-1)" }}
          connectNulls
        />
      </LineChart>
    </ChartContainer>
  );
}
