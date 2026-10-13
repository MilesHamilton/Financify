import type { AccountGroup, AccountSummary, NetWorthRange, NetWorthResponse } from '@contract';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { AccountToggleRow } from '@/components/net-worth/AccountToggleRow';
import { NetWorthChart } from '@/components/net-worth/NetWorthChart';
import { Card, Divider, ErrorState, ListRow, Segmented, SectionHeader, Skeleton } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useApi } from '@/lib/use-api';

type Tab = 'summary' | 'assets' | 'debt';

const TABS = [
  { value: 'summary', label: 'Summary' },
  { value: 'assets', label: 'Assets' },
  { value: 'debt', label: 'Debt' },
] as const;

const RANGES: ReadonlyArray<{ value: NetWorthRange; label: string }> = (['1M', '3M', '6M', '1Y', 'ALL'] as const).map(
  (r) => ({ value: r, label: r }),
);

const RANGE_CAPTION: Record<NetWorthRange, string> = {
  '1M': 'past month',
  '3M': 'past 3 months',
  '6M': 'past 6 months',
  '1Y': 'past year',
  ALL: 'all time',
};

const ASSET_GROUPS: Array<[AccountGroup, string]> = [
  ['checking', 'Checking'],
  ['savings', 'Savings'],
  ['investment', 'Investments'],
  ['other', 'Other'],
];
const DEBT_GROUPS: Array<[AccountGroup, string]> = [
  ['credit', 'Credit Cards'],
  ['loan', 'Loans'],
];

const SERIES = { summary: 'netWorth', assets: 'assets', debt: 'debts' } as const;

export default function NetWorthScreen() {
  const [tab, setTab] = useState<Tab>('summary');
  const [range, setRange] = useState<NetWorthRange>('1M');
  const { data, error, loading, refresh, setData } = useApi<NetWorthResponse>(`/api/mobile/net-worth?range=${range}`);

  async function toggle(account: AccountSummary, include: boolean) {
    setData((d) =>
      d ? { ...d, accounts: d.accounts.map((a) => (a.id === account.id ? { ...a, isHidden: !include } : a)) } : d,
    );
    try {
      await api(`/api/mobile/accounts/${account.id}`, { method: 'PATCH', body: { isHidden: !include } });
    } catch {
      Alert.alert('Couldn’t update account', 'Please try again.');
    }
    void refresh();
  }

  const header = (
    <Stack.Screen
      options={{
        headerShown: true,
        title: 'Net Worth',
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerShadowVisible: false,
      }}
    />
  );

  if (error && !data) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: space(4) }}>
        {header}
        <ErrorState onRetry={refresh} />
      </View>
    );
  }

  const key = SERIES[tab];
  const series = data?.history.map((h) => h[key]) ?? [];
  const total = data ? (tab === 'summary' ? data.netWorth : tab === 'assets' ? data.assets : data.debts) : 0;
  const base = series[0] ?? total;
  const delta =
    data && tab === 'summary'
      ? data.change
      : { amount: total - base, pct: base !== 0 ? ((total - base) / Math.abs(base)) * 100 : null };
  const good = tab === 'debt' ? delta.amount <= 0 : delta.amount >= 0;
  const groups = tab === 'summary' ? [...ASSET_GROUPS, ...DEBT_GROUPS] : tab === 'assets' ? ASSET_GROUPS : DEBT_GROUPS;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10), gap: space(4) }}
      refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={refresh} tintColor={colors.textSubtle} />}
    >
      {header}
      <Segmented options={TABS} value={tab} onChange={setTab} />

      {!data ? (
        <>
          <Skeleton height={72} />
          <Skeleton height={160} />
          <Skeleton height={240} />
        </>
      ) : (
        <>
          <View style={{ gap: space(1) }}>
            <Text style={type.headingL} accessibilityRole="header">
              {money(total)}
            </Text>
            <Text style={[type.caption, { color: good ? colors.success : colors.warning }]}>
              {`${delta.amount >= 0 ? '▲' : '▼'} ${money(Math.abs(delta.amount))}`}
              {delta.pct !== null ? ` (${Math.abs(delta.pct).toFixed(1)}%)` : ''}
              <Text style={{ color: colors.textSubtle }}>{` ${RANGE_CAPTION[range]}`}</Text>
            </Text>
          </View>

          {series.length > 0 ? <NetWorthChart values={series} /> : null}
          <Segmented options={RANGES} value={range} onChange={setRange} />

          {tab === 'summary' ? (
            <Card style={{ paddingVertical: space(1) }}>
              <ListRow title="Total Assets" value={money(data.assets)} />
              <Divider />
              <ListRow title="Total Debt" value={money(data.debts)} />
            </Card>
          ) : null}

          {groups.map(([group, label]) => {
            const accounts = data.accounts.filter((a) => a.group === group);
            if (accounts.length === 0) return null;
            const sum = accounts.filter((a) => !a.isHidden).reduce((s, a) => s + a.balance, 0);
            return (
              <View key={group} style={{ gap: space(2) }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <SectionHeader title={label} />
                  <Text style={[type.labelS, { color: colors.textSubtle, marginTop: space(2) }]}>{money(sum)}</Text>
                </View>
                <Card style={{ paddingVertical: space(1) }}>
                  {accounts.map((a, i) => (
                    <View key={a.id}>
                      {i > 0 ? <Divider /> : null}
                      <AccountToggleRow account={a} onToggle={(inc) => void toggle(a, inc)} />
                    </View>
                  ))}
                </Card>
              </View>
            );
          })}

          <Pressable
            onPress={() =>
              Alert.alert(
                'How is my net worth calculated?',
                'Net worth is the total balance of your asset accounts (checking, savings, investments and other) minus what you owe on credit cards and loans. Accounts you toggle off are left out of the total and the chart.',
              )
            }
            accessibilityRole="link"
            hitSlop={8}
            style={{ alignSelf: 'center', marginTop: space(2) }}
          >
            <Text style={[type.labelS, { color: colors.textSubtle, textDecorationLine: 'underline' }]}>
              How is my net worth calculated?
            </Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}
