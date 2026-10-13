import {
  ArrowLeftRight,
  Car,
  CircleEllipsis,
  HeartPulse,
  CircleHelp,
  House,
  Music,
  Plane,
  Receipt,
  ShoppingBag,
  ShoppingCart,
  TrendingUp,
  Utensils,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { View } from 'react-native';

// Keys match the icon names seeded in src/db/seed.ts.
const ICONS: Record<string, LucideIcon> = {
  'arrow-left-right': ArrowLeftRight,
  car: Car,
  'circle-ellipsis': CircleEllipsis,
  'heart-pulse': HeartPulse,
  'help-circle': CircleHelp,
  home: House,
  music: Music,
  plane: Plane,
  receipt: Receipt,
  'shopping-bag': ShoppingBag,
  'shopping-cart': ShoppingCart,
  'trending-up': TrendingUp,
  utensils: Utensils,
  zap: Zap,
};

/** RM "categoryIconContained": white glyph on a filled category-colour circle. */
export function CategoryIcon({ icon, color, size = 36 }: { icon: string; color: string; size?: number }) {
  // API may send PascalCase ("ShoppingCart"); keys are kebab-case.
  const key = icon.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  const Icon = ICONS[key] ?? CircleHelp;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon size={size * 0.5} color="#FFFFFF" strokeWidth={2} />
    </View>
  );
}
