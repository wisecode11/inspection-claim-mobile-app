import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAuth } from '@/context/auth-context';

export default function Index() {
  const { isReady, token } = useAuth();

  if (!isReady) {
    return (
      <View style={styles.screen}>
        <ActivityIndicator color="#E17035" size="large" />
      </View>
    );
  }

  return <Redirect href={token ? '/jobs' : '/login'} />;
}

const styles = StyleSheet.create({
  screen: { alignItems: 'center', backgroundColor: '#F4F7F8', flex: 1, justifyContent: 'center' },
});
