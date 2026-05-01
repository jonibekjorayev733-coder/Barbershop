import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/context/AuthContext';
import { setupNotificationChannels, requestNotificationPermission } from '@/services/NotificationService';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    setupNotificationChannels();
    requestNotificationPermission();

    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      notificationListener.current?.remove();
      responseListener.current?.remove();
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

  return (
    <AuthProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="user" />
          <Stack.Screen name="barber" />
          <Stack.Screen name="admin" />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </AuthProvider>
  );
}
