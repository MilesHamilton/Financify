import * as Haptics from 'expo-haptics';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, space, type } from '@/constants/theme';
import { useCountUp } from '@/lib/motion';

/**
 * Tab-screen shell (RM ScreenWrapper + HomeScreenPseudoHeader): large
 * left-aligned title, right-side actions, pull-to-refresh scroll body.
 */
export function Screen({
  title,
  actions,
  left,
  children,
  refreshing = false,
  onRefresh,
  scroll = true,
  scrollEnabled = true,
}: {
  title?: string;
  actions?: ReactNode;
  left?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
  /** false while a chart scrub owns the gesture. */
  scrollEnabled?: boolean;
}) {
  const header =
    title || actions || left ? (
      <View style={styles.header}>
        {left}
        {title ? <Text style={[type.heading, { flex: 1 }]}>{title}</Text> : <View style={{ flex: 1 }} />}
        <View style={styles.actions}>{actions}</View>
      </View>
    ) : null;

  return (
    <SafeAreaView edges={['top']} style={styles.screen}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.body}
          scrollEnabled={scrollEnabled}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSubtle} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{children}</View>
      )}
    </SafeAreaView>
  );
}

/** RM CardDNA. With `onPress` it becomes CardClickable: a `cardPressed` overlay while held. */
export function Card({
  children,
  style,
  onPress,
  accessibilityLabel,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  if (!onPress) return <View style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[styles.card, style]}>
      {({ pressed }) => (
        <>
          {children}
          <PressOverlay pressed={pressed} color={colors.cardPressed} />
        </>
      )}
    </Pressable>
  );
}

/** Instant in, 120 ms fade out (polish #11). Content underneath stays at full opacity. */
function PressOverlay({ pressed, color }: { pressed: boolean; color: string }) {
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pressed) o.setValue(1);
    else Animated.timing(o, { toValue: 0, duration: 120, useNativeDriver: true }).start();
  }, [pressed, o]);
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: color, opacity: o }]} />;
}

/** RM "Tracked" section header: uppercase caps, optional underlined link on the right. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.tracked, { color: colors.textSubtle }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link">
          {({ pressed }) => (
            <Text
              style={[
                type.labelS,
                { textDecorationLine: 'underline', textDecorationColor: colors.text },
                pressed && { color: colors.brandText },
              ]}
            >
              {action}
            </Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Full-bleed filled band (RM SectionHeader#36476) for day groups in lists. */
export function SectionBand({
  title,
  detail,
  tone = colors.accentFill,
}: {
  title: string;
  detail?: string;
  tone?: string;
}) {
  return (
    <View style={[styles.band, { backgroundColor: tone }]} accessibilityRole="header">
      <Text style={type.labelS}>{title}</Text>
      {detail ? <Text style={[type.caption, styles.tabular, { color: colors.textOnBand }]}>{detail}</Text> : null}
    </View>
  );
}

export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.divider, marginLeft: inset }} />;
}

/** Standard list row: leading visual, title/subtitle, trailing value, optional chevron. */
export function ListRow({
  leading,
  title,
  subtitle,
  value,
  valueColor,
  valueSubtitle,
  onPress,
  chevron = false,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string;
  value?: string;
  valueColor?: string;
  valueSubtitle?: string;
  onPress?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <View style={styles.row}>
      {leading}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.label} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[type.caption, { color: colors.textSubtle }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value !== undefined ? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[type.label, styles.tabular, valueColor ? { color: valueColor } : null]}>{value}</Text>
          {valueSubtitle ? <Text style={[type.caption, { color: colors.textSubtle }]}>{valueSubtitle}</Text> : null}
        </View>
      ) : null}
      {chevron ? <ChevronRight size={18} color={colors.textSubtle} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <PressableRow onPress={onPress} accessibilityLabel={title}>
      {body}
    </PressableRow>
  );
}

/**
 * Row press rule (polish #11): a `rowPressed` band that spans the card edge to
 * edge (negative margin), content stays at 100 % opacity.
 */
