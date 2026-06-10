"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthPickerProps {
  /** Currently selected month, YYYY-MM. */
  month: string;
  /** Upper bound — right arrow is disabled when month === maxMonth. */
  maxMonth: string;
}

/** Decrement or increment a YYYY-MM string by one month. */
function shiftMonth(month: string, delta: -1 | 1): string {
  const [yearStr, monthStr] = month.split("-");
  let year = parseInt(yearStr, 10);
  let mon = parseInt(monthStr, 10) + delta;
  if (mon > 12) {
    mon = 1;
    year += 1;
  } else if (mon < 1) {
    mon = 12;
    year -= 1;
  }
  return `${year}-${String(mon).padStart(2, "0")}`;
}

/** Format YYYY-MM as "Month YYYY" label, e.g. "June 2026". */
function formatMonthLabel(month: string): string {
  const [yearStr, monthStr] = month.split("-");
  const date = new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    1
  );
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function MonthPicker({ month, maxMonth }: MonthPickerProps) {
  const router = useRouter();
  const atMax = month >= maxMonth;

  function navigate(target: string) {
    router.replace(`/spending?month=${target}`);
  }

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <button
        aria-label="Previous month"
        onClick={() => navigate(shiftMonth(month, -1))}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-2)]"
        style={{ color: "var(--color-text)" }}
      >
        <ChevronLeft size={20} />
      </button>

      <span
        className="text-base font-semibold tabular-nums"
        style={{ color: "var(--color-text)" }}
      >
        {formatMonthLabel(month)}
      </span>

      <button
        aria-label="Next month"
        disabled={atMax}
        onClick={() => !atMax && navigate(shiftMonth(month, 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-2)] disabled:opacity-30 disabled:cursor-not-allowed"
        style={{ color: "var(--color-text)" }}
      >
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
