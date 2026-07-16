"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** One month tile in the horizontally-scrollable selector. */
export interface MonthTile {
  /** YYYY-MM key used to select the month via the ?month URL param. */
  key: string;
  /** Short month label, e.g. "Jul". */
  label: string;
  /** Income bar height as a CSS px string (e.g. "42px"). */
  incH: string;
  /** Spend bar height as a CSS px string. */
  spdH: string;
  /** Whether this tile is the currently-selected month. */
  selected: boolean;
}

interface MonthBarSelectorProps {
  tiles: MonthTile[];
}

/**
 * Horizontally-scrollable row of paired mini-bar month tiles (income vs total
 * spend). Tapping a tile pushes `?month=YYYY-MM`, re-fetching the whole page's
 * data on the server. Client island — only the tap handler needs interactivity.
 *
 * Geometry mirrors the prototype exactly: 66px tiles, 14px radius, 2px border,
 * 10px bars in a 48px-tall row, accent (#6c8cff) income + dashed-line (#3a4356)
 * spend.
 */
export function MonthBarSelector({ tiles }: MonthBarSelectorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function selectMonth(key: string) {
    startTransition(() => {
      router.push(`/?month=${key}`, { scroll: false });
    });
  }

  return (
    <div>
      {/* Bleed to the screen edges; hide the scrollbar. */}
      <div
        className={cn(
          "-mx-4 flex gap-2 overflow-x-auto px-4 pb-1",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        )}
        style={{ opacity: isPending ? 0.6 : 1 }}
      >
        {tiles.map((t) => (
          <button
            key={t.key}
            type="button"
            aria-pressed={t.selected}
            aria-label={`Show ${t.label}`}
            onClick={() => selectMonth(t.key)}
            className="flex w-[66px] shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-[var(--radius-tile)] pt-2.5 pb-2 px-2"
            style={{
              background: "var(--color-surface)",
              border: `2px solid ${t.selected ? "var(--color-accent)" : "var(--color-border)"}`,
            }}
          >
            <div className="flex h-12 items-end gap-1">
              <div
                className="w-2.5 rounded-t-[3px]"
                style={{ height: t.incH, background: "var(--color-accent)" }}
              />
              <div
                className="w-2.5 rounded-t-[3px]"
                style={{ height: t.spdH, background: "var(--color-dashed-line)" }}
              />
            </div>
            <span
              className="text-xs font-semibold"
              style={{
                color: t.selected
                  ? "var(--color-text)"
                  : "var(--color-text-muted)",
              }}
            >
              {t.label}
            </span>
          </button>
        ))}
      </div>

      {/* Legend */}
      <div
        className="mt-2 flex justify-center gap-4 text-xs"
        style={{ color: "var(--color-text-muted)" }}
      >
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--color-accent)" }}
          />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--color-dashed-line)" }}
          />
          Total Spend
        </span>
      </div>
    </div>
  );
}
