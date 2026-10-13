import type { NetWorthResponse } from '@contract';
import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, RefreshControl, ScrollView, View } from 'react-native';

import { InstitutionCard } from '@/components/settings/InstitutionCard';
import { Button, Card, Divider, EmptyState, ErrorState, ListRow, SectionHeader, Skeleton } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { money, relativeTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

/** GET/PUT /api/settings — numeric columns come back as decimal strings. */
interface AppSettings {
  monthlySavingsTarget: string;
  monthlyIncomeOverride: string | null;
}

export default function SettingsScreen() {
  const signOut = useAuthStore((s) => s.signOut);
  const accounts = useApi<NetWorthResponse>('/api/mobile/net-worth?range=1M');
  const settings = useApi<AppSettings>('/api/settings');
  const [busy, setBusy] = useState<string | null>(null);

  const items = new Map<string, NetWorthResponse['accounts']>();
  for (const a of accounts.data?.accounts ?? []) items.set(a.itemId, [...(items.get(a.itemId) ?? []), a]);
  const lastSynced = accounts.data?.accounts.reduce<string | null>(
    (m, a) => (a.lastSyncedAt && (!m || a.lastSyncedAt > m) ? a.lastSyncedAt : m),
    null,
  );

  /** Opens Plaid Hosted Link, then queues a sync and reloads accounts. */
  async function link(key: string, path: string, body: object, itemId?: string) {
    setBusy(key);
    try {
      const { hosted_link_url } = await api<{ hosted_link_url: string }>(path, { method: 'POST', body });
      await WebBrowser.openAuthSessionAsync(hosted_link_url, 'financify://linked');
      await api('/api/sync/trigger', { method: 'POST', body: itemId ? { itemId } : {} });
      await accounts.refresh();
    } catch {
      Alert.alert('Couldn’t open Plaid', 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function syncNow() {
    setBusy('sync');
    try {
      const r = await api<{ queued: string[]; already_syncing: string[] }>('/api/sync/trigger', { method: 'POST', body: {} });
      Alert.alert('Sync started', `${r.queued.length + r.already_syncing.length} connection(s) syncing. Pull to refresh in a minute.`);
    } catch {
      Alert.alert('Couldn’t start sync', 'Please try again.');
    } finally {
      setBusy(null);
    }
  }

  function editAmount(field: keyof AppSettings, title: string, message: string, current: string | null) {
    Alert.prompt(
      title,
      message,
      async (text) => {
        const trimmed = text.trim();
        const n = Number(trimmed);
        const clearable = field === 'monthlyIncomeOverride' && trimmed === '';
        if (!clearable && (trimmed === '' || !Number.isFinite(n) || n < 0)) {
          Alert.alert('Enter an amount of $0 or more');
          return;
        }
        try {
          settings.setData(await api<AppSettings>('/api/settings', { method: 'PUT', body: { [field]: clearable ? null : n } }));
        } catch {
          Alert.alert('Couldn’t save', 'Please try again.');
        }
      },
      'plain-text',
      current ?? '',
      'decimal-pad',
    );
  }

  const confirmLogOut = () =>
    Alert.alert('Log out?', 'You’ll need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => void signOut() },
    ]);

  const s = settings.data;
  const income = s?.monthlyIncomeOverride;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: space(4), paddingBottom: space(10), gap: space(4) }}
      refreshControl={
        <RefreshControl
          refreshing={(accounts.loading && !!accounts.data) || (settings.loading && !!s)}
          onRefresh={() => {
            void accounts.refresh();
            void settings.refresh();
          }}
          tintColor={colors.textSubtle}
        />
      }
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Settings',
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <SectionHeader title="Accounts" />
      {accounts.error && !accounts.data ? (
        <ErrorState onRetry={accounts.refresh} />
      ) : !accounts.data ? (
        <Skeleton height={160} />
      ) : items.size === 0 ? (
        <EmptyState title="No linked accounts" body="Add an account to start tracking your money." />
      ) : (
        [...items].map(([itemId, accts]) => (
          <InstitutionCard
            key={itemId}
            accounts={accts}
            fixing={busy === itemId}
            onFix={() => void link(itemId, '/api/plaid/link/update', { itemId, platform: 'ios' }, itemId)}
          />
        ))
      )}
      <View style={{ gap: space(3) }}>
        <Button label="Add account" onPress={() => void link('add', '/api/plaid/link/start', { platform: 'ios' })} loading={busy === 'add'} />
        <Button label="Sync now" variant="secondary" onPress={() => void syncNow()} loading={busy === 'sync'} />
      </View>
      <ListRow title="Last synced" value={relativeTime(lastSynced ?? null)} />

      <SectionHeader title="Budget" />
      {settings.error && !s ? (
        <ErrorState onRetry={settings.refresh} />
      ) : (
        <Card style={{ paddingVertical: space(1) }}>
          <ListRow
            title="Monthly income"
            subtitle={income == null ? 'Calculated from your deposits' : 'Set manually'}
            value={!s ? '—' : income == null ? 'Auto' : money(Number(income))}
            chevron
            onPress={() =>
              s &&
              editAmount('monthlyIncomeOverride', 'Monthly income', 'Leave blank to calculate it from your deposits.', income ?? null)
            }
          />
          <Divider />
          <ListRow
            title="Monthly savings target"
            value={s ? money(Number(s.monthlySavingsTarget)) : '—'}
            chevron
            onPress={() =>
              s && editAmount('monthlySavingsTarget', 'Monthly savings target', 'How much you want to save each month.', s.monthlySavingsTarget)
            }
          />
        </Card>
      )}

      <SectionHeader title="App" />
      <Card style={{ paddingVertical: space(1) }}>
        <ListRow title="Version" value={Constants.expoConfig?.version ?? '—'} />
        <Divider />
        <ListRow title="Log out" onPress={confirmLogOut} />
      </Card>
    </ScrollView>
  );
}
