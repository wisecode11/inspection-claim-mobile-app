import Constants, { ExecutionEnvironment } from 'expo-constants';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';

// Expo Go on Android rejects any photo/video media-library permission call, but writing a new
// asset still works there, so the permission step is skipped instead of blocking the save.
const skipMediaPermissions =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

async function ensureGalleryPermission() {
  if (skipMediaPermissions) return true;

  try {
    const current = await MediaLibrary.getPermissionsAsync(true, ['photo']);
    if (current.granted) return true;
    if (!current.canAskAgain) return false;

    const requested = await MediaLibrary.requestPermissionsAsync(true, ['photo']);
    return requested.granted;
  } catch {
    return true;
  }
}

export default function CameraScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraView>(null);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const takePicture = async () => {
    if (!cameraRef.current || isCapturing) return;

    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission required', 'Camera access is needed to take photos.');
        return;
      }
    }

    try {
      setIsCapturing(true);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });
      if (photo?.uri) {
        setPhotoUri(photo.uri);
      }
    } catch {
      Alert.alert('Error', 'Could not capture photo. Please try again.');
    } finally {
      setIsCapturing(false);
    }
  };

  const saveToGallery = async () => {
    if (!photoUri || isSaving) return;

    try {
      setIsSaving(true);

      const allowed = await ensureGalleryPermission();
      if (!allowed) {
        Alert.alert('Permission required', 'Gallery access is needed to save photos.');
        return;
      }

      await MediaLibrary.saveToLibraryAsync(photoUri);
      Alert.alert('Saved', 'Photo saved to your gallery.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert(
        'Could not save',
        skipMediaPermissions
          ? 'Saving to the gallery is limited in Expo Go. Try a development build for full access.'
          : 'Could not save photo to gallery.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!cameraPermission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }

  if (!cameraPermission.granted) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.permissionTitle}>Camera access needed</Text>
        <Text style={styles.permissionText}>Allow camera permission to take photos.</Text>
        <Pressable style={styles.primaryButton} onPress={requestCameraPermission}>
          <Text style={styles.primaryButtonText}>Grant permission</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (photoUri) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Image source={{ uri: photoUri }} style={styles.preview} />
        <View style={[styles.previewActions, { paddingBottom: insets.bottom + 16 }]}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setPhotoUri(null)}
            disabled={isSaving}>
            <Text style={styles.secondaryButtonText}>Retake</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, isSaving && styles.buttonDisabled]}
            onPress={saveToGallery}
            disabled={isSaving}>
            {isSaving ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={styles.primaryButtonText}>Save to Gallery</Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="picture" />

      <View style={[styles.overlay, styles.topBar, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Pressable style={styles.chip} onPress={() => router.back()}>
          <Text style={styles.chipText}>Close</Text>
        </Pressable>
        <Pressable
          style={styles.chip}
          onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}>
          <Text style={styles.chipText}>Flip</Text>
        </Pressable>
      </View>

      <View
        style={[styles.overlay, styles.bottomBar, { paddingBottom: insets.bottom + 24 }]}
        pointerEvents="box-none">
        <Pressable
          style={[styles.shutter, isCapturing && styles.buttonDisabled]}
          onPress={takePicture}
          disabled={isCapturing}>
          {isCapturing ? (
            <ActivityIndicator color="#111" />
          ) : (
            <View style={styles.shutterInner} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  centered: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  permissionTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  permissionText: {
    color: '#ccc',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 8,
  },
  topBar: {
    top: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  bottomBar: {
    bottom: 0,
    alignItems: 'center',
  },
  chip: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  chipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  shutter: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#fff',
  },
  preview: {
    flex: 1,
    width: '100%',
    resizeMode: 'contain',
  },
  previewActions: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  primaryButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Brand.buttonRadius,
    minWidth: 140,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#111',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: Brand.buttonRadius,
    minWidth: 120,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
