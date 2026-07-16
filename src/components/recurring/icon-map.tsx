import {
  Wifi,
  Dumbbell,
  Tv,
  Clapperboard,
  Cloud,
  Home,
  Shield,
  Smartphone,
  Zap,
  Droplet,
  GraduationCap,
  CreditCard,
  Repeat,
  UtensilsCrossed,
  Car,
  Receipt,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps a `RecurringItem.icon` string to a lucide-react component.
 *
 * Two naming conventions are supported because the design source (prototype)
 * uses lowercase-kebab icon names (e.g. "wifi", "graduation-cap") while
 * `getStreamIcon` in src/domain/metrics.ts returns exact PascalCase
 * lucide-react component names (e.g. "Home", "CreditCard", "Receipt").
 * Both are accepted so this map stays correct regardless of which
 * convention the caller supplies.
 */
const ICON_MAP: Record<string, LucideIcon> = {
  // kebab-case — prototype icon names (docs/specs/ui-redesign/design/Financify Redesign.dc.html lines 429-444)
  wifi: Wifi,
  dumbbell: Dumbbell,
  tv: Tv,
  clapperboard: Clapperboard,
  cloud: Cloud,
  home: Home,
  shield: Shield,
  smartphone: Smartphone,
  zap: Zap,
  droplet: Droplet,
  "graduation-cap": GraduationCap,
  // PascalCase — exact lucide component names returned by getStreamIcon()
  Wifi,
  Dumbbell,
  Tv,
  Clapperboard,
  Cloud,
  Home,
  Shield,
  Smartphone,
  Zap,
  Droplet,
  GraduationCap,
  CreditCard,
  Repeat,
  UtensilsCrossed,
  Car,
  Receipt,
};

/** Fallback icon for unrecognized `icon` strings. */
export const FALLBACK_ICON: LucideIcon = Receipt;

export { ICON_MAP };

/**
 * Converts a kebab-case icon name (e.g. "graduation-cap") to PascalCase
 * ("GraduationCap") for a second lookup attempt in `ICON_MAP`.
 *
 * NOTE: callers should resolve the icon component via direct `ICON_MAP[...]`
 * indexing (not a wrapping function call) so the lucide-react component
 * reference stays statically analyzable to the `react-hooks/static-components`
 * lint rule — see RecurringRow.tsx.
 */
export function toPascalCase(value: string): string {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}
