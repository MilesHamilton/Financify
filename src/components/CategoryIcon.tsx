import {
  ShoppingCart,
  Utensils,
  Car,
  Home,
  Zap,
  Heart,
  Plane,
  Dumbbell,
  BookOpen,
  Music,
  Coffee,
  Gift,
  Briefcase,
  TrendingUp,
  Repeat,
  CreditCard,
  Landmark,
  ShieldCheck,
  Wallet,
  HelpCircle,
  type LucideProps,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";

/** Map of icon name strings (matching the category seed) to Lucide components. */
const ICON_MAP: Record<string, ElementType<LucideProps>> = {
  "shopping-cart": ShoppingCart,
  utensils: Utensils,
  car: Car,
  home: Home,
  zap: Zap,
  heart: Heart,
  plane: Plane,
  dumbbell: Dumbbell,
  "book-open": BookOpen,
  music: Music,
  coffee: Coffee,
  gift: Gift,
  briefcase: Briefcase,
  "trending-up": TrendingUp,
  repeat: Repeat,
  "credit-card": CreditCard,
  landmark: Landmark,
  "shield-check": ShieldCheck,
  wallet: Wallet,
  "help-circle": HelpCircle,
};

interface CategoryIconProps {
  /** Kebab-case icon name from the category seed (e.g. "shopping-cart"). */
  iconName: string;
  /**
   * Background color for the chip. Accepts any CSS color value
   * (e.g. "var(--color-chart-1)", "#6c8cff").
   */
  colorToken: string;
  /** Icon size in pixels. Defaults to 16. */
  iconSize?: number;
  className?: string;
}

export function CategoryIcon({
  iconName,
  colorToken,
  iconSize = 16,
  className,
}: CategoryIconProps) {
  const Icon = ICON_MAP[iconName] ?? HelpCircle;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg shrink-0",
        className,
      )}
      style={{
        backgroundColor: colorToken,
        width: iconSize + 16,
        height: iconSize + 16,
      }}
      aria-hidden="true"
    >
      <Icon size={iconSize} color="#fff" strokeWidth={2} />
    </span>
  );
}
