import type { Category } from '@contract';
import * as Haptics from 'expo-haptics';
import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Divider, PressableRow } from '@/components/ui';
import { colors, radius, space, type } from '@/constants/theme';

import { CategoryBadge } from './TransactionRow';

export type PickerOption = { id: string; label: string; leading?: ReactNode };

/** Bottom sheet with a single-choice list (category / account pickers). */
export function PickerSheet({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selected?: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space(4)) }]}>
        <View style={styles.grabber} />
        <Text style={[type.headingXXS, { marginBottom: space(2) }]}>{title}</Text>
        <ScrollView>
          {options.map((o, i) => (
            <View key={o.id}>
              {i > 0 ? <Divider /> : null}
              <PressableRow
                onPress={() => {
                  void Haptics.selectionAsync();
                  onSelect(o.id);
                  onClose();
                }}
                accessibilityLabel={`${o.label}${o.id === selected ? ', selected' : ''}`}
                style={styles.row}
              >
                {o.leading}
                <Text style={[type.label, { flex: 1 }]} numberOfLines={1}>
                  {o.label}
                </Text>
                {o.id === selected ? <Check size={18} color={colors.brand} /> : null}
              </PressableRow>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: colors.sheetScrim },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.card,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: space(4),
    paddingTop: space(2),
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.dragHandle,
    marginBottom: space(3),
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space(3), minHeight: 52 },
});

export const categoryOptions = (cats: Category[] | null): PickerOption[] =>
  (cats ?? []).map((c) => ({ id: c.id, label: c.label, leading: <CategoryBadge category={c} size={28} /> }));
