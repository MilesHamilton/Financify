import type { DailySpendResponse, DashboardResponse } from '@contract';
import { Banknote, TrendingDown, TrendingUp } from 'lucide-react-native';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DailySpendCard } from '@/components/daily-spend/DailySpendCard';
import { SpendChart } from '@/components/SpendChart';
import { addMonths, daysInMonth } from '@/components/spending/month';
import { Card, Chip, Money } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { daysBetween, money, monthLabel, parseDay, shortDate } from '@/lib/format';

const xLabels = (month: string): [string, string, string] => {
  const n = daysInMonth(month);
  const label = (d: number) => shortDate(`${month}-${String(d).padStart(2, '0')}`);
  return [label(1), label(Math.ceil(n / 2)), label(n)];
};
const dayOf = (month: string, i: number) => `${month}-${String(i + 1).padStart(2, '0')}`;

/** RM "SwipeyCards": Daily Spend, this month's spend, last month — with pagination dots. */
export function SpendCarousel({
  data,
  daily,
  onOpenDaily,
  onSelectDay,
  onScrubbing,
}: {
  data: DashboardResponse;
  daily: DailySpendResponse | null;
  onOpenDaily: () => void;
  onSelectDay: (date: string) => void;
  onScrubbing?: (active: boolean) => void;
}) {
  const [width, setWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [scrub, setScrub] = useState<{ which: 'current' | 'prior'; i: number } | null>(null);

  const diff = data.spendThisMonth - data.spendPriorToDate;
  const below = diff <= 0;
  const payday = data.nextPayday ? daysBetween(data.today, data.nextPayday) : null;
  const priorMonth = addMonths(data.month, -1);
  const priorTotal = data.daily.prior[data.daily.prior.length - 1] ?? 0;
  const onScrub = (which: 'current' | 'prior') => (i: number | null) => {
    setScrub(i === null ? null : { which, i });
    onScrubbing?.(i !== null);
  };
  const kicker = (which: 'current' | 'prior', month: string, fallback: string) =>
    scrub?.which === which
      ? `${parseDay(dayOf(month, scrub.i)).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
      : fallback;
  const headline = (which: 'current' | 'prior', series: number[], total: number) =>
    scrub?.which === which ? (series[scrub.i] ?? 0) : total;

  const pages: ReactElement[] = [
    ...(daily ? [<DailySpendCard key="daily" data={daily} onOpen={onOpenDaily} onSelectDay={onSelectDay} />] : []),
    <Card key="current" style={styles.page}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={[type.caption, { color: colors.textSubtle }]}>
            {kicker('current', data.month, 'Current spend this month')}
          </Text>
          <Money value={headline('current', data.daily.current, data.spendThisMonth)} size="xl" cents={false} countUp={400} />
        </View>
        <Chip
          variant={below ? 'success' : 'warning'}
          icon={below ? TrendingDown : TrendingUp}
          label={`${money(Math.abs(diff), true)} ${below ? 'below' : 'above'} last month`}
          style={{ maxWidth: 170 }}
        />
      </View>
      <SpendChart
        current={data.daily.current}
        prior={data.daily.prior}
        budget={data.budgetTotal}
        daysInMonth={daysInMonth(data.month)}
        xLabels={xLabels(data.month)}
        tooltip={(i) => `${shortDate(dayOf(data.month, i))} · ${money(data.daily.current[i] ?? 0, true)}`}
        onScrub={onScrub('current')}
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
      <Text style={[type.caption, { color: colors.textSubtle }]}>
        {kicker('prior', priorMonth, `Last month · ${monthLabel(priorMonth)}`)}
      </Text>
      <Money value={headline('prior', data.daily.prior, priorTotal)} size="xl" cents={false} />
      <Text style={[type.paragraph, { color: colors.textSubtle }]}>
        {money(data.spendPriorToDate, true)} spent by this day last month
      </Text>
      <SpendChart
        current={data.daily.prior}
        prior={[]}
        budget={data.budgetTotal}
        daysInMonth={daysInMonth(priorMonth)}
        xLabels={xLabels(priorMonth)}
        tooltip={(i) => `${shortDate(dayOf(priorMonth, i))} · ${money(data.daily.prior[i] ?? 0, true)}`}
        onScrub={onScrub('prior')}
      />
    </Card>,
  ];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={!scrub}
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={(e) => {
            const p = Math.round(e.nativeEvent.contentOffset.x / width);
            if (p !== page) setPage(p);
          }}
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
          <Dot key={p.key} active={i === page} />
        ))}
      </View>
    </View>
  );
}

/** 7 px dot; the active one widens to a 16 px white pill over 200 ms. */
function Dot({ active }: { active: boolean }) {
  const a = useRef(new Animated.Value(active ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: active ? 1 : 0, duration: 200, useNativeDriver: false }).start();
  }, [active, a]);
  return (
    <Animated.View
      style={[
        styles.dot,
        {
          width: a.interpolate({ inputRange: [0, 1], outputRange: [7, 16] }),
          backgroundColor: a.interpolate({ inputRange: [0, 1], outputRange: [colors.track, colors.text] }),
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  page: { gap: space(3), padding: 20, minHeight: 280 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: space(2) },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space(3) },
  dot: { height: 7, borderRadius: radius.round },
});
