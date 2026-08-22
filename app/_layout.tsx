import * as SplashScreen from 'expo-splash-screen';
import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

import { AnimatedSplash } from '@/components/animated-splash';
import { AppErrorBoundary } from '@/components/app-error-boundary';
import { Brand } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { InspectionProvider } from '@/context/inspection-context';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Native splash may already be hidden in some environments.
});

const SPLASH_MIN_MS = 1800;
const SPLASH_EXIT_MS = 400;

function AppShell() {
  const { isReady, token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [minTimeDone, setMinTimeDone] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setMinTimeDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady || !minTimeDone) {
      return;
    }

    setExiting(true);
    const timer = setTimeout(() => setShowSplash(false), SPLASH_EXIT_MS);
    return () => clearTimeout(timer);
  }, [isReady, minTimeDone]);

  useEffect(() => {
    if (!isReady || showSplash) {
      return;
    }

    const onLogin = pathname === '/login' || pathname === '/';
    if (!token && !onLogin) {
      router.replace('/login');
    }
    if (token && onLogin) {
      router.replace('/(tabs)/home');
    }
  }, [isReady, token, pathname, router, showSplash]);

  return (
    <View style={styles.root}>
      <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: Brand.ink }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="property" options={{ title: 'Property Details' }} />
        <Stack.Screen name="setup" options={{ title: 'Inspection Setup' }} />
        <Stack.Screen name="capture/[step]" options={{ headerShown: false, title: 'Field Capture' }} />
        <Stack.Screen name="review" options={{ title: 'Review & Quality Check' }} />
        <Stack.Screen name="report" options={{ title: 'Evidence Package' }} />
        <Stack.Screen name="inspection" options={{ title: 'Inspection Overview' }} />
        <Stack.Screen name="roof-inspection" options={{ title: 'Roof Inspection' }} />
        <Stack.Screen name="photos" options={{ title: 'Inspection Photos' }} />
        <Stack.Screen name="hail-test" options={{ title: 'Hail Test Square' }} />
        <Stack.Screen name="damage" options={{ title: 'Damage Assessment' }} />
        <Stack.Screen name="checklist" options={{ title: 'Collateral Checklist' }} />
        <Stack.Screen name="weather" options={{ title: 'Weather Verification' }} />
        <Stack.Screen name="summary" options={{ title: 'Inspection Summary' }} />
      </Stack>
      <StatusBar style="dark" />
      {showSplash ? <AnimatedSplash exiting={exiting} /> : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <AppErrorBoundary>
        <AuthProvider>
          <InspectionProvider>
            <AppShell />
          </InspectionProvider>
        </AuthProvider>
      </AppErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: Brand.background, flex: 1 },
});
