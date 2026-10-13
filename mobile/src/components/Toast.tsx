import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space, type } from '@/constants/theme';
import { useToast } from '@/lib/toast';

/** Bottom toast: fades in, holds 2.4 s, fades out. */
export function Toast() {
  const { message, id } = useToast();
  const insets = useSafeAreaInsets();
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!message) return;
    o.setValue(0);
    const run = Animated.sequence([
      Animated.timing(o, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2400),
      Animated.timing(o, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [id, message, o]);
  if (!message) return null;
  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom: insets.bottom + 72, opacity: o }]}
    >
      <Text style={[type.labelS, { color: colors.textInverse }]}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: space(4),
    paddingVertical: space(2.5),
    borderRadius: radius.round,
    backgroundColor: colors.text,
  },
});
