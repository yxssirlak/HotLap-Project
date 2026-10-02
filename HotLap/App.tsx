import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Session } from '@supabase/supabase-js';
import { supabase } from './src/lib/supabase';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Michroma_400Regular } from '@expo-google-fonts/michroma';
import { Manrope_400Regular, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { SpaceGrotesk_400Regular, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { Inter_400Regular, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { Syne_400Regular, Syne_700Bold } from '@expo-google-fonts/syne';
import { Outfit_400Regular, Outfit_600SemiBold } from '@expo-google-fonts/outfit';
import { Exo2_400Regular, Exo2_700Bold } from '@expo-google-fonts/exo-2';
import { ChakraPetch_400Regular, ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';

import AppNavigator from './src/navigation/AppNavigator';
import LoginScreen from './src/screens/LoginScreen';

SplashScreen.preventAutoHideAsync();

export default function App() {
  const [session, setSession] = useState<Session | null>(null);

  const [fontsLoaded, fontError] = useFonts({
    'Michroma': Michroma_400Regular,
    'Manrope': Manrope_400Regular,
    'Manrope-Bold': Manrope_700Bold,
    'SpaceGrotesk': SpaceGrotesk_700Bold,
    'Inter': Inter_400Regular,
    'Syne': Syne_700Bold,
    'Outfit': Outfit_400Regular,
    'Exo2': Exo2_700Bold,
    'ChakraPetch': ChakraPetch_700Bold,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN') {
        // Wacht 2 seconden zodat de Login animatie kan afspelen!
        setTimeout(() => setSession(session), 2000);
      } else {
        setSession(session);
      }
    });
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      {session && session.user ? <AppNavigator /> : <LoginScreen />}
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}