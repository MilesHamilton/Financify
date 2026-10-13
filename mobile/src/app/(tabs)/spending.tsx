import type { SpendingResponse } from '@contract';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { SpendChart } from '@/components/SpendChart';
import { BreakdownCard } from '@/components/spending/BreakdownCard';
import { MonthSelector } from '@/components/spending/MonthSelector';
import { currentMonth, daysInMonth } from '@/components/spending/month';
import { Button, Card, Divider, ErrorState, ListRow, Screen, SectionHeader, Skeleton } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { money } from '@/lib/format';
import { useApi } from '@/lib/use-api';

export default function SpendingScreen() {
  const [month, setMonth] = useState(currentMonth);
  const { data, error, loading, refresh } = useApi<SpendingResponse>(`/api/mobile/spending?month=${month}`);

  // Refetch when returning from the budget editor; skip the initial focus (useApi already loads on mount).
  const focused = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focused.current) void refresh();
      focused.current = true;
    }, [refresh]),
  );

  const editBudget = () => router.push({ pathname: '/spending/budget', params: { month } });
  const shown = data?.month === month ? data : null;

  return (
    <Screen title="Spending" refreshing={loading && !!shown} onRefresh={refresh}>
      <MonthSelector month={month} onChange={setMonth} />
      {!shown ? (
        error && !loading ? (
          <ErrorState onRetry={refresh} />
        ) : (
          <>
            <Skeleton height={180} />
            <Skeleton height={220} />
            <Skeleton height={300} />
          </>
        )
      ) : (
        <>
          <Card style={{ gap: space(3), borderRadius: radius.lg }}>
            <Text style={[type.labelS, { color: colors.textSubtle }]}>Spent</Text>
            <Text style={type.headingL}>{money(shown.bills + shown.spending, true)}</Text>
            <SpendChart
              current={shown.daily.current}
              prior={shown.daily.prior}
              budget={shown.budgetTotal}
              daysInMonth={daysInMonth(month)}
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
            <ListRow
              title="Net Income"
              value={money(shown.net)}
              valueColor={shown.net >= 0 ? colors.success : colors.warning}
            />
          </Card>

          {shown.budgetTotal === null ? (
            <Card style={{ gap: space(2) }}>
              <Text style={type.headingXXS}>Start a budget</Text>
              <Text style={[type.paragraph, { color: colors.textSubtle }]}>
                Control your spend · Get recommended spend targets
              </Text>
              <Button label="Begin" onPress={editBudget} />
            </Card>
          ) : null}

          <SectionHeader
            title="Breakdown"
            action={shown.budgetTotal !== null ? 'Edit budget' : undefined}
            onAction={editBudget}
          />
          <BreakdownCard data={shown} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', alignItems: 'center', gap: space(1.5) },
  swatch: { width: 12, height: 3, borderRadius: radius.round, marginLeft: space(1) },
});
