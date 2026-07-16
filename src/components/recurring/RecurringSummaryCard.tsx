import { Amount } from "@/components/Amount";

interface RecurringSummaryCardProps {
  /** Full month name, e.g. "July". */
  monthLabel: string;
  /** Numeric string, 2dp. */
  leftToPay: string;
  /** Numeric string, 2dp. */
  paidSoFar: string;
}

/** Split summary card: "Left to pay in {Month}" | "Paid so far", divided by a 1px rule. */
export function RecurringSummaryCard({
  monthLabel,
  leftToPay,
  paidSoFar,
}: RecurringSummaryCardProps) {
  return (
    <div
      className="flex gap-3 rounded-[var(--radius-card)] p-4"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="flex-1">
        <div className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          Left to pay in {monthLabel}
        </div>
        <div className="mt-0.5">
          <Amount
            value={parseFloat(leftToPay)}
            variant="neutral"
            size="xl"
            className="tracking-[-0.5px]"
          />
        </div>
      </div>
      <div style={{ width: "1px", background: "var(--color-border)" }} />
      <div className="flex-1">
        <div className="text-[13px]" style={{ color: "var(--color-text-muted)" }}>
          Paid so far
        </div>
        <div className="mt-0.5">
          <Amount
            value={parseFloat(paidSoFar)}
            variant="positive"
            size="xl"
            className="tracking-[-0.5px]"
          />
        </div>
      </div>
    </div>
  );
}
