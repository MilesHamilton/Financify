import * as Haptics from 'expo-haptics';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from '@/constants/theme';
import { monthLabel, parseDay } from '@/lib/format';

import { addMonths, currentMonth } from './month';

const monthName = (m: string) => parseDay(`${m}-01`).toLocaleDateString('en-US', { month: 'long' });

/** "This month · October" / "Last month · September" / "March 2026". */
export function monthTitle(month: string) {
  const now = currentMonth();
  if (month === now) return `This month · ${monthName(month)}`;
  if (month === addMonths(now, -1)) return `Last month · ${monthName(month)}`;
  return monthLabel(month);
}

/** Polish #15 full variant: header pill with calendar icon, label and a chevron pair. */
export function MonthSelector({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const atNow = month >= currentMonth();
  const step = (d: number) => {
    void Haptics.selectionAsync();
    onChange(addMonths(month, d));
  };
  return (
    <View style={styles.pill}>
      <CalendarDays size={18} color={colors.textSubtle} />
      <Text style={[type.label, { flex: 1 }]} accessibilityRole="header" numberOfLines={1}>
        {monthTitle(month)}
      </Text>
      <Pressable onPress={() => step(-1)} accessibilityRole="button" accessibilityLabel="Previous month" style={styles.arrow}>
        <ChevronLeft size={18} color={colors.text} />
      </Pressable>
      <Pressable
        onPress={() => step(1)}
        disabled={atNow}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: atNow }}
        style={styles.arrow}
      >
        <ChevronRight size={18} color={atNow ? colors.textDisabled : colors.text} />
      </Pressable>
    </View>
  );
}

/** Compact header variant (spec §2): "October ⌄", opens a month picker. */
export function MonthPill({ month, onPress }: { month: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Month, ${monthLabel(month)}. Change`} style={styles.compact}>
      <CalendarDays size={16} color={colors.textSubtle} />
      <Text style={type.labelS}>{month === currentMonth() ? monthName(month) : monthLabel(month)}</Text>
      <ChevronDown size={16} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    height: 48,
    borderRadius: radius.round,
    backgroundColor: colors.card,
    paddingLeft: space(4),
    paddingRight: space(2),
  },
  arrow: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    borderRadius: radius.round,
    backgroundColor: colors.card,
    paddingLeft: 12,
    paddingRight: 6,
  },
});
