import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

const UPLOAD_MAX_WIDTH = 1800;
const UPLOAD_JPEG_QUALITY = 0.78;

function extensionFromUri(uri: string) {
  const clean = uri.split('?')[0] || uri;
  const match = clean.match(/\.([a-zA-Z0-9]+)$/);
  const ext = match?.[1]?.toLowerCase();
  if (ext && ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
    return ext === 'jpeg' ? 'jpg' : ext;
  }
  return 'jpg';
}

function isAlreadyDurable(uri: string) {
  if (!uri) return false;
  if (Platform.OS === 'web') return true;
  const doc = FileSystem.documentDirectory || '';
  return Boolean(doc && uri.startsWith(doc));
}

/** Copy capture URIs into app document storage so drafts survive cache cleanup. */
export async function persistPhotoUri(uri: string): Promise<string> {
  if (!uri) return uri;
  if (Platform.OS === 'web') return uri;
  if (!FileSystem.documentDirectory) return uri;
  if (isAlreadyDurable(uri)) return uri;

  try {
    const ext = extensionFromUri(uri);
    const dest = `${FileSystem.documentDirectory}capture_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 8)}.${ext}`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch {
    return uri;
  }
}

export async function persistPhotoUris(uris: string[]): Promise<string[]> {
  const next: string[] = [];
  for (const uri of uris) {
    next.push(await persistPhotoUri(uri));
  }
  return next;
}

export async function readPhotoBase64(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = String(reader.result || '');
        const match = result.match(/^data:[^;]+;base64,(.+)$/);
        resolve(match?.[1] || '');
      };
      reader.onerror = () => reject(new Error('Could not read photo'));
      reader.readAsDataURL(blob);
    });
    return { base64, mimeType: blob.type || 'image/jpeg' };
  }

  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const ext = extensionFromUri(uri);
  const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { base64, mimeType };
}

/**
 * Resizes/recompresses a photo before it's sent to the backend, so the
 * upload payload isn't the full, unresized camera capture (often several
 * MB per photo). Falls back to the raw file if manipulation fails for any
 * reason — a resize error should never block an upload.
 */
export async function readPhotoBase64ForUpload(uri: string): Promise<{ base64: string; mimeType: string }> {
  if (Platform.OS === 'web') {
    return readPhotoBase64(uri);
  }

  try {
    const probe = await ImageManipulator.manipulateAsync(uri, []);
    const actions =
      probe.width > UPLOAD_MAX_WIDTH ? [{ resize: { width: UPLOAD_MAX_WIDTH } }] : [];
    const result = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: UPLOAD_JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (result.base64) {
      return { base64: result.base64, mimeType: 'image/jpeg' };
    }
  } catch {
    // Fall back to the original file below.
  }

  return readPhotoBase64(uri);
}
