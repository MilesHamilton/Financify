import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronRight, Sparkles } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from '@/constants/theme';
import { parseDay } from '@/lib/format';

/** Entry point to last month's Wrapped-style recap (app/recap.tsx). */
export function RecapBanner({ today }: { today: string }) {
  const d = parseDay(today);
  const name = new Date(d.getFullYear(), d.getMonth() - 1, 1).toLocaleDateString('en-US', { month: 'long' });
  return (
    <Pressable
      onPress={() => router.push('/recap')}
      accessibilityRole="button"
      accessibilityLabel={`Open your ${name} recap`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <LinearGradient colors={['#1E40AF', '#6D28D9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View style={styles.icon}>
          <Sparkles size={20} color={colors.text} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.label}>Your {name} Recap is ready</Text>
          <Text style={[type.caption, { color: colors.textOnBand }]}>Top spots, habits and your spending persona</Text>
        </View>
        <ChevronRight size={20} color={colors.text} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space(3), padding: space(4), borderRadius: radius.md },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
