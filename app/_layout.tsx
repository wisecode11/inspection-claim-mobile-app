import { Stack, usePathname, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import 'react-native-reanimated';

import { AppErrorBoundary } from '@/components/app-error-boundary';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { InspectionProvider } from '@/context/inspection-context';

function AppShell() {
  const { isReady, token } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) {
      return;
    }

    const onLogin = pathname === '/login' || pathname === '/';
    if (!token && !onLogin) {
      router.replace('/login');
    }
  }, [isReady, token, pathname, router]);

  if (!isReady) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator color="#E17035" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShadowVisible: false, headerTintColor: '#163A4A' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="jobs" options={{ headerShown: false }} />
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
    </>
  );
}

export default function RootLayout() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <InspectionProvider>
          <AppShell />
        </InspectionProvider>
      </AuthProvider>
    </AppErrorBoundary>
  );
}

const styles = StyleSheet.create({
  boot: { alignItems: 'center', backgroundColor: '#F4F7F8', flex: 1, justifyContent: 'center' },
});
