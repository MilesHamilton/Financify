import type { AccountSummary } from '@contract';
import { Text, View } from 'react-native';

import { Button, Card, Divider, ListRow } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';
import { money } from '@/lib/format';

/** One linked Plaid item: institution name, status pill, its accounts, and "Fix connection" when broken. */
export function InstitutionCard({
  accounts,
  onFix,
  fixing,
}: {
  accounts: AccountSummary[];
  onFix: () => void;
  fixing: boolean;
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
    </Card>
  );
}
