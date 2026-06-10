"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryBreakdownRow } from "@/domain/metrics";

interface CategoryDonutProps {
  breakdown: CategoryBreakdownRow[];
  /** Pre-formatted total spend string (numeric, e.g. "1234.56"). */
  totalSpend: string;
}

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function CategoryDonut({ breakdown, totalSpend }: CategoryDonutProps) {
  const total = parseFloat(totalSpend);
  const data = breakdown.map((row) => ({
    name: row.label,
    value: parseFloat(row.spent),
    color: row.color,
  }));

  return (
    <div className="relative flex items-center justify-center" style={{ height: 220 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={95}
            paddingAngle={2}
            dataKey="value"
            strokeWidth={0}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0];
              return (
                <div
                  className="rounded-xl border px-3 py-2 text-sm shadow-lg"
                  style={{
                    background: "var(--color-surface)",
                    borderColor: "var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: item.payload?.color as string }}
                    />
                    <span style={{ color: "var(--color-text-muted)" }}>
                      {item.name}
                    </span>
                    <span className="ml-auto pl-4 font-medium tabular-nums">
                      {formatter.format(item.value as number)}
                    </span>
                  </div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      {/* Center label */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        <span
          className="text-xs font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          Total
        </span>
        <span
          className="text-xl font-semibold tabular-nums"
          style={{ color: "var(--color-text)" }}
        >
          {formatter.format(total)}
        </span>
      </div>
    </div>
  );
}
