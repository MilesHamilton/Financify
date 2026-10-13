import type { CategoriesResponse, Txn } from '@contract';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { MerchantLogo } from '@/components/MerchantLogo';
import { CategoryBadge, PickerSheet, categoryOptions, txnAmount, txnTitle, useTxnStore } from '@/components/transactions';
import { Card, Divider, EmptyState, ListRow } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { dayLabel } from '@/lib/format';
import { useApi } from '@/lib/use-api';

export default function TransactionDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const txn = useTxnStore((s) => s.byId[id]);
  const update = useTxnStore((s) => s.update);
  const [note, setNote] = useState(txn?.note ?? '');
  const [picking, setPicking] = useState(false);
  const { data: categories } = useApi<CategoriesResponse>('/api/mobile/categories');

  useEffect(() => setNote(txn?.note ?? ''), [txn?.note]);

  /** Optimistic PATCH: apply locally, revert on failure. */
  async function save(local: Partial<Txn>, body: { categoryId?: string; isExcluded?: boolean; note?: string | null }) {
    if (!txn) return;
    const prev = Object.fromEntries(Object.keys(local).map((k) => [k, txn[k as keyof Txn]])) as Partial<Txn>;
    update(txn.id, local);
    try {
      await api(`/api/transactions/${txn.id}`, { method: 'PATCH', body });
    } catch {
      update(txn.id, prev);
      if ('note' in local) setNote(txn.note ?? '');
      Alert.alert("Couldn't save", 'Check your connection and try again.');
    }
  }

  const header = (
    <View style={styles.header}>
      <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
        <X size={24} color={colors.text} />
      </Pressable>
    </View>
  );

  if (!txn) {
    return (
      <View style={styles.screen}>
        <Stack.Screen options={{ presentation: 'modal' }} />
        {header}
        <EmptyState title="Transaction not found" body="Go back and open it from your transactions list." />
      </View>
    );
  }

  const title = txnTitle(txn);
  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ presentation: 'modal' }} />
      {header}
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <MerchantLogo uri={txn.logoUrl} name={title} size={56} />
          <Text style={[type.headingXL, txn.amount < 0 && { color: colors.success }]}>{txnAmount(txn)}</Text>
          <Text style={type.labelL}>{title}</Text>
          <Text style={[type.paragraph, { color: colors.textSubtle }]}>
            {dayLabel(txn.date)}
            {txn.pending ? ' · Pending' : ''}
          </Text>
        </View>

        <Card style={{ paddingVertical: space(1) }}>
          <ListRow title="Account" value={txn.accountName} />
          <Divider />
          <Pressable onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={`Category, ${txn.category.label}. Change`}>
            <ListRow leading={<CategoryBadge category={txn.category} size={28} />} title={txn.category.label} subtitle="Category" chevron />
          </Pressable>
        </Card>

        <Card style={{ gap: space(1) }}>
          <Text style={[type.labelS, { color: colors.textSubtle }]}>Note</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            onBlur={() => {
              const next = note.trim() || null;
              if (next !== txn.note) void save({ note: next }, { note: next });
            }}
            placeholder="Add a note"
            placeholderTextColor={colors.textDisabled}
            multiline
            style={[type.paragraphL, { minHeight: 44 }]}
            accessibilityLabel="Note"
          />
        </Card>

        <Card style={styles.ignore}>
          <View style={{ flex: 1 }}>
            <Text style={type.label}>Ignore</Text>
            <Text style={[type.caption, { color: colors.textSubtle }]}>Excluded from spending.</Text>
          </View>
          <Switch
            value={txn.isExcluded}
            onValueChange={(isExcluded) => void save({ isExcluded }, { isExcluded })}
            trackColor={{ true: colors.brand, false: colors.track }}
            accessibilityLabel="Ignore transaction"
          />
        </Card>
      </ScrollView>

      <PickerSheet
        visible={picking}
        title="Category"
        options={categoryOptions(categories)}
        selected={txn.category.id}
        onSelect={(categoryId) => {
          const category = categories?.find((c) => c.id === categoryId);
          if (category && categoryId !== txn.category.id) void save({ category }, { categoryId });
        }}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'flex-end', padding: space(4) },
  body: { paddingHorizontal: space(4), paddingBottom: space(10), gap: space(4) },
  hero: { alignItems: 'center', gap: space(1), paddingBottom: space(4) },
  ignore: { flexDirection: 'row', alignItems: 'center', gap: space(3) },
});
