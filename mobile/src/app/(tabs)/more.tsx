import { router } from 'expo-router';
import { Settings, TrendingUp } from 'lucide-react-native';

import { Card, Divider, ListRow, Screen } from '@/components/ui';
import { colors, space } from '@/constants/theme';

export default function MoreScreen() {
  return (
    <Screen title="More">
      <Card style={{ paddingVertical: space(1) }}>
        <ListRow
          leading={<TrendingUp size={22} color={colors.text} />}
          title="Net Worth"
          chevron
          onPress={() => router.push('/net-worth')}
        />
        <Divider inset={34} />
        <ListRow
          leading={<Settings size={22} color={colors.text} />}
          title="Settings"
          chevron
          onPress={() => router.push('/settings')}
        />
      </Card>
    </Screen>
  );
}
