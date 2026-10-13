import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import * as Haptics from 'expo-haptics';
import { Banknote, LayoutGrid, Menu, Repeat, Search, type LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, type } from '@/constants/theme';

type BottomTabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const ICONS: Record<string, LucideIcon> = {
  index: LayoutGrid,
  recurring: Repeat,
  spending: Banknote,
  transactions: Search,
  more: Menu,
};

/** RM bottom bar: selected tab gets a 2px line above its icon; blue instead of RM's white. */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
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
            <Icon size={22} color={tint} strokeWidth={selected ? 2.25 : 1.75} />
            <Text style={[type.captionS, { color: tint, marginTop: 2 }]}>{label}</Text>
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.tabBarBorder,
  },
  tab: { flex: 1, alignItems: 'center', paddingBottom: 4 },
  indicator: { height: 2, width: 28, marginBottom: 8, backgroundColor: 'transparent' },
});
