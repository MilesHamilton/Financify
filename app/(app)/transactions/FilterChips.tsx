"use client";

/**
 * FilterChips — client subcomponent for the Transactions page.
 *
 * Renders dismissible chips for active filters (month, category, account).
 * Each chip's "×" removes that single filter via router.replace.
 */

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

interface ActiveFilters {
  q: string | undefined;
  month: string | null;
  category: string | null;
  account: string | null;
}

interface FilterChipsProps {
  filters: ActiveFilters;
}

export function FilterChips({ filters }: FilterChipsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const chips: { key: string; label: string }[] = [];

  if (filters.month) {
    // "YYYY-MM" → "June 2026"
    const [year, mon] = filters.month.split("-");
    const date = new Date(parseInt(year, 10), parseInt(mon, 10) - 1, 1);
    const label = date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
    chips.push({ key: "month", label });
  }

  if (filters.category) {
    chips.push({ key: "category", label: `Category: ${filters.category}` });
  }

  if (filters.account) {
    chips.push({ key: "account", label: `Account: ${filters.account}` });
  }

  if (chips.length === 0) return null;

  function removeFilter(key: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="flex items-center gap-1 rounded-full bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text)]"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => removeFilter(chip.key)}
            aria-label={`Remove ${chip.label} filter`}
            className="ml-0.5 text-[var(--color-text-muted)] transition-colors active:text-[var(--color-text)]"
          >
            <X size={12} />
          </button>
        </span>
      ))}
    </div>
  );
}
