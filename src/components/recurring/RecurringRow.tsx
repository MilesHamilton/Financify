import { cn } from "@/lib/utils";
import { Amount } from "@/components/Amount";
import type { RecurringItem } from "@/domain/metrics";
import { ICON_MAP, FALLBACK_ICON, toPascalCase } from "./icon-map";

interface RecurringRowProps {
  item: RecurringItem;
  /** "upcoming" renders a muted icon + bold amount; "paid" renders a green icon + muted amount. */
  variant: "upcoming" | "paid";
  /** Suppresses the row divider (last row in its card). */
  isLast: boolean;
}

/** Formats a YYYY-MM-DD date string as "{prefix} {Mon D}" (e.g. "Due Jul 18"). */
function formatDateLabel(dateStr: string | null, prefix: string): string {
  if (!dateStr) return prefix;
  const parsed = new Date(`${dateStr}T00:00:00`);
  const formatted = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(parsed);
  return `${prefix} ${formatted}`;
}

export function RecurringRow({ item, variant, isLast }: RecurringRowProps) {
  // Direct object-index lookup (not a wrapping function call) keeps the
  // resolved lucide-react component statically analyzable — see icon-map.tsx.
  const Icon = ICON_MAP[item.icon] ?? ICON_MAP[toPascalCase(item.icon)] ?? FALLBACK_ICON;
  const isPaid = variant === "paid";
  const dateLabel = isPaid
    ? formatDateLabel(item.paidDate, "Paid")
    : formatDateLabel(item.dueDate, "Due");

  return (
    <div
      className="flex items-center gap-3 py-3"
      style={{
        borderBottom: isLast ? "none" : "1px solid var(--color-border)",
      }}
    >
      <span
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[12px]"
        style={{ background: "var(--color-surface-2)" }}
        aria-hidden="true"
      >
        <Icon
          size={17}
          style={{
            color: isPaid ? "var(--color-positive)" : "var(--color-text-muted)",
          }}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-[var(--color-text)]">
          {item.name}
        </div>
        <div
          className="mt-0.5 text-xs"
          style={{ color: "var(--color-text-muted)" }}
        >
          {dateLabel}
        </div>
      </div>
      <Amount
        value={parseFloat(item.amount)}
        variant="neutral"
        size="md"
        className={cn(
          "shrink-0 text-[15px] font-bold",
          isPaid && "text-[var(--color-text-muted)]",
        )}
      />
    </div>
  );
}
