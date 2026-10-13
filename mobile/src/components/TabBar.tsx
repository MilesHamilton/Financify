import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import * as Haptics from 'expo-haptics';
import { LayoutGrid, Menu, Repeat, Search, Wallet, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, LucideIcon> = {
  index: LayoutGrid,
  recurring: Repeat,
  spending: Wallet,
  transactions: Search,
  more: Menu,
};

/** RM bottom bar (polish #0): 24×3 indicator above the selected icon; blue instead of RM's white. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const selected = state.index === index;
        const Icon = ICONS[route.name] ?? LayoutGrid;
        const label = descriptors[route.key].options.title ?? route.name;
        const tint = selected ? colors.brand : colors.tabInactive;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={label}
            style={styles.tab}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!selected && !event.defaultPrevented) {
                void Haptics.selectionAsync();
                navigation.navigate(route.name);
              }
            }}
          >
            <View style={[styles.indicator, selected && { backgroundColor: colors.brand }]} />
            <Icon size={24} color={tint} strokeWidth={selected ? 2.25 : 1.75} />
            <Text style={[styles.label, { color: tint }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: colors.tabBarBorder,
  },
  tab: { flex: 1, height: 52, alignItems: 'center', gap: 3 },
  indicator: {
    width: 24,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
    backgroundColor: 'transparent',
    marginBottom: 2,
  },
  label: { fontSize: 10, lineHeight: 12, fontWeight: '500' },
});
