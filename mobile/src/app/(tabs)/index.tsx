import type { DashboardResponse } from '@contract';
import { router } from 'expo-router';
import { RefreshCw, Settings } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useDailySpend } from '@/components/daily-spend/model';
import { AccountsCard } from '@/components/dashboard/AccountsCard';
import { RecapBanner } from '@/components/dashboard/RecapBanner';
import { SpendCarousel } from '@/components/dashboard/SpendCarousel';
import { openTxn, TransactionRow } from '@/components/transactions';
import { UpcomingCard } from '@/components/dashboard/UpcomingCard';
import { Button, Card, Divider, ErrorState, ProgressBar, Screen, SectionHeader, Skeleton, SkeletonCard } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { money, relativeTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

const openDay = (date: string) => router.push({ pathname: '/daily-spend/day', params: { date } });

export default function Dashboard() {
  const { data, error, loading, refresh } = useApi<DashboardResponse>('/api/mobile/dashboard');
  const daily = useDailySpend();
  const [syncing, setSyncing] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      await api('/api/sync/trigger', { method: 'POST', body: {} });
      await Promise.all([refresh(), daily.refresh()]);
    } catch {
      // shortcut: sync failure is silent; the "N hours ago" label stays stale as the signal.
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen
      refreshing={loading && !!data}
      onRefresh={() => void Promise.all([refresh(), daily.refresh()])}
      scrollEnabled={!scrubbing}
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8}>
          <Settings size={24} color={colors.text} />
        </Pressable>
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="Financify">
          <Image source={require('../../../assets/logo-mark.png')} style={styles.mark} />
          <Text style={type.headingXS}>Financify</Text>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {!data ? (
        error && !loading ? (
          <ErrorState onRetry={refresh} />
        ) : (
          <>
            <Card style={{ padding: 20, gap: space(4) }}>
              <Skeleton height={16} width={140} />
              <Skeleton height={48} width={120} />
              <Skeleton height={32} />
              <Skeleton height={16} width={200} />
            </Card>
            <SkeletonCard rows={3} heading={false} />
            <SkeletonCard rows={4} />
          </>
        )
      ) : (
        <>
          <SpendCarousel
            data={data}
            daily={daily.data}
            onOpenDaily={() => router.navigate({ pathname: '/spending', params: { tab: 'daily' } })}
            onSelectDay={openDay}
            onScrubbing={setScrubbing}
          />

          <RecapBanner today={data.today} />

          <SectionHeader title="Accounts" action="Add account" onAction={() => router.push('/settings')} />
          <AccountsCard accounts={data.accounts} />
          <Pressable
            onPress={sync}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel="Sync now"
            style={styles.sync}
          >
            <RefreshCw size={14} color={colors.textSubtle} />
            <Text style={[type.caption, { color: colors.textSubtle }]}>
              {syncing ? 'Syncing…' : `${relativeTime(data.lastSyncedAt)} | `}
              {syncing ? null : <Text style={{ textDecorationLine: 'underline', color: colors.text }}>Sync now</Text>}
            </Text>
          </Pressable>

          <UpcomingCard bills={data.upcoming} today={data.today} />

          <Card style={{ paddingVertical: space(2) }}>
            <Text style={[type.headingXXS, { paddingVertical: space(2) }]}>Recent Transactions</Text>
            {data.recent.map((t, i) => (
              <Fragment key={t.id}>
                {i > 0 ? <Divider inset={48} /> : null}
                <TransactionRow txn={t} onPress={() => openTxn(t)} showDate />
              </Fragment>
            ))}
            <Pressable onPress={() => router.push('/transactions')} accessibilityRole="link" hitSlop={8} style={{ paddingVertical: space(2) }}>
              {({ pressed }) => <Text style={[type.labelS, { color: pressed ? colors.brand : colors.brandText }]}>View all</Text>}
            </Pressable>
          </Card>

          <Card style={{ gap: space(3) }}>
            <Text style={type.headingXXS}>Your Budget</Text>
            {data.budgetTotal !== null ? (
              <>
                <ProgressBar value={data.spendThisMonth} max={data.budgetTotal} />
                <View style={styles.budgetRow}>
                  <Text style={[type.paragraph, styles.num, { color: colors.textSubtle }]}>
                    {money(data.spendThisMonth, true)} of {money(data.budgetTotal, true)}
                  </Text>
                  <Text style={[type.labelS, styles.num, data.spendThisMonth > data.budgetTotal && { color: colors.warning }]}>
                    {money(Math.abs(data.budgetTotal - data.spendThisMonth), true)}{' '}
                    {data.spendThisMonth > data.budgetTotal ? 'Over Budget' : 'Left to Spend'}
                  </Text>
                </View>
              </>
            ) : (
              <>
                <Text style={[type.paragraph, { color: colors.textSubtle }]}>Set spend targets to track your month.</Text>
                <Button label="Start a budget" onPress={() => router.push('/spending/budget')} />
              </>
            )}
          </Card>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', paddingTop: space(2) },
  brand: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(2) },
  mark: { width: 24, height: 24 },
  sync: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1.5) },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between' },
  num: { fontVariant: ['tabular-nums'] },
});
