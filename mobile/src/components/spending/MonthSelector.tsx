import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '@/constants/theme';
import { monthLabel } from '@/lib/format';

import { addMonths, currentMonth } from './month';

export function MonthSelector({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const now = currentMonth();
  const label = month === now ? 'This Month' : month === addMonths(now, -1) ? 'Last Month' : monthLabel(month);
  const atNow = month >= now;
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onChange(addMonths(month, -1))} accessibilityRole="button" accessibilityLabel="Previous month" hitSlop={12}>
        <ChevronLeft size={22} color={colors.text} />
      </Pressable>
      <Text style={[type.labelL, styles.label]} accessibilityRole="header">
        {label}
      </Text>
      <Pressable
        onPress={() => onChange(addMonths(month, 1))}
        disabled={atNow}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: atNow }}
        hitSlop={12}
      >
        <ChevronRight size={22} color={atNow ? colors.textDisabled : colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
  label: { flex: 1, textAlign: 'center' },
});
