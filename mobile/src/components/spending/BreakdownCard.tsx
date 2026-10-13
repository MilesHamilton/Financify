import type { SpendingResponse } from '@contract';
import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CategoryIcon } from '@/components/CategoryIcon';
import { MerchantLogo } from '@/components/MerchantLogo';
import { Card, Divider, EmptyState, ListRow, ProgressBar, Segmented } from '@/components/ui';
import { colors, space, type } from '@/constants/theme';
import { money } from '@/lib/format';

type Tab = 'categories' | 'merchants';
const TABS = [
  { value: 'categories', label: 'Categories' },
  { value: 'merchants', label: 'Merchants' },
] as const;

export function BreakdownCard({ data }: { data: SpendingResponse }) {
  const [tab, setTab] = useState<Tab>('categories');
  const categories = [...data.categories].sort((a, b) => b.spent - a.spent);
  const merchants = [...data.merchants].sort((a, b) => b.spent - a.spent);

  return (
    <Card style={{ gap: space(2) }}>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === 'categories' ? (
        categories.length ? (
          categories.map((c, i) => {
            const over = c.budget !== null && c.spent > c.budget;
            return (
              <Fragment key={c.id}>
                {i > 0 ? <Divider inset={48} /> : null}
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/spending/[categoryId]', params: { categoryId: c.id, month: data.month, label: c.label } })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${c.label}, ${money(c.spent)} spent`}
                  style={styles.row}
                >
                  <CategoryIcon icon={c.icon} color={c.color} />
                  <View style={{ flex: 1, gap: space(1.5) }}>
                    <View style={styles.line}>
                      <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
                        {c.label}
                      </Text>
                      <Text style={type.label}>{money(c.spent, true)}</Text>
                    </View>
                    {c.budget !== null ? (
                      <>
                        <ProgressBar value={c.spent} max={c.budget} />
                        <Text style={[type.caption, { color: over ? colors.warning : colors.textSubtle }]}>
                          {money(Math.abs(c.budget - c.spent), true)} {over ? 'Over Budget' : 'Left to Spend'}
                        </Text>
                      </>
                    ) : null}
                  </View>
                </Pressable>
              </Fragment>
            );
          })
        ) : (
          <EmptyState title="No spending yet" />
        )
      ) : merchants.length ? (
        merchants.map((m, i) => (
          <Fragment key={m.name}>
            {i > 0 ? <Divider inset={48} /> : null}
            <ListRow
              leading={<MerchantLogo uri={m.logoUrl} name={m.name} />}
              title={m.name}
              subtitle={`${m.count} transaction${m.count === 1 ? '' : 's'}`}
              value={money(m.spent)}
            />
          </Fragment>
        ))
      ) : (
        <EmptyState title="No merchants yet" />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), paddingVertical: space(3) },
  line: { flexDirection: 'row', alignItems: 'center', gap: space(2) },
});
