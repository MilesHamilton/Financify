import type { DashboardResponse } from '@contract';
import { router } from 'expo-router';
import { RefreshCw, Settings } from 'lucide-react-native';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AccountsCard } from '@/components/dashboard/AccountsCard';
import { SpendCarousel } from '@/components/dashboard/SpendCarousel';
import { openTxn, TransactionRow } from '@/components/transactions';
import { UpcomingCard } from '@/components/dashboard/UpcomingCard';
import { Button, Card, Divider, ErrorState, ProgressBar, Screen, SectionHeader, Skeleton } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { money, relativeTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

export default function Dashboard() {
  const { data, error, loading, refresh } = useApi<DashboardResponse>('/api/mobile/dashboard');
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      await api('/api/sync/trigger', { method: 'POST', body: {} });
      await refresh();
    } catch {
      // shortcut: sync failure is silent; the "N hours ago" label stays stale as the signal.
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Screen refreshing={loading && !!data} onRefresh={refresh}>
      <View style={styles.header}>
        <Pressable onPress={() => router.push('/settings')} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8}>
          <Settings size={24} color={colors.text} />
        </Pressable>
        <Text style={[type.headingXS, styles.wordmark]}>Financify</Text>
        <View style={{ width: 24 }} />
      </View>

      {!data ? (
        error && !loading ? (
          <ErrorState onRetry={refresh} />
        ) : (
          <>
            <Skeleton height={280} />
            <Skeleton height={180} />
            <Skeleton height={140} />
          </>
        )
      ) : (
        <>
          <SpendCarousel data={data} />

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
              <Text style={[type.labelS, { color: colors.brandText }]}>View all</Text>
            </Pressable>
          </Card>

          <Card style={{ gap: space(3) }}>
            <Text style={type.headingXXS}>Your Budget</Text>
            {data.budgetTotal !== null ? (
              <>
                <ProgressBar value={data.spendThisMonth} max={data.budgetTotal} />
                <View style={styles.budgetRow}>
                  <Text style={[type.paragraph, { color: colors.textSubtle }]}>
                    {money(data.spendThisMonth, true)} of {money(data.budgetTotal, true)}
                  </Text>
                  <Text style={[type.labelS, data.spendThisMonth > data.budgetTotal && { color: colors.warning }]}>
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
  wordmark: { flex: 1, textAlign: 'center' },
  sync: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space(1.5) },
  budgetRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
