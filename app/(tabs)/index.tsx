import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={styles.content}>
        <ThemedText type="title">Camera App</ThemedText>
        <ThemedText style={styles.subtitle}>
          Open the camera, capture a photo, then save it to your gallery.
        </ThemedText>

        <Pressable style={styles.cameraButton} onPress={() => router.push('/camera')}>
          <ThemedText style={styles.cameraButtonText}>Open Camera</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.75,
    maxWidth: 280,
  },
  cameraButton: {
    marginTop: 12,
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
