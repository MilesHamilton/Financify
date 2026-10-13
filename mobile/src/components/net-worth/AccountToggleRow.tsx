import type { AccountSummary } from '@contract';
import * as Haptics from 'expo-haptics';
import { Switch, Text, View } from 'react-native';

import { colors, space, type } from '@/constants/theme';
import { money } from '@/lib/format';

/** Account row with RM's "Include in Net Worth" switch (on = included). */
export function AccountToggleRow({
  account,
  onToggle,
}: {
  account: AccountSummary;
  onToggle: (include: boolean) => void;
}) {
  const include = !account.isHidden;
  const sub = [account.institutionName, account.mask ? `••${account.mask}` : null].filter(Boolean).join(' ');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 56, paddingVertical: space(2) }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.label, !include && { color: colors.textIgnored }]} numberOfLines={1}>
          {account.name}
        </Text>
        <Text style={[type.caption, { color: colors.textSubtle }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Text style={[type.label, { fontVariant: ['tabular-nums'] }, !include && { color: colors.textIgnored }]}>{money(account.balance)}</Text>
      <Switch
        value={include}
        onValueChange={(v) => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(v);
        }}
        trackColor={{ false: colors.track, true: colors.brand }}
        ios_backgroundColor={colors.track}
        accessibilityLabel={`Include ${account.name} in net worth`}
        accessibilityHint="Toggle off to hide from net worth charts and calculations."
      />
    </View>
  );
}
