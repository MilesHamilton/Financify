import type { AccountSummary } from '@contract';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Button, Card, Divider, ListRow } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { money } from '@/lib/format';

/** One linked Plaid item: institution name, status pill, its accounts, "Fix connection" when broken, and "Remove connection". */
export function InstitutionCard({
  accounts,
  onFix,
  fixing,
  onRemove,
  removing,
}: {
  accounts: AccountSummary[];
  onFix: () => void;
  fixing: boolean;
  onRemove: () => void;
  removing: boolean;
}) {
  const { institutionName, itemStatus } = accounts[0];
  const ok = itemStatus === 'active';
  return (
    <Card style={{ gap: space(2) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(2) }}>
        <Text style={[type.headingXXS, { flex: 1 }]} numberOfLines={1} accessibilityRole="header">
          {institutionName}
        </Text>
        <View
          style={{
            backgroundColor: ok ? colors.successFill : colors.warningFill,
            borderRadius: radius.round,
            paddingHorizontal: space(2.5),
            paddingVertical: space(0.5),
          }}
          accessibilityLabel={`Status: ${ok ? 'Connected' : 'Needs attention'}`}
        >
          <Text style={type.caption}>{ok ? 'Connected' : 'Needs attention'}</Text>
        </View>
      </View>
      {accounts.map((a, i) => (
        <View key={a.id}>
          {i > 0 ? <Divider /> : null}
          <ListRow title={a.name} subtitle={a.mask ? `••${a.mask}` : a.subtype ?? a.type} value={money(a.balance)} />
        </View>
      ))}
      {ok ? null : <Button label="Fix connection" onPress={onFix} loading={fixing} />}
      <Divider />
      <Pressable
        onPress={onRemove}
        disabled={removing}
        accessibilityRole="button"
        accessibilityLabel={`Remove ${institutionName} connection`}
        hitSlop={8}
        style={{ paddingVertical: space(2), alignItems: 'flex-start' }}
      >
        {({ pressed }) =>
          removing ? (
            <ActivityIndicator color={colors.warning} />
          ) : (
            <Text style={[type.labelS, { color: colors.warning, opacity: pressed ? 0.6 : 1 }]}>Remove connection</Text>
          )
        }
      </Pressable>
    </Card>
  );
}
