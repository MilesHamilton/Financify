import { Redirect, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Toast } from '@/components/Toast';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/lib/auth-store';

void SplashScreen.preventAutoHideAsync().catch(() => {});

/** Native form sheet (polish #16): grabber, 24 pt top radius, card fill. */
const SHEET = {
  presentation: 'formSheet',
  sheetGrabberVisible: true,
  sheetCornerRadius: 24,
  contentStyle: { backgroundColor: colors.card },
} as const;

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const hydrate = useAuthStore((s) => s.hydrate);
  const segments = useSegments();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (status !== 'loading') void SplashScreen.hideAsync().catch(() => {});
  }, [status]);

  if (status === 'loading') return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const inAuth = segments[0] === '(auth)';
  if (status === 'signedOut' && !inAuth) return <Redirect href="/login" />;
  if (status === 'signedIn' && inAuth) return <Redirect href="/" />;

  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="transaction/[id]" options={{ ...SHEET, sheetAllowedDetents: [1] }} />
        <Stack.Screen name="spending/budget" options={{ presentation: 'modal' }} />
        <Stack.Screen name="daily-spend/day" options={{ ...SHEET, sheetAllowedDetents: [0.7, 1], sheetInitialDetentIndex: 0 }} />
        <Stack.Screen name="daily-spend/goal" options={{ ...SHEET, sheetAllowedDetents: [1] }} />
      </Stack>
      <Toast />
    </>
  );
}
