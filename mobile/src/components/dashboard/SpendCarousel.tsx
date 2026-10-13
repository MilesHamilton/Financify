import type { DashboardResponse } from '@contract';
import { Banknote, CircleAlert, CircleCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { SpendChart } from '@/components/SpendChart';
import { addMonths, daysInMonth } from '@/components/spending/month';
import { Card } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { daysBetween, money, monthLabel } from '@/lib/format';

/** RM "SwipeyCards": paged cards with pagination dots. */
export function SpendCarousel({ data }: { data: DashboardResponse }) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);

  const diff = data.spendThisMonth - data.spendPriorToDate;
  const below = diff <= 0;
  const Badge = below ? CircleCheck : CircleAlert;
  const badgeColor = below ? colors.success : colors.warning;
  const payday = data.nextPayday ? daysBetween(data.today, data.nextPayday) : null;
  const priorMonth = addMonths(data.month, -1);
  const priorTotal = data.daily.prior[data.daily.prior.length - 1] ?? 0;

  const pages = [
    <Card key="current" style={styles.page}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[type.labelS, { color: colors.textSubtle }]}>Current spend this month</Text>
          <Text style={type.headingXL}>{money(data.spendThisMonth, true)}</Text>
        </View>
        <View style={styles.badge}>
          <Badge size={16} color={badgeColor} />
          <Text style={[type.caption, { color: badgeColor }]}>
            {money(Math.abs(diff), true)} {below ? 'below' : 'above'} last month
          </Text>
        </View>
      </View>
      <SpendChart
        current={data.daily.current}
        prior={data.daily.prior}
        budget={data.budgetTotal}
        daysInMonth={daysInMonth(data.month)}
      />
      {payday !== null ? (
        <View style={styles.footer}>
          <Banknote size={16} color={colors.textSubtle} />
          <Text style={[type.caption, { color: colors.textSubtle }]}>
            {payday <= 0 ? 'Payday today' : `Payday in ${payday} day${payday === 1 ? '' : 's'}`}
          </Text>
        </View>
      ) : null}
    </Card>,
    <Card key="prior" style={styles.page}>
      <Text style={[type.labelS, { color: colors.textSubtle }]}>Last month · {monthLabel(priorMonth)}</Text>
      <Text style={type.headingXL}>{money(priorTotal, true)}</Text>
      <Text style={[type.paragraph, { color: colors.textSubtle }]}>
        {money(data.spendPriorToDate, true)} spent by this day last month
      </Text>
      <SpendChart current={data.daily.prior} prior={[]} budget={data.budgetTotal} daysInMonth={daysInMonth(priorMonth)} />
    </Card>,
  ];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        >
          {pages.map((p) => (
            <View key={p.key} style={{ width }}>
              {p}
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${pages.length}`}>
        {pages.map((p, i) => (
          <View key={p.key} style={[styles.dot, i === page && { backgroundColor: colors.text }]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: space(3), borderRadius: radius.lg, minHeight: 280 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2) },
  badge: { flexDirection: 'row', alignItems: 'center', gap: space(1), maxWidth: 150 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: space(1.5), marginTop: space(3) },
  dot: { width: 6, height: 6, borderRadius: radius.round, backgroundColor: colors.accentFill },
});
