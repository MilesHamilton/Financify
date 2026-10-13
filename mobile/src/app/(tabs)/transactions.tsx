import type { CategoriesResponse, TransactionsResponse, Txn } from '@contract';
import { useLocalSearchParams } from 'expo-router';
import { ChevronDown, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { PickerSheet, TransactionList, categoryOptions, useTxnStore } from '@/components/transactions';
import { ErrorState, Screen, Skeleton } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { monthLabel } from '@/lib/format';
import { useApi } from '@/lib/use-api';

type Filters = { q: string; category: string; account: string; month: string };
type Status = 'loading' | 'refreshing' | 'more' | 'idle' | 'error';

const str = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default function TransactionsScreen() {
  const params = useLocalSearchParams<{ q?: string; category?: string; account?: string; month?: string }>();
  const [filters, setFilters] = useState<Filters>({
    q: str(params.q),
    category: str(params.category),
    account: str(params.account),
    month: str(params.month),
  });
  const [search, setSearch] = useState(filters.q);
  const [picker, setPicker] = useState<'category' | 'account' | null>(null);

  // Deep links (router.push with params) replace the current filters.
  useEffect(() => {
    const next = { q: str(params.q), category: str(params.category), account: str(params.account), month: str(params.month) };
    setFilters(next);
    setSearch(next.q);
  }, [params.q, params.category, params.account, params.month]);

  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() })), 300);
    return () => clearTimeout(t);
  }, [search]);

  const query = useMemo(
    () =>
      (Object.entries(filters) as [keyof Filters, string][])
        .filter(([, v]) => v)
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&'),
    [filters],
  );

  const [items, setItems] = useState<Txn[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const reqId = useRef(0);
  const put = useTxnStore((s) => s.put);

  const fetchPage = useCallback(
    async (after: string | null, mode: Status) => {
      const id = ++reqId.current;
      setStatus(mode);
      try {
        const cur = after ? `${query ? '&' : ''}cursor=${encodeURIComponent(after)}` : '';
        const res = await api<TransactionsResponse>(`/api/mobile/transactions?${query}${cur}`);
        if (id !== reqId.current) return;
        put(res.transactions);
        setItems((prev) => (after ? [...prev, ...res.transactions] : res.transactions));
        setCursor(res.nextCursor);
        setStatus('idle');
      } catch {
        // A failed next page leaves the list as-is; scrolling again retries.
        if (id === reqId.current) setStatus(after ? 'idle' : 'error');
      }
    },
    [query, put],
  );

  useEffect(() => {
    setItems([]);
    void fetchPage(null, 'loading');
  }, [fetchPage]);

  const { data: categories } = useApi<CategoriesResponse>('/api/mobile/categories');
  const accounts = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of items) m.set(t.accountId, t.accountName);
    return [...m].map(([id, label]) => ({ id, label }));
  }, [items]);

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const categoryLabel = categories?.find((c) => c.id === filters.category)?.label ?? 'Category';
  const accountLabel = accounts.find((a) => a.id === filters.account)?.label ?? 'Account';

  let body;
  if (status === 'loading' && items.length === 0) {
    body = (
      <View style={{ padding: space(4), gap: space(3) }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} height={48} />
        ))}
      </View>
    );
  } else if (status === 'error' && items.length === 0) {
    body = <ErrorState onRetry={() => void fetchPage(null, 'loading')} />;
  } else {
    body = (
      <TransactionList
        txns={items}
        refreshing={status === 'refreshing'}
        onRefresh={() => void fetchPage(null, 'refreshing')}
        loadingMore={status === 'more'}
        onEndReached={() => {
          if (cursor && status === 'idle') void fetchPage(cursor, 'more');
        }}
      />
    );
  }

  return (
    <Screen title="Transactions" scroll={false}>
      <View style={styles.search}>
        <Search size={18} color={colors.textSubtle} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search my transactions"
          placeholderTextColor={colors.textSubtle}
          style={[type.paragraphL, { flex: 1, paddingVertical: space(2.5) }]}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
          accessibilityLabel="Search my transactions"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        <Chip
          label={filters.category ? categoryLabel : 'Category'}
          active={!!filters.category}
          onPress={() => setPicker('category')}
          onClear={() => set({ category: '' })}
        />
        <Chip
          label={filters.account ? accountLabel : 'Account'}
          active={!!filters.account}
          onPress={() => setPicker('account')}
          onClear={() => set({ account: '' })}
        />
        {filters.month ? <Chip label={monthLabel(filters.month)} active onClear={() => set({ month: '' })} /> : null}
      </ScrollView>
      {body}
      <PickerSheet
        visible={picker === 'category'}
        title="Category"
        options={categoryOptions(categories)}
        selected={filters.category}
        onSelect={(category) => set({ category })}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'account'}
        title="Account"
        options={accounts}
        selected={filters.account}
        onSelect={(account) => set({ account })}
        onClose={() => setPicker(null)}
      />
    </Screen>
  );
}

/** Filter chip (RM AppliedFiltersChip). Active chips get a clear button. */
function Chip({ label, active, onPress, onClear }: { label: string; active: boolean; onPress?: () => void; onClear: () => void }) {
  return (
    <View style={[styles.chip, active && { backgroundColor: colors.brandFill, borderColor: colors.brandFill }]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`Filter by ${label}`}
        style={styles.chipLabel}
      >
        <Text style={type.labelS}>{label}</Text>
        {!active && onPress ? <ChevronDown size={14} color={colors.text} /> : null}
      </Pressable>
      {active ? (
        <Pressable onPress={onClear} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Clear ${label} filter`}>
          <X size={14} color={colors.text} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(2),
    marginHorizontal: space(4),
    paddingHorizontal: space(3),
    backgroundColor: colors.input,
    borderRadius: radius.md,
  },
  chips: { gap: space(2), paddingHorizontal: space(4), paddingVertical: space(3) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space(1.5),
    paddingHorizontal: space(3),
    paddingVertical: space(1.5),
    borderRadius: radius.round,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLabel: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
});
