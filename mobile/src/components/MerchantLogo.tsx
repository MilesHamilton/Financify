import { useRef, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import { avatarTints, colors } from '@/constants/theme';

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);

/**
 * Merchant logo in a ringed circle (polish #12): skeleton placeholder until
 * loaded, 150 ms fade-in, then `fallback` (e.g. CategoryIcon) on error. With
 * no fallback, a letter avatar tinted by a stable name hash.
 */
export function MerchantLogo({
  uri,
  name,
  size = 36,
  fallback,
}: {
  uri: string | null;
  name: string;
  size?: number;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri && !failed) {
    return (
      <View style={[box, { backgroundColor: colors.skeleton }]}>
        <Animated.Image
          source={{ uri }}
          resizeMode="cover"
          style={[box, styles.ring, { opacity }]}
          onLoad={() => Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start()}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }
  if (fallback) return <>{fallback}</>;
  return (
    <View style={[box, { backgroundColor: avatarTints[Math.abs(hash(name)) % avatarTints.length], alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: colors.text, fontSize: size * 0.42, fontWeight: '600' }}>{(name.trim()[0] ?? '?').toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.logoRing },
});
