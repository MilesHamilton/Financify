import type { RecurringResponse, RecurringStream } from '@contract';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { KIND_SECTIONS, RecurringCalendar, RecurringRow, dueLabel, monthlyAmount } from '@/components/recurring';
import { Card, Divider, EmptyState, ErrorState, Screen, Segmented, Skeleton } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { daysBetween, money } from '@/lib/format';
import { useApi } from '@/lib/use-api';

type Tab = 'upcoming' | 'all';
const TABS = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'all', label: 'All' },
] as const;

export default function RecurringScreen() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { data, error, loading, refresh } = useApi<RecurringResponse>('/api/mobile/recurring');

  let body;
  if (!data && loading) body = [180, 320, 64, 64].map((h, i) => <Skeleton key={i} height={h} />);
  else if (!data) body = error ? <ErrorState onRetry={refresh} /> : null;
  else body = tab === 'upcoming' ? <Upcoming {...data} /> : <All streams={data.streams} />;

  return (
    <Screen title="Recurring" refreshing={loading && !!data} onRefresh={refresh}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {body}
    </Screen>
  );
}

function Upcoming({ today, streams }: RecurringResponse) {
  const upcoming = streams
    .filter((s) => s.isActive && s.nextDate && s.nextDate >= today)
    .sort((a, b) => a.nextDate!.localeCompare(b.nextDate!));
  const dueSoon = upcoming.filter((s) => s.direction === 'outflow' && daysBetween(today, s.nextDate!) <= 7).length;

  return (
    <>
      <Text style={[type.paragraphL, { color: colors.textSubtle }]}>
        {dueSoon
          ? `You have ${dueSoon} recurring charge${dueSoon === 1 ? '' : 's'} due in the next 7 days`
          : 'You do not have any recurring charges within the next 7 days.'}
      </Text>
      <RecurringCalendar today={today} streams={streams} />
      {upcoming.length ? (
        <Rows streams={upcoming} due={(s) => dueLabel(today, s.nextDate!)} />
      ) : (
        <EmptyState title="Nothing upcoming" body="Recurring charges appear here once we spot a pattern." />
      )}
    </>
  );
}

function All({ streams }: { streams: RecurringStream[] }) {
  if (!streams.length) return <EmptyState title="No recurring charges yet" body="We'll list them once we spot a pattern." />;
  return KIND_SECTIONS.map(({ kind, title }) => {
    const items = streams.filter((s) => (s.isActive ? s.kind : 'inactive') === kind);
    if (!items.length) return null;
    const total = items.reduce((sum, s) => sum + monthlyAmount(s), 0);
    return (
      <View key={kind} style={{ gap: space(2) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: space(2) }}>
          <Text style={[type.tracked, { color: colors.textSubtle }]}>{title}</Text>
          <Text style={[type.labelS, { color: colors.textSubtle }]} accessibilityLabel={`${money(total)} per month`}>
            {money(total)}/mo
          </Text>
        </View>
        <Rows streams={items} />
      </View>
    );
  });
}

function Rows({ streams, due }: { streams: RecurringStream[]; due?: (s: RecurringStream) => string }) {
  return (
    <Card style={{ paddingVertical: space(1) }}>
      {streams.map((s, i) => (
        <View key={s.id}>
          {i > 0 ? <Divider inset={48} /> : null}
          <RecurringRow stream={s} due={due?.(s)} />
        </View>
      ))}
    </Card>
  );
}
