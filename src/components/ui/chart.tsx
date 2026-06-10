"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  Tooltip,
  Legend,
  type TooltipProps,
  type LegendProps,
} from "recharts";
import type { TooltipContentProps } from "recharts/types/component/Tooltip";
import type { LegendPayload } from "recharts/types/component/DefaultLegendContent";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// ChartConfig
// ---------------------------------------------------------------------------

export type ChartConfig = {
  [key: string]: {
    label: string;
    /** CSS variable reference, e.g. "var(--color-chart-1)" */
    color: string;
  };
};

// ---------------------------------------------------------------------------
// ChartContainer
// ---------------------------------------------------------------------------
// Renders a ResponsiveContainer and injects per-key CSS variables derived
// from the config so chart elements can reference var(--color-<key>).

interface ChartContainerProps {
  config: ChartConfig;
  children: React.ReactElement;
  className?: string;
}

export function ChartContainer({
  config,
  children,
  className,
}: ChartContainerProps) {
  // Build inline style: { "--color-spending": "var(--color-chart-1)", ... }
  const cssVars = React.useMemo(() => {
    const vars: Record<string, string> = {};
    for (const [key, value] of Object.entries(config)) {
      vars[`--color-${key}`] = value.color;
    }
    return vars;
  }, [config]);

  return (
    <div
      className={cn("w-full", className)}
      style={cssVars as React.CSSProperties}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartTooltip
// ---------------------------------------------------------------------------
// Re-export Recharts Tooltip with our styled content as the default.

export { Tooltip as ChartTooltip };

// ---------------------------------------------------------------------------
// ChartTooltipContent
// ---------------------------------------------------------------------------
// Drop-in `content` prop for <ChartTooltip>. Dark-styled using the surface,
// border, and muted-text design tokens.

type TooltipPayloadItem = {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  payload?: Record<string, unknown>;
};

interface ChartTooltipContentProps
  extends Omit<TooltipContentProps<number, string>, "formatter"> {
  config?: ChartConfig;
  /** Show the label at the top of the tooltip. Default true. */
  hideLabel?: boolean;
  /** Format a value before display. */
  formatter?: (value: number | string | undefined, name: string | undefined) => React.ReactNode;
  className?: string;
}

export function ChartTooltipContent({
  active,
  payload,
  label,
  config,
  hideLabel = false,
  formatter,
  className,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2 text-sm shadow-lg",
        className
      )}
      style={{
        background: "var(--color-surface)",
        borderColor: "var(--color-border)",
        color: "var(--color-text)",
      }}
    >
      {!hideLabel && label && (
        <p
          className="mb-1.5 font-medium"
          style={{ color: "var(--color-text-muted)" }}
        >
          {label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {(payload as unknown as TooltipPayloadItem[]).map((item, i) => {
          const key = String(item.dataKey ?? item.name ?? i);
          const configEntry = config?.[key];
          const displayName = configEntry?.label ?? item.name ?? key;
          const color = item.color ?? configEntry?.color ?? "currentColor";
          const value = item.value ?? "";
          const displayValue = formatter
            ? formatter(value, key)
            : String(value);

          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: color }}
              />
              <span style={{ color: "var(--color-text-muted)" }}>
                {displayName}
              </span>
              <span className="ml-auto pl-4 font-medium tabular-nums">
                {displayValue}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChartLegend
// ---------------------------------------------------------------------------
// Re-export Recharts Legend.

export { Legend as ChartLegend };

// ---------------------------------------------------------------------------
// ChartLegendContent
// ---------------------------------------------------------------------------
// Drop-in `content` prop for <ChartLegend>.

type LegendPayloadItem = {
  value?: string;
  color?: string;
  dataKey?: string | number;
  type?: string;
};

interface ChartLegendContentProps
  extends Omit<LegendProps, "content" | "ref"> {
  payload?: ReadonlyArray<LegendPayload>;
  config?: ChartConfig;
  className?: string;
}

export function ChartLegendContent({
  payload,
  config,
  className,
}: ChartLegendContentProps) {
  if (!payload?.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-4 pt-2 text-xs", className)}>
      {(payload as LegendPayloadItem[]).map((item, i) => {
        const key = String(item.dataKey ?? item.value ?? i);
        const configEntry = config?.[key];
        const displayName = configEntry?.label ?? item.value ?? key;
        const color = item.color ?? configEntry?.color ?? "currentColor";

        return (
          <div key={key} className="flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: color }}
            />
            <span style={{ color: "var(--color-text-muted)" }}>
              {displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
