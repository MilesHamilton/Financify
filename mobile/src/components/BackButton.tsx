import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { colors } from '@/constants/theme';

export function BackButton() {
  return (
    <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12}>
      <ChevronLeft size={26} color={colors.text} />
    </Pressable>
  );
}
