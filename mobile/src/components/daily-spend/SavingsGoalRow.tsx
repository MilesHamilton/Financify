import type { DailySpendResponse } from '@contract';
import { PiggyBank } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';

import { $ } from './model';

/** "Savings goal · $800/mo — On pace to save $824 (103%)" + Adjust (spec §2 3c). */
export function SavingsGoalRow({ data, onAdjust }: { data: DailySpendResponse; onAdjust: () => void }) {
  const good = data.status === 'super_saver' || data.status === 'on_track';
  const projected = data.totals.projectedSavings;
  const pct = data.totals.percentOfTarget;
  return (
    <Card onPress={onAdjust} accessibilityLabel="Savings goal. Adjust" style={styles.card}>
      <View style={styles.disc}>
        <PiggyBank size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={type.label} numberOfLines={1}>
          Savings goal · {$(data.plan.savingsTarget)}/mo
        </Text>
        {projected !== null ? (
          <Text style={[type.caption, { color: good ? colors.success : colors.warning }]} numberOfLines={1}>
            On pace to save {$(projected)}
            {pct !== null ? ` (${pct}%)` : ''}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onAdjust} accessibilityRole="button" accessibilityLabel="Adjust savings goal" style={({ pressed }) => [styles.adjust, pressed && { backgroundColor: colors.accentFill }]}>
        <Text style={type.labelS}>Adjust</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: 14, paddingHorizontal: space(4) },
  disc: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.accentFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjust: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: radius.round,
    backgroundColor: colors.track,
    justifyContent: 'center',
  },
});
