import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, radius, space, type } from '@/constants/theme';

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
}: {
  title?: string;
  actions?: ReactNode;
  left?: ReactNode;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scroll?: boolean;
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

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** RM "Tracked" section header: uppercase caps, optional underlined link on the right. */
export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[type.tracked, { color: colors.textSubtle }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link">
          <Text style={[type.labelS, { textDecorationLine: 'underline' }]}>{action}</Text>
        </Pressable>
      ) : null}
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
          <Text style={[type.label, valueColor ? { color: valueColor } : null]}>{value}</Text>
          {valueSubtitle ? <Text style={[type.caption, { color: colors.textSubtle }]}>{valueSubtitle}</Text> : null}
        </View>
      ) : null}
      {chevron ? <ChevronRight size={18} color={colors.textSubtle} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => (pressed ? { backgroundColor: 'rgba(255,255,255,0.05)' } : null)}
    >
      {body}
    </Pressable>
  );
}

/** Pill segmented control (Upcoming | All, Summary | Assets | Debt, 1M … ALL). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.segment, selected && { backgroundColor: colors.brand }]}
          >
            <Text style={[type.labelS, { color: selected ? '#fff' : colors.textSubtle }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Horizontal progress bar; turns warning-orange when over 100%. */
export function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? value / max : 0;
  return (
    <View style={styles.track}>
      <View
        style={{
          width: `${Math.min(pct, 1) * 100}%`,
          height: '100%',
          borderRadius: radius.round,
          backgroundColor: pct > 1 ? colors.warningFill : colors.brand,
        }}
      />
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        primary
          ? { backgroundColor: pressed ? colors.brandPressed : colors.brand }
          : { borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? 'rgba(255,255,255,0.1)' : 'transparent' },
        (disabled || loading) && { opacity: 0.5 },
      ]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={[type.label, { color: '#fff' }]}>{label}</Text>}
    </Pressable>
  );
}

export function EmptyState({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: space(10), gap: space(2) }}>
      <Text style={type.headingXXS}>{title}</Text>
      {body ? <Text style={[type.paragraph, { color: colors.textSubtle, textAlign: 'center' }]}>{body}</Text> : null}
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

export function Skeleton({ height, style }: { height: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height, borderRadius: radius.md, backgroundColor: colors.skeleton }, style]} />;
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
  card: { backgroundColor: colors.card, borderRadius: radius.md, padding: space(4) },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space(2),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 56, paddingVertical: space(2) },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.cardSubtle,
    borderRadius: radius.round,
    padding: 3,
  },
  segment: { flex: 1, alignItems: 'center', paddingVertical: space(2), borderRadius: radius.round },
  track: { height: 6, borderRadius: radius.round, backgroundColor: colors.track, overflow: 'hidden' },
  button: {
    borderRadius: radius.round,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space(3.5),
    paddingHorizontal: space(6),
  },
});
