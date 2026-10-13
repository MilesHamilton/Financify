import type { Txn } from '@contract';
import { SearchX } from 'lucide-react-native';
import type { ReactElement } from 'react';
import { RefreshControl, SectionList, View } from 'react-native';

import { Divider, EmptyState, SectionBand, SkeletonRow } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { dayLabel, money } from '@/lib/format';

import { openTxn, useFreshTxns } from './store';
import { TransactionRow } from './TransactionRow';

type Section = { title: string; total: number; data: Txn[] };

/** Groups date-sorted txns by day; total = non-ignored outflows. */
export function groupByDay(txns: Txn[]): Section[] {
  const sections: Section[] = [];
  for (const t of txns) {
    let s = sections[sections.length - 1];
    if (!s || s.title !== t.date) sections.push((s = { title: t.date, total: 0, data: [] }));
    s.data.push(t);
    if (t.amount > 0 && !t.isExcluded) s.total += t.amount;
  }
  return sections;
}

/** Day-sectioned transaction list with pull-to-refresh and infinite scroll. */
export function TransactionList({
  txns,
  refreshing = false,
  onRefresh,
  onEndReached,
  loadingMore = false,
  header,
  empty,
}: {
  txns: Txn[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
  header?: ReactElement;
  empty?: ReactElement;
}) {
  const sections = groupByDay(useFreshTxns(txns));
  return (
    <SectionList
      sections={sections}
      keyExtractor={(t) => t.id}
      renderItem={({ item }) => <TransactionRow txn={item} onPress={() => openTxn(item)} />}
      ItemSeparatorComponent={() => <Divider inset={48} />}
      renderSectionHeader={({ section }) => (
        <View style={{ paddingTop: space(3), backgroundColor: colors.bg }}>
          <SectionBand title={dayLabel(section.title)} detail={`${money(section.total)} total spend`} />
        </View>
      )}
      ListHeaderComponent={header}
      ListEmptyComponent={empty ?? <EmptyState icon={SearchX} title="No transactions found" body="Try a different search or clear a filter." />}
      ListFooterComponent={
        loadingMore ? (
          <View style={{ gap: space(4), paddingVertical: space(4) }}>
            <SkeletonRow />
            <SkeletonRow />
          </View>
        ) : null
      }
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textSubtle} /> : undefined
      }
      contentContainerStyle={{ paddingHorizontal: space(4), paddingBottom: space(10) }}
      stickySectionHeadersEnabled
      keyboardDismissMode="on-drag"
    />
  );
}
