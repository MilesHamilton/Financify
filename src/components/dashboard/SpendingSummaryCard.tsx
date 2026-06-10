import Link from "next/link";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/Card";
import { Amount } from "@/components/Amount";
import type { MonthSpendResult } from "@/domain/metrics";

interface SpendingSummaryCardProps {
  data: MonthSpendResult;
}

export function SpendingSummaryCard({ data }: SpendingSummaryCardProps) {
  const spend = parseFloat(data.totalSpend);
  const delta = parseFloat(data.momDelta);

  // Positive delta = spent more than last month (bad) → negative color
  // Negative delta = spent less than last month (good) → positive color
  const deltaPositive = delta < 0;
  const deltaNeutral = delta === 0;

  const DeltaIcon = deltaNeutral ? Minus : deltaPositive ? TrendingDown : TrendingUp;
  const deltaColorStyle = deltaNeutral
    ? { color: "var(--color-text-muted)" }
    : deltaPositive
    ? { color: "var(--color-positive)" }
    : { color: "var(--color-negative)" };

  const absFormatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.abs(delta));

  const deltaLabel = deltaNeutral
    ? "Same as last month"
    : deltaPositive
    ? `${absFormatted} less than last month`
    : `${absFormatted} more than last month`;

  return (
    <Link href="/spending" className="block tap-highlight-transparent">
      <Card className="gap-1">
        <p
          className="text-xs font-medium uppercase tracking-wide"
          style={{ color: "var(--color-text-muted)" }}
        >
          Spent this month
        </p>

        <div className="mt-1">
          <Amount value={spend} variant="neutral" size="xl" />
        </div>

        {/* MoM delta chip */}
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 bg-[var(--color-surface-2)]">
          <DeltaIcon size={13} style={deltaColorStyle} aria-hidden="true" />
          <span className="text-xs tabular-nums" style={deltaColorStyle}>
            {deltaLabel}
          </span>
        </div>
      </Card>
    </Link>
  );
}
