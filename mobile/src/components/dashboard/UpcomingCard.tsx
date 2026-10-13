import type { UpcomingBill } from '@contract';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { MerchantLogo } from '@/components/MerchantLogo';
import { Card } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { daysBetween, money } from '@/lib/format';

const due = (n: number) => (n <= 0 ? 'today' : n === 1 ? 'tomorrow' : `in ${n} days`);

export function UpcomingCard({ bills, today }: { bills: UpcomingBill[]; today: string }) {
  return (
    <Card style={{ gap: space(3) }}>
      <Text style={type.headingXXS}>Upcoming</Text>
      {bills.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space(4) }}>
          {bills.map((b) => (
            <View
              key={`${b.streamId}-${b.dueDate}`}
              style={styles.item}
              accessible
              accessibilityLabel={`${b.name} ${money(b.amount)} due ${due(daysBetween(today, b.dueDate))}`}
            >
              <MerchantLogo uri={b.logoUrl} name={b.name} size={44} />
              <Text style={type.labelS}>{money(b.amount, true)}</Text>
              <Text style={[type.caption, { color: colors.textSubtle }]}>{due(daysBetween(today, b.dueDate))}</Text>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Text style={[type.paragraph, { color: colors.textSubtle }]}>No bills due in the next 30 days.</Text>
      )}
      <Pressable onPress={() => router.push('/recurring')} accessibilityRole="link" hitSlop={8}>
        <Text style={[type.labelS, { color: colors.brandText }]}>See all upcoming</Text>
      </Pressable>
    </Card>
  );
}

const styles = StyleSheet.create({
  item: { alignItems: 'center', gap: space(1), minWidth: 64 },
});
