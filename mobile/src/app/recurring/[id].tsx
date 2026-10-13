import type { RecurringDetailResponse } from '@contract';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';

import { MerchantLogo } from '@/components/MerchantLogo';
import { FREQ_LABEL, HistoryBarChart } from '@/components/recurring';
import { TransactionRow, openTxn, useFreshTxns } from '@/components/transactions';
import { Card, Divider, EmptyState, ErrorState, Screen, SectionHeader, Skeleton, SkeletonCard } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { money, shortDate } from '@/lib/format';
import { useApi } from '@/lib/use-api';

export default function RecurringDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading, refresh } = useApi<RecurringDetailResponse>(`/api/mobile/recurring/${encodeURIComponent(id)}`);
  const history = useFreshTxns(data?.history ?? []);

  const back = (
    <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back">
      <ChevronLeft size={28} color={colors.text} />
    </Pressable>
  );

  if (!data) {
    return (
      <Screen left={back}>
        {loading ? (
          <>
            <View style={{ alignItems: 'center', gap: space(2) }}>
              <Skeleton height={64} width={64} round />
              <Skeleton height={24} width={140} />
              <Skeleton height={40} width={120} />
            </View>
            <Skeleton height={140} />
            <SkeletonCard rows={3} heading={false} />
          </>
        ) : error ? (
          <ErrorState onRetry={refresh} />
        ) : null}
      </Screen>
    );
  }

  const { stream } = data;
  const income = stream.direction === 'inflow';
  return (
    <Screen left={back} refreshing={loading} onRefresh={refresh}>
      <View style={{ alignItems: 'center', gap: space(1) }}>
        <MerchantLogo uri={stream.logoUrl} name={stream.name} size={64} />
        <Text style={type.headingXS}>{stream.name}</Text>
        <Text style={[type.headingXL, { fontVariant: ['tabular-nums'] }, income && { color: colors.success }]}>
          {income ? '+' : ''}
          {money(stream.amount)}
        </Text>
        <Text style={[type.paragraph, { color: colors.textSubtle }]}>
          {FREQ_LABEL[stream.frequency]}
          {stream.isActive && stream.nextDate ? ` · Next ${shortDate(stream.nextDate)}` : stream.isActive ? '' : ' · Inactive'}
        </Text>
      </View>

      {history.length ? (
        <Card>
          <HistoryBarChart history={history} />
        </Card>
      ) : null}

      <SectionHeader title="Past charges" />
      {history.length ? (
        <Card style={{ paddingVertical: space(1) }}>
          {history.map((t, i) => (
            <View key={t.id}>
              {i > 0 ? <Divider inset={48} /> : null}
              <TransactionRow txn={t} onPress={() => openTxn(t)} showDate />
            </View>
          ))}
        </Card>
      ) : (
        <EmptyState title="No past charges" />
      )}
    </Screen>
  );
}
