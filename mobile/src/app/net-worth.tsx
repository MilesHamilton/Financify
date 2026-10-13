import type { AccountGroup, AccountSummary, NetWorthRange, NetWorthResponse } from '@contract';
import { useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { AccountToggleRow } from '@/components/net-worth/AccountToggleRow';
import { SpendChart } from '@/components/SpendChart';
import { Card, Divider, ErrorState, ListRow, Money, Screen, Segmented, SectionHeader, Skeleton, SkeletonCard } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { money, shortDate } from '@/lib/format';
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
  const [scrub, setScrub] = useState<number | null>(null);
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

  if (error && !data) {
    return (
      <Screen title="Net Worth" left={<BackButton />}>
        <ErrorState onRetry={refresh} />
      </Screen>
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
    <Screen title="Net Worth" left={<BackButton />} refreshing={loading && !!data} onRefresh={refresh} scrollEnabled={scrub === null}>
      <Segmented variant="tabs" options={TABS} value={tab} onChange={setTab} />

      {!data ? (
        <>
          <View style={{ gap: space(2) }}>
            <Skeleton height={44} width={200} />
            <Skeleton height={16} width={160} />
          </View>
          <Skeleton height={160} />
          <Skeleton height={40} round />
          <SkeletonCard rows={3} heading={false} />
        </>
      ) : (
        <>
          <View style={{ gap: space(1) }} accessibilityRole="header">
            <Money value={scrub !== null ? (series[scrub] ?? total) : total} size="xl" countUp={scrub === null ? 400 : undefined} />
            {scrub !== null && data.history[scrub] ? (
              <Text style={[type.caption, { color: colors.textSubtle }]}>{shortDate(data.history[scrub].date)}</Text>
            ) : (
              <Text style={[type.caption, { color: good ? colors.success : colors.warning }]}>
                {`${delta.amount >= 0 ? '▲' : '▼'} ${money(Math.abs(delta.amount))}`}
                {delta.pct !== null ? ` (${Math.abs(delta.pct).toFixed(1)}%)` : ''}
                <Text style={{ color: colors.textSubtle }}>{` ${RANGE_CAPTION[range]}`}</Text>
              </Text>
            )}
          </View>

          {series.length > 0 ? (
            // Offset by the minimum so the line spans the chart (and negative net worth plots).
            <SpendChart
              current={series.map((v) => v - Math.min(...series))}
              prior={[]}
              budget={null}
              daysInMonth={series.length}
              height={160}
              yBase={Math.min(...series)}
              xLabels={[
                shortDate(data.history[0].date),
                shortDate(data.history[Math.floor((data.history.length - 1) / 2)].date),
                shortDate(data.history[data.history.length - 1].date),
              ]}
              tooltip={(i) => `${shortDate(data.history[i].date)} · ${money(series[i], true)}`}
              onScrub={setScrub}
            />
          ) : null}
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
    </Screen>
  );
}