export function PressableRow({
  onPress,
  children,
  accessibilityLabel,
  disabled,
  onPressIn,
  style,
}: {
  onPress?: () => void;
  children: ReactNode;
  accessibilityLabel?: string;
  disabled?: boolean;
  onPressIn?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      onPress={onPress}
      onPressIn={onPressIn}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[styles.bleed, style]}
    >
      {({ pressed }) => (
        <>
          <PressOverlay pressed={pressed} color={colors.rowPressed} />
          {children}
        </>
      )}
    </Pressable>
  );
}

/**
 * Two variants (polish #2, #3):
 * - `pill`: in-card toggle, white pill sliding on a bordered track.
 * - `tabs`: screen-level underline tabs with a full-bleed translucent hairline.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = 'pill',
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  variant?: 'pill' | 'tabs';
}) {
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const x = useRef(new Animated.Value(0)).current;
  const w = useRef(new Animated.Value(0)).current;
  const placed = useRef(false);
  const target = layouts[value];

  useEffect(() => {
    if (!target) return;
    if (!placed.current) {
      x.setValue(target.x);
      w.setValue(target.width);
      placed.current = true;
      return;
    }
    if (variant === 'pill') {
      Animated.spring(x, { toValue: target.x, useNativeDriver: false, bounciness: 4, speed: 16 }).start();
      w.setValue(target.width);
    } else {
      const cfg = { duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: false };
      Animated.parallel([Animated.timing(x, { toValue: target.x, ...cfg }), Animated.timing(w, { toValue: target.width, ...cfg })]).start();
    }
  }, [target, variant, x, w]);

  const press = (v: T) => {
    if (v === value) return;
    void Haptics.selectionAsync();
    onChange(v);
  };
  const measure = (key: string) => (e: LayoutChangeEvent) => {
    const { x: lx, width } = e.nativeEvent.layout;
    setLayouts((l) => (l[key]?.x === lx && l[key]?.width === width ? l : { ...l, [key]: { x: lx, width } }));
  };

  if (variant === 'tabs') {
    return (
      <View style={styles.tabsWrap} accessibilityRole="tablist">
        <View style={styles.tabsRow}>
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <Pressable
                key={o.value}
                onPress={() => press(o.value)}
                onLayout={measure(o.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                hitSlop={8}
                style={styles.tab}
              >
                <Text style={[type.label, { color: selected ? colors.text : colors.textIgnored }]}>{o.label}</Text>
              </Pressable>
            );
          })}
          {target ? <Animated.View style={[styles.underline, { left: x, width: w }]} /> : null}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {target ? <Animated.View style={[styles.pill, { left: x, width: w }]} /> : null}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => press(o.value)}
            onLayout={measure(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.segment}
          >
            <Text style={[type.labelS, { color: selected ? colors.textInverse : colors.textSubtle }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * RM ProgressBar#38050: fill (left radii) + 2 px gap + track (right radii).
 * Over 100 %: the allowance share stays white and the overage turns
 * `progressWarning`. `full` draws one warning bar (month over plan).
 */
export function ProgressBar({ value, max, full = false }: { value: number; max: number; full?: boolean }) {
  const over = !full && max > 0 && value > max;
  const share = full ? 1 : max > 0 ? (over ? max / value : Math.min(value / max, 1)) : 0;
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: share, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [share, anim]);
  const now = max > 0 ? Math.round((value / max) * 100) : 0;
  const a11y = { accessibilityRole: 'progressbar' as const, accessibilityValue: { min: 0, max: 100, now } };

  if (full) return <View {...a11y} style={[styles.bar, { borderRadius: 3, backgroundColor: colors.progressWarning }]} />;
  return (
    <View {...a11y} style={styles.barRow}>
      <Animated.View
        style={[
          styles.bar,
          styles.barFill,
          { width: anim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
        ]}
      />
      <View style={[styles.bar, styles.barTrack, over && { backgroundColor: colors.progressWarning }]} />
    </View>
  );
}

