import { cn } from "@/lib/utils";

type AmountSize = "sm" | "md" | "lg" | "xl";
type AmountVariant = "auto" | "positive" | "negative" | "neutral";

interface AmountProps {
  /** Dollar value (e.g. 12.50 or -42.00). Sign determines color in "auto" mode. */
  value: number;
  /**
   * Color variant.
   *   "auto"     — negative value → red, positive → green (pure sign-based; callers
   *                decide Plaid sign convention before passing the prop).
   *   "positive" — always green
   *   "negative" — always red
   *   "neutral"  — inherits current text color (default)
   */
  variant?: AmountVariant;
  size?: AmountSize;
  className?: string;
}

const sizeClass: Record<AmountSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
  xl: "text-2xl font-semibold",
};

function resolveColorClass(value: number, variant: AmountVariant): string {
  switch (variant) {
    case "positive":
      return "text-[var(--color-positive)]";
    case "negative":
      return "text-[var(--color-negative)]";
    case "auto":
      return value < 0
        ? "text-[var(--color-negative)]"
        : "text-[var(--color-positive)]";
    default:
      return "";
  }
}

const formatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function Amount({
  value,
  variant = "neutral",
  size = "md",
  className,
}: AmountProps) {
  const formatted = formatter.format(value);
  return (
    <span
      className={cn(
        "tabular-nums",
        sizeClass[size],
        resolveColorClass(value, variant),
        className,
      )}
    >
      {formatted}
    </span>
  );
}
