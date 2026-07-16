/**
 * CategoryBudgetRow (T-R44)
 *
 * One row in the CATEGORY BUDGETS list on the /budget screen. Matches the
 * prototype markup (Financify Redesign.dc.html lines 116–133):
 *   • 40px circular ring in the category color (2px border, surface-2 center)
 *     containing the category's lucide icon in the category color
 *   • name (15/600) + spent amount (15/700)
 *   • 6px colored progress bar at spent/budget
 *   • muted left-label "$X left to spend" / "$X over budget"
 *
 * Pure presentational component (no client interactivity), so it renders inside
 * the server component page.
 */

import {
  ArrowLeftRight,
  BookOpen,
  Car,
  CircleEllipsis,
  Coffee,
  CreditCard,
  Dumbbell,
  Film,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  HelpCircle,
  Home,
  Landmark,
  Music,
  Plane,
  Receipt,
  Repeat,
  Shapes,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Utensils,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * Map of kebab-case category icon names (from the category seed / prototype) to
 * their lucide-react components. Falls back to `Shapes` for unknown names.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  "arrow-left-right": ArrowLeftRight,
  "book-open": BookOpen,
  car: Car,
  "circle-ellipsis": CircleEllipsis,
  coffee: Coffee,
  "credit-card": CreditCard,
  dumbbell: Dumbbell,
  film: Film,
  gift: Gift,
  "graduation-cap": GraduationCap,
  heart: Heart,
  "heart-pulse": HeartPulse,
  "help-circle": HelpCircle,
  home: Home,
  landmark: Landmark,
  music: Music,
  plane: Plane,
  receipt: Receipt,
  repeat: Repeat,
  shapes: Shapes,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  "trending-up": TrendingUp,
  utensils: Utensils,
  wallet: Wallet,
  zap: Zap,
};

/** Whole-dollar formatting, comma-grouped (matches the prototype `fmt` helper). */
export function fmtDollars(n: number): string {
  const safe = Number.isFinite(n) ? n : 0;
  return "$" + Math.round(safe).toLocaleString("en-US");
}

interface CategoryBudgetRowProps {
  name: string;
  /** CSS color (e.g. "#4dd0e1" or a token) for the ring, icon and bar. */
  color: string;
  /** Kebab-case lucide icon name from the category seed. */
  icon: string;
  /** Amount spent this month (numeric string or number). */
  spent: string | number;
  /** Applicable budget amount for the month. */
  budgetAmount: number;
}

export function CategoryBudgetRow({
  name,
  color,
  icon,
  spent,
  budgetAmount,
}: CategoryBudgetRowProps) {
  const Icon = ICON_MAP[icon] ?? Shapes;

  const spentNum = typeof spent === "string" ? parseFloat(spent) : spent;
  const safeSpent = Number.isFinite(spentNum) ? spentNum : 0;
  const remaining = budgetAmount - safeSpent;
  const overBudget = remaining < 0;
  const pct =
    budgetAmount > 0
      ? Math.min(100, Math.round((safeSpent / budgetAmount) * 100))
      : 0;

  const leftLabel = overBudget
    ? `${fmtDollars(-remaining)} over budget`
    : `${fmtDollars(remaining)} left to spend`;

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-card)] bg-[var(--color-surface)] px-4 py-[14px]">
      {/* Ring */}
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-2)]"
        style={{ border: `2px solid ${color}` }}
      >
        <Icon size={18} style={{ color }} aria-hidden />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold text-[var(--color-text)]">
            {name}
          </span>
          <span className="shrink-0 text-[15px] font-bold tabular-nums text-[var(--color-text)]">
            {fmtDollars(safeSpent)}
          </span>
        </div>

        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>

        <div className="mt-1.5 text-xs text-[var(--color-text-muted)]">
          {leftLabel}
        </div>
      </div>
    </div>
  );
}
