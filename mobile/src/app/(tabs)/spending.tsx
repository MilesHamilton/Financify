import type { SpendingResponse } from '@contract';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { DayBarChart, DayBarChartSkeleton } from '@/components/daily-spend/DayBarChart';
import { HeroCard } from '@/components/daily-spend/HeroCard';
import { useDailySpend } from '@/components/daily-spend/model';
import { SavingsGoalRow } from '@/components/daily-spend/SavingsGoalRow';
import { SpendChart } from '@/components/SpendChart';
import { BreakdownCard } from '@/components/spending/BreakdownCard';
import { MonthPill, MonthSelector } from '@/components/spending/MonthSelector';
import { addMonths, currentMonth, daysInMonth } from '@/components/spending/month';
import { PickerSheet } from '@/components/transactions';
import { Button, Card, Divider, ErrorState, ListRow, Money, Screen, SectionHeader, Segmented, Skeleton, SkeletonCard } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { money, monthLabel, shortDate } from '@/lib/format';
import { useApi } from '@/lib/use-api';

type Tab = 'overview' | 'daily' | 'breakdown';
const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'daily', label: 'Daily' },
  { value: 'breakdown', label: 'Breakdown' },
] as const;

// Tab selection persists for the session (spec §2.2).
let sessionTab: Tab = 'overview';

const MONTHS = Array.from({ length: 12 }, (_, i) => addMonths(currentMonth(), -i));

export default function SpendingScreen() {
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTabState] = useState<Tab>(params.tab ?? sessionTab);
  const setTab = (t: Tab) => {
    sessionTab = t;
    setTabState(t);
  };
  useEffect(() => {
    if (params.tab) setTab(params.tab);
  }, [params.tab]);

  const [month, setMonth] = useState(currentMonth);
  const [picking, setPicking] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const { data, error, loading, refresh } = useApi<SpendingResponse>(`/api/mobile/spending?month=${month}`);
  const daily = useDailySpend(month);

  // Refetch when returning from the budget editor; skip the initial focus (useApi already loads on mount).
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) void refresh();
      focused.current = true;
    }, [refresh]),
  );

  const editBudget = () => router.push({ pathname: '/spending/budget', params: { month } });
  const adjustGoal = () => router.push('/daily-spend/goal');
  const shown = data?.month === month ? data : null;
  const dailyShown = daily.data?.month === month ? daily.data : null;

  const pullRefresh = async () => {
    await Promise.all([refresh(), daily.refresh()]);
    void Haptics.selectionAsync();
  };

  let body;
  if (tab === 'daily') {
    body =
      daily.error && !dailyShown && !daily.loading ? (
        <ErrorState onRetry={daily.refresh} />
      ) : (
        <>
          <HeroCard data={dailyShown} onAdjust={adjustGoal} onSetIncome={() => router.push('/settings')} />
          {dailyShown ? (
            <>
              <DayBarChart
                data={dailyShown}
                onSelectDay={(date) => router.push({ pathname: '/daily-spend/day', params: { date } })}
                onScrubbing={setScrubbing}
              />
              {dailyShown.status !== 'no_income' ? <SavingsGoalRow data={dailyShown} onAdjust={adjustGoal} /> : null}
            </>
          ) : (
            <DayBarChartSkeleton />
          )}
        </>
      );
  } else if (!shown) {
    body =
      error && !loading ? (
        <ErrorState onRetry={refresh} />
      ) : tab === 'overview' ? (
        <>
          <Card style={{ gap: space(3), padding: 20 }}>
            <Skeleton height={16} width={64} />
            <Skeleton height={40} width={140} />
            <Skeleton height={140} />
          </Card>
          <SkeletonCard rows={4} heading={false} />
        </>
      ) : (
        <SkeletonCard rows={5} />
      );
  } else if (tab === 'overview') {
    body = (
      <>
        <MonthSelector month={month} onChange={setMonth} />
        <Card style={{ gap: space(3), padding: 20 }}>
          <Text style={[type.labelS, { color: colors.textSubtle }]}>Spent</Text>
          <Money value={shown.bills + shown.spending} size="xl" cents={false} countUp={400} />
          <SpendChart
            current={shown.daily.current}
            prior={shown.daily.prior}
            budget={shown.budgetTotal}
            daysInMonth={daysInMonth(month)}
            xLabels={[
              shortDate(`${month}-01`),
              shortDate(`${month}-${String(Math.ceil(daysInMonth(month) / 2)).padStart(2, '0')}`),
              shortDate(`${month}-${daysInMonth(month)}`),
            ]}
            tooltip={(i) => `${shortDate(`${month}-${String(i + 1).padStart(2, '0')}`)} · ${money(shown.daily.current[i] ?? 0, true)}`}
            onScrub={(i) => setScrubbing(i !== null)}
          />
          <View style={styles.legend}>
            <View style={[styles.swatch, { backgroundColor: colors.chartLine }]} />
            <Text style={[type.caption, { color: colors.textSubtle }]}>This month</Text>
            <View style={[styles.swatch, { backgroundColor: colors.chartAxis }]} />
            <Text style={[type.caption, { color: colors.textSubtle }]}>Last month</Text>
          </View>
        </Card>

        <Card style={{ paddingVertical: space(1) }}>
          <ListRow title="Income" value={`+${money(shown.income)}`} valueColor={colors.success} />
          <Divider />
          <ListRow title="Bills & Utilities" value={money(shown.bills)} />
          <Divider />
          <ListRow title="Spending" value={money(shown.spending)} />
          <Divider />
          <ListRow title="Net Income" value={money(shown.net)} valueColor={shown.net >= 0 ? colors.success : colors.warning} />
        </Card>

        {shown.budgetTotal === null ? (
          <Card style={{ gap: space(2) }}>
            <Text style={type.headingXXS}>Start a budget</Text>
            <Text style={[type.paragraph, { color: colors.textSubtle }]}>Control your spend · Get recommended spend targets</Text>
            <Button label="Begin" onPress={editBudget} />
          </Card>
        ) : null}
      </>
    );
  } else {
    body = (
      <>
        <SectionHeader title="Breakdown" action={shown.budgetTotal !== null ? 'Edit budget' : undefined} onAction={editBudget} />
        <BreakdownCard data={shown} />
      </>
    );
  }

  return (
    <Screen
      title="Spending"
      actions={tab === 'overview' ? undefined : <MonthPill month={month} onPress={() => setPicking(true)} />}
      refreshing={(loading && !!shown) || (daily.loading && !!dailyShown)}
      onRefresh={() => void pullRefresh()}
      scrollEnabled={!scrubbing}
    >
      <Segmented variant="tabs" options={TABS} value={tab} onChange={setTab} />
      {body}
      <PickerSheet
        visible={picking}
        title="Month"
        options={MONTHS.map((m) => ({ id: m, label: monthLabel(m) }))}
        selected={month}
        onSelect={setMonth}
        onClose={() => setPicking(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  swatch: { width: 12, height: 3, borderRadius: radius.round, marginLeft: space(1) },
});
