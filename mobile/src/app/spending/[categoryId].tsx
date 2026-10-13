import type { TransactionsResponse } from '@contract';
import { router, useLocalSearchParams } from 'expo-router';
import { Fragment } from 'react';
import { Text } from 'react-native';

import { openTxn, TransactionRow } from '@/components/transactions';
import { BackButton } from '@/components/BackButton';
import { Receipt } from 'lucide-react-native';

import { Button, Card, Divider, EmptyState, ErrorState, Money, Screen, Skeleton, SkeletonCard } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { monthLabel } from '@/lib/format';
import { useApi } from '@/lib/use-api';

export default function CategoryDetail() {
  const { categoryId, month, label } = useLocalSearchParams<{ categoryId: string; month: string; label?: string }>();
  // shortcut: first page only (nextCursor ignored); add paging if a category-month exceeds one page.
  const { data, error, loading, refresh } = useApi<TransactionsResponse>(
    `/api/mobile/transactions?category=${encodeURIComponent(categoryId)}&month=${month}`,
  );
  const txns = data?.transactions ?? [];
  const total = txns.filter((t) => !t.isExcluded).reduce((s, t) => s + t.amount, 0);

  return (
    <Screen title={label ?? 'Category'} left={<BackButton />} refreshing={loading && !!data} onRefresh={refresh}>
      <Text style={[type.labelS, { color: colors.textSubtle }]}>{monthLabel(month)}</Text>
      {!data ? (
        error && !loading ? (
          <ErrorState onRetry={refresh} />
        ) : (
          <>
            <Skeleton height={40} width={140} />
            <SkeletonCard rows={5} heading={false} />
          </>
        )
      ) : (
        <>
          <Money value={total} size="l" countUp={400} />
          <Card style={{ paddingVertical: space(1) }}>
            {txns.length ? (
              txns.map((t, i) => (
                <Fragment key={t.id}>
                  {i > 0 ? <Divider inset={48} /> : null}
                  <TransactionRow txn={t} onPress={() => openTxn(t)} showDate />
                </Fragment>
              ))
            ) : (
              <EmptyState icon={Receipt} title="No transactions" body="Nothing in this category this month." />
            )}
          </Card>
          <Button
            label="Edit budget"
            variant="secondary"
            onPress={() => router.push({ pathname: '/spending/budget', params: { month, categoryId } })}
          />
        </>
      )}
    </Screen>
  );
}
