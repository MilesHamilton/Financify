import type { RecurringItem } from "@/domain/metrics";
import { RecurringRow } from "./RecurringRow";

interface RecurringSectionProps {
  /** Uppercase section label, e.g. "UPCOMING" / "PAID THIS MONTH". */
  title: string;
  items: RecurringItem[];
  variant: "upcoming" | "paid";
}

/** An uppercase muted section header + surface card listing bill-stream rows. */
export function RecurringSection({ title, items, variant }: RecurringSectionProps) {
  if (items.length === 0) return null;

  return (
    <div>
      <div
        className="mt-[22px] mb-2.5 px-0.5 text-xs font-bold uppercase"
        style={{ color: "var(--color-text-muted)", letterSpacing: "1.2px" }}
      >
        {title}
      </div>
      <div
        className="rounded-[var(--radius-card)] px-4"
        style={{ background: "var(--color-surface)" }}
      >
        {items.map((item, i) => (
          <RecurringRow
            key={item.streamId}
            item={item}
            variant={variant}
            isLast={i === items.length - 1}
          />
        ))}
      </div>
    </div>
  );
}
