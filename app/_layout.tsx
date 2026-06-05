import { useEffect } from 'react';
import * as Linking from 'expo-linking';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { useAppFonts } from '@/hooks/useAppFonts';
import { AuthProvider } from '@/contexts/AuthContext';
import { ConfigProvider } from '@/contexts/ConfigContext';
import { handleSupabaseAuthUrl, looksLikeSupabaseAuthCallback } from '@/lib/authDeepLink';

export default function RootLayout() {
  useFrameworkReady();
  const { loaded: fontsLoaded } = useAppFonts();

  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!looksLikeSupabaseAuthCallback(url)) return;
      void handleSupabaseAuthUrl(url);
    });

    Linking.getInitialURL().then((url) => {
      if (!url || !looksLikeSupabaseAuthCallback(url)) return;
      void handleSupabaseAuthUrl(url);
    });

    return () => subscription.remove();
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <ConfigProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="+not-found" />
        </Stack>
        <StatusBar style="auto" />
      </ConfigProvider>
    </AuthProvider>
  );
}
