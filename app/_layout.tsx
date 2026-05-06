import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { Platform, StyleSheet, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { DisplayModeProvider, useDisplayMode } from '@/context/DisplayModeContext';
import RealtimeNotificationBridge from '@/components/system/RealtimeNotificationBridge';
import { registerNotificationListeners, setupNotificationChannels, requestNotificationPermission } from '@/services/NotificationService';

export default function RootLayout() {
  return (
    <DisplayModeProvider>
      <RootLayoutInner />
    </DisplayModeProvider>
  );
}

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const { effectiveScheme, brightnessShift } = useDisplayMode();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    let cleanupListeners: (() => void) | null = null;

    void (async () => {
      await setupNotificationChannels();
      await requestNotificationPermission();
      const cleanup = await registerNotificationListeners();

      if (cancelled) {
        cleanup();
        return;
      }

      cleanupListeners = cleanup;
    })();

    return () => {
      cancelled = true;
      cleanupListeners?.();
    };
  }, []);

  useEffect(() => {
    const suppressKeepAwakeRejection = (event: unknown) => {
      const payload = event as { reason?: unknown; preventDefault?: () => void };
      const reason = payload?.reason;
      const message = typeof reason === 'string'
        ? reason
        : reason instanceof Error
          ? reason.message
          : '';

      if (message.includes('Unable to activate keep awake')) {
        payload?.preventDefault?.();
      }
    };

    if (typeof globalThis.addEventListener === 'function') {
      globalThis.addEventListener('unhandledrejection', suppressKeepAwakeRejection as EventListener);
      return () => {
        globalThis.removeEventListener?.('unhandledrejection', suppressKeepAwakeRejection as EventListener);
      };
    }

    return () => undefined;
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const activeElement = (globalThis as { document?: { activeElement?: { blur?: () => void } } })?.document?.activeElement;
    activeElement?.blur?.();
  }, [pathname]);

  return (
    <AuthProvider>
      <LanguageProvider>
        <RealtimeNotificationBridge />
        <ThemeProvider value={(effectiveScheme ?? colorScheme) === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="user" />
            <Stack.Screen name="barber" />
            <Stack.Screen name="admin" />
          </Stack>
          <StatusBar style={(effectiveScheme ?? colorScheme) === 'dark' ? 'light' : 'dark'} />
          {brightnessShift !== 0 ? (
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: brightnessShift > 0 ? '#ffffff' : '#000000',
                  opacity: Math.min(0.35, Math.abs(brightnessShift)),
                },
              ]}
            />
          ) : null}
        </ThemeProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}
