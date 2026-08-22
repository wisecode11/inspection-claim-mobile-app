import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function Index() {
  const { isReady, token } = useAuth();

  if (!isReady) {
    return (
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <ActivityIndicator color={Brand.accent} size="large" />
      </SafeAreaView>
    );
  }

  return <Redirect href={token ? '/(tabs)/home' : '/login'} />;
}

const styles = StyleSheet.create({
  screen: {
    alignItems: 'center',
    backgroundColor: Brand.background,
    flex: 1,
    justifyContent: 'center',
  },
});
