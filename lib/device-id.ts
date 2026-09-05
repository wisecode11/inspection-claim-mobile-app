import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

const WEB_KEY = 'roofcheck_device_id';
const DEVICE_FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-device-id.txt`;

function createId() {
  return `rc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getStableDeviceId(): Promise<string> {
  try {
    if (Platform.OS === 'web') {
      const existing = localStorage.getItem(WEB_KEY);
      if (existing) return existing;
      const next = createId();
      localStorage.setItem(WEB_KEY, next);
      return next;
    }

    if (!FileSystem.documentDirectory) {
      return createId();
    }

    const info = await FileSystem.getInfoAsync(DEVICE_FILE);
    if (info.exists) {
      const saved = (await FileSystem.readAsStringAsync(DEVICE_FILE)).trim();
      if (saved) return saved;
    }

    const next = createId();
    await FileSystem.writeAsStringAsync(DEVICE_FILE, next);
    return next;
  } catch {
    return createId();
  }
}