export type ChipVariant = 'success' | 'warning' | 'secondary' | 'primary';
const CHIP: Record<ChipVariant, { bg: string; fg: string }> = {
  success: { bg: colors.chipSuccessBg, fg: colors.chipSuccessFg },
  warning: { bg: colors.chipWarningBg, fg: colors.chipWarningFg },
  secondary: { bg: colors.track, fg: colors.text },
  primary: { bg: colors.text, fg: colors.textInverse },
};

/** RM Chip#37816: 28 high, round, 16 px icon, LabelSmall. */
export function Chip({
  label,
  variant = 'secondary',
  icon: Icon,
  iconColor,
  style,
}: {
  label: string;
  variant?: ChipVariant;
  icon?: LucideIcon;
  iconColor?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const c = CHIP[variant];
  return (
    <View style={[styles.chip, { backgroundColor: c.bg }, style]}>
      {Icon ? <Icon size={16} color={iconColor ?? c.fg} /> : null}
      <Text style={[type.labelS, styles.tabular, { color: c.fg }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const MONEY_SIZE = { xxl: type.headingXXL, xl: type.headingXL, l: type.headingL } as const;
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/**
 * RM DollarsAndCentsDisplay: big whole dollars with small raised cents,
 * tabular figures, optional bottom-aligned suffix ("today", "/mo").
 */
export function Money({
  value,
  size = 'xl',
  cents = true,
  suffix,
  color,
  countUp,
}: {
  value: number;
  size?: keyof typeof MONEY_SIZE;
  cents?: boolean;
  suffix?: string;
  color?: string;
  /** Count up to the value over this many ms (hero numbers ≥ $1; skipped under Reduce Motion). */
  countUp?: number;
}) {
  const shown = useCountUp(value, countUp ?? 0, !!countUp);
  // Hermes has no Intl formatToParts, so split the formatted string at its decimal point.
  const [dollars, frac = '00'] = usd.format(cents ? shown : Math.round(shown)).split('.');
  const showCents = cents && frac !== '00';
  return (
    <View style={styles.moneyRow} accessible accessibilityLabel={`${usd.format(value)}${suffix ? ` ${suffix}` : ''}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        <Text style={[MONEY_SIZE[size], styles.tabular, color ? { color } : null]}>{dollars}</Text>
        {showCents ? (
          <Text style={[type.headingXS, styles.tabular, { color: colors.textSubtle, marginTop: 4, marginLeft: 2 }]}>.{frac}</Text>
        ) : null}
      </View>
      {suffix ? <Text style={[type.headingXS, { color: colors.textIgnored, marginLeft: 6, paddingBottom: 6 }]}>{suffix}</Text> : null}
    </View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: disabled ? colors.accentFill : pressed ? colors.brandPressed : colors.brand }
          : { backgroundColor: colors.track },
      ]}
    >
      {({ pressed }) =>
        loading ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <>
            <Text style={[type.label, { color: disabled ? colors.textDisabled : colors.text }]}>{label}</Text>
            {!primary ? <PressOverlay pressed={pressed} color={colors.rowPressed} /> : null}
          </>
        )
      }
    </Pressable>
  );
}

/** Polish #13: accent disc + glyph, title, body, optional secondary action. */
export function EmptyState({
  title,
  body,
  icon: Icon,
  action,
}: {
  title: string;
  body?: string;
  icon?: LucideIcon;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.empty}>
      {Icon ? (
        <View style={styles.emptyDisc}>
          <Icon size={24} color={colors.textSubtle} />
        </View>
      ) : null}
      <Text style={[type.headingXXS, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.paragraph, styles.emptyBody]}>{body}</Text> : null}
      {action ? (
        <Pressable onPress={action.onPress} accessibilityRole="button" style={styles.emptyAction}>
          {({ pressed }) => (
            <>
              <Text style={type.labelS}>{action.label}</Text>
              <PressOverlay pressed={pressed} color={colors.rowPressed} />
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Inline load error with retry; screens show it in place of their content. */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space(10), gap: space(3) }}>
      <Text style={type.headingXXS}>Couldn&apos;t load this</Text>
      <Text style={[type.paragraph, { color: colors.textSubtle }]}>Check your connection and try again.</Text>
      <Button label="Try again" variant="secondary" onPress={onRetry} />
    </View>
  );
}

// One shared pulse drives every skeleton (polish #10).
const pulse = new Animated.Value(0.5);
let pulsing = false;
function usePulse() {
  useEffect(() => {
    if (pulsing) return;
    pulsing = true;
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, []);
  return pulse;
}

export function Skeleton({
  height,
  width,
  round = false,
  style,
}: {
  height: number;
  width?: number | `${number}%`;
  round?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = usePulse();
  return (
    <Animated.View
      style={[
        { height, width, borderRadius: round ? radius.round : radius.sm, backgroundColor: colors.skeleton, opacity },
        style,
      ]}
    />
  );
}

/** RM SkeletonContentRow: 32 avatar, two text bars, trailing value bar. */
export function SkeletonRow() {
  return (
    <View style={styles.skRow}>
      <Skeleton height={32} width={32} round />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton height={19} width="60%" />
        <Skeleton height={12} width="35%" />
      </View>
      <Skeleton height={21} width={46} />
    </View>
  );
}

/** Card + heading bar + rows, mirroring list cards while loading. */
export function SkeletonCard({ rows = 4, heading = true }: { rows?: number; heading?: boolean }) {
  return (
    <View style={[styles.card, styles.skCard]}>
      {heading ? <Skeleton height={24} width={96} /> : null}
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(3),
    paddingHorizontal: space(4),
    paddingTop: space(2),
    paddingBottom: space(3),
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  body: { paddingHorizontal: space(4), paddingBottom: space(10), gap: space(4) },
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4), overflow: 'hidden' },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(2),
  },
  band: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: -space(4),
    paddingHorizontal: 20,
    paddingVertical: space(2),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 56, paddingVertical: space(2) },
  bleed: { marginHorizontal: -space(4), paddingHorizontal: space(4) },
  tabular: { fontVariant: ['tabular-nums'] },
  segmented: {
    flexDirection: 'row',
    height: 40,
    backgroundColor: colors.cardSubtle,
    borderWidth: 1,
    borderColor: colors.card,
    borderRadius: radius.round,
    padding: 4,
  },
  pill: { position: 'absolute', top: 4, bottom: 4, borderRadius: radius.round, backgroundColor: colors.text },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.round },
  tabsWrap: {
    marginHorizontal: -space(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderTranslucent,
  },
  tabsRow: { flexDirection: 'row', gap: space(6), paddingHorizontal: space(4) },
  tab: { paddingTop: 6, paddingBottom: 10 },
  underline: { position: 'absolute', bottom: 0, height: 2, backgroundColor: colors.text },
  barRow: { flexDirection: 'row', gap: 2, height: 6 },
  bar: { height: 6 },
  barFill: { backgroundColor: colors.text, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 },
  barTrack: { flex: 1, backgroundColor: colors.track, borderTopRightRadius: 3, borderBottomRightRadius: 3 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    height: 28,
    paddingHorizontal: 10,
    gap: 4,
    borderRadius: radius.round,
  },
  moneyRow: { flexDirection: 'row', alignItems: 'flex-end' },
  button: {
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: space(6),
    overflow: 'hidden',
  },
  empty: { alignItems: 'center', paddingVertical: space(8), gap: space(3) },
  emptyDisc: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBody: { color: colors.textSubtle, textAlign: 'center', maxWidth: 280 },
  emptyAction: {
    height: 40,
    paddingHorizontal: space(4),
    borderRadius: radius.round,
    backgroundColor: colors.track,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  skRow: { flexDirection: 'row', alignItems: 'center', gap: space(4) },
  skCard: { paddingVertical: space(6), paddingHorizontal: 20, gap: space(4) },
});
