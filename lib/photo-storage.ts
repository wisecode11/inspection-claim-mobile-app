import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

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
