import {
  Merriweather_400Regular,
  Merriweather_500Medium,
  Merriweather_600SemiBold,
  Merriweather_700Bold,
  useFonts,
} from '@expo-google-fonts/merriweather';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync();

export function useAppFonts() {
  const [loaded, error] = useFonts({
    Merriweather_400Regular,
    Merriweather_500Medium,
    Merriweather_600SemiBold,
    Merriweather_700Bold,
  });

  useEffect(() => {
    if (!loaded && !error) {
      return;
    }

    void SplashScreen.hideAsync();
  }, [loaded, error]);

  return { loaded, error };
}
