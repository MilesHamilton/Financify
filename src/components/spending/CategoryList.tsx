import Link from "next/link";
import { CategoryIcon } from "@/components/CategoryIcon";
import { Amount } from "@/components/Amount";
import type { CategoryBreakdownRow } from "@/domain/metrics";

interface CategoryListProps {
  breakdown: CategoryBreakdownRow[];
  month: string;
}

export function CategoryList({ breakdown, month }: CategoryListProps) {
  return (
    <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
      {breakdown.map((row) => {
        const spent = parseFloat(row.spent);
        const budget = row.budget !== null ? parseFloat(row.budget) : null;
        const ratio = budget !== null && budget > 0 ? spent / budget : null;
        const overBudget = ratio !== null && ratio > 1;

        return (
          <li key={row.categoryId}>
            <Link
              href={`/transactions?category=${row.categoryId}&month=${month}`}
              className="flex items-center gap-3 py-3 px-4 transition-colors hover:bg-[var(--color-surface-2)] active:bg-[var(--color-surface-2)]"
            >
              <CategoryIcon
                iconName={row.icon}
                colorToken={row.color}
                iconSize={16}
              />

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="truncate text-sm font-medium"
                    style={{ color: "var(--color-text)" }}
                  >
                    {row.label}
                  </span>
                  <Amount value={spent} variant="neutral" size="sm" />
                </div>

                {budget !== null && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div
                      className="h-1 flex-1 overflow-hidden rounded-full"
                      style={{ background: "var(--color-surface-2)" }}
                      role="progressbar"
                      aria-valuenow={Math.round((ratio ?? 0) * 100)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min((ratio ?? 0) * 100, 100)}%`,
                          background: overBudget
                            ? "var(--color-negative)"
                            : row.color,
                        }}
                      />
                    </div>
                    <span
                      className="shrink-0 text-xs tabular-nums"
                      style={{
                        color: overBudget
                          ? "var(--color-negative)"
                          : "var(--color-text-muted)",
                      }}
                    >
                      of{" "}
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      }).format(parseFloat(row.budget!))}
                    </span>
                  </div>
                )}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
