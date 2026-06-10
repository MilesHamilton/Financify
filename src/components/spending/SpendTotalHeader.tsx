import { Amount } from "@/components/Amount";
import { TrendingDown, TrendingUp } from "lucide-react";
import type { MonthSpendResult } from "@/domain/metrics";

interface SpendTotalHeaderProps {
  data: MonthSpendResult;
}

export function SpendTotalHeader({ data }: SpendTotalHeaderProps) {
  const total = parseFloat(data.totalSpend);
  const delta = parseFloat(data.momDelta);
  const isIncrease = delta > 0;
  const isDecrease = delta < 0;

  return (
    <div className="px-4 pt-2 pb-4">
      <p
        className="mb-1 text-xs font-medium uppercase tracking-wider"
        style={{ color: "var(--color-text-muted)" }}
      >
        Spending this month
      </p>
      <div className="flex items-end gap-3">
        <Amount value={total} variant="neutral" size="xl" />
        {delta !== 0 && (
          <span
            className="mb-0.5 flex items-center gap-1 text-xs font-medium"
            style={{
              color: isIncrease
                ? "var(--color-negative)"
                : "var(--color-positive)",
            }}
          >
            {isIncrease ? (
              <TrendingUp size={14} aria-hidden="true" />
            ) : (
              <TrendingDown size={14} aria-hidden="true" />
            )}
            <Amount value={Math.abs(delta)} variant="neutral" size="sm" />
            <span>vs last month</span>
          </span>
        )}
      </div>
    </div>
  );
}
