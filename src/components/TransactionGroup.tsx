/**
 * TransactionGroup — server component.
 *
 * Renders a date section header ("Today", "Yesterday", "Jun 8") with a
 * daily total, then the transaction rows passed as children.
 */

import type { ReactNode } from "react";
import { Amount } from "@/components/Amount";

interface TransactionGroupProps {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /**
   * Sum of all outflow amounts for this day (positive number, in dollars).
   * Rendered as a neutral muted label — not colored.
   */
  dailyTotal: number;
  children: ReactNode;
}

function formatDateHeader(dateStr: string): string {
  // Parse the YYYY-MM-DD date as a local date (avoid UTC midnight offset).
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const date = new Date(
    parseInt(yearStr, 10),
    parseInt(monthStr, 10) - 1,
    parseInt(dayStr, 10),
  );

  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (isSameDay(date, today)) return "Today";
  if (isSameDay(date, yesterday)) return "Yesterday";

  // "Jun 8" or "Jun 8, 2024" when the year differs.
  const sameYear = date.getFullYear() === today.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

export function TransactionGroup({
  date,
  dailyTotal,
  children,
}: TransactionGroupProps) {
  return (
    <section>
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <span className="text-xs font-bold uppercase tracking-[1.2px] text-[var(--color-text-muted)]">
          {formatDateHeader(date)}
        </span>
        <Amount
          value={dailyTotal}
          variant="neutral"
          size="sm"
          className="text-[var(--color-text-muted)]"
        />
      </div>
      <div className="divide-y divide-[var(--color-border)]">{children}</div>
    </section>
  );
}
