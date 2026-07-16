/** One category row in the BY CATEGORY list. */
export interface CategoryShareRow {
  color: string;
  name: string;
  /** Share of total spend, e.g. "24%". */
  share: string;
  /** Formatted spend amount, e.g. "$312". */
  spentLabel: string;
}

interface CategoryShareListProps {
  rows: CategoryShareRow[];
}

/**
 * The BY CATEGORY card: color square, name, muted share %, right-aligned amount.
 * Rows are pre-sorted by spend desc. Last row omits the divider via last:border-0.
 */
export function CategoryShareList({ rows }: CategoryShareListProps) {
  return (
    <div
      className="rounded-[var(--radius-card)] px-4"
      style={{ background: "var(--color-surface)" }}
    >
      {rows.map((r, i) => (
        <div
          key={`${r.name}-${i}`}
          className="flex items-center gap-3 py-3"
          style={{
            borderBottom:
              i === rows.length - 1
                ? "1px solid transparent"
                : "1px solid var(--color-border)",
          }}
        >
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
            style={{ background: r.color }}
          />
          <span className="flex-1 text-sm font-medium">{r.name}</span>
          <span className="text-xs" style={{ color: "var(--color-text-muted)" }}>
            {r.share}
          </span>
          <span className="min-w-[64px] text-right text-sm font-bold">
            {r.spentLabel}
          </span>
        </div>
      ))}
    </div>
  );
}
