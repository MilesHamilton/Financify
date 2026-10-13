import type { CategoriesResponse, SpendingResponse } from '@contract';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Fragment, useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { BackButton } from '@/components/spending/BackButton';
import { currentMonth } from '@/components/spending/month';
import { Button, Card, Divider, ErrorState, Screen, Skeleton } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { api } from '@/lib/api';
import { money, monthLabel } from '@/lib/format';
import { useApi } from '@/lib/use-api';

/** Budget editor sheet: one amount per expense category, saved via POST /api/budgets. */
export default function BudgetEditor() {
  const params = useLocalSearchParams<{ month?: string; categoryId?: string }>();
  const month = params.month ?? currentMonth();
  const cats = useApi<CategoriesResponse>('/api/mobile/categories');
  const spend = useApi<SpendingResponse>(`/api/mobile/spending?month=${month}`);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const current = new Map(spend.data?.categories.map((c) => [c.id, c]) ?? []);
  const list = (cats.data ?? []).filter((c) => (params.categoryId ? c.id === params.categoryId : c.group === 'expense'));

  useEffect(() => {
    if (!spend.data) return;
    setValues(
      Object.fromEntries(spend.data.categories.filter((c) => c.budget !== null).map((c) => [c.id, String(c.budget)])),
    );
  }, [spend.data]);

  const save = async () => {
    const changes = list.flatMap((c) => {
      const raw = values[c.id]?.trim();
      if (!raw) return [];
      const amount = Number(raw.replace(/[$,]/g, ''));
      return Number.isFinite(amount) && amount >= 0 && amount !== current.get(c.id)?.budget ? [{ id: c.id, amount }] : [];
    });
    setSaving(true);
    try {
      for (const c of changes) {
        await api('/api/budgets', {
          method: 'POST',
          body: { categoryId: c.id, amount: c.amount, effectiveMonth: `${month}-01` },
        });
      }
      router.back();
    } catch {
      Alert.alert('Couldn’t save budget', 'Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const failed = (cats.error && !cats.loading) || (spend.error && !spend.loading);

  return (
    <Screen title="Budget" left={<BackButton />}>
      <Stack.Screen options={{ presentation: 'modal' }} />
      <Text style={[type.labelS, { color: colors.textSubtle }]}>Monthly targets from {monthLabel(month)}</Text>
      {failed ? (
        <ErrorState onRetry={() => void Promise.all([cats.refresh(), spend.refresh()])} />
      ) : !cats.data || !spend.data ? (
        <Skeleton height={400} />
      ) : (
        <>
          <Card style={{ paddingVertical: space(1) }}>
            {list.map((c, i) => (
              <Fragment key={c.id}>
                {i > 0 ? <Divider inset={48} /> : null}
                <View style={styles.row}>
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={type.label}>{c.label}</Text>
                    <Text style={[type.caption, { color: colors.textSubtle }]}>
                      {money(current.get(c.id)?.spent ?? 0, true)} spent
                    </Text>
                  </View>
                  <TextInput
                    value={values[c.id] ?? ''}
                    onChangeText={(v) => setValues((s) => ({ ...s, [c.id]: v }))}
                    placeholder="$0"
                    placeholderTextColor={colors.textDisabled}
                    keyboardType="decimal-pad"
                    accessibilityLabel={`${c.label} budget`}
                    style={[type.label, styles.input]}
                  />
                </View>
              </Fragment>
            ))}
          </Card>
          <Button label="Save" onPress={save} loading={saving} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 64 },
  input: {
    minWidth: 96,
    textAlign: 'right',
    backgroundColor: colors.input,
    borderRadius: radius.sm,
    paddingHorizontal: space(3),
    paddingVertical: space(2),
  },
});
