import * as FileSystem from 'expo-file-system/legacy';
const FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-push-prefs.json`;

export type PushPrefs = {
  enabled: boolean;
};

const DEFAULTS: PushPrefs = { enabled: true };

export async function loadPushPrefs(): Promise<PushPrefs> {
  try {
    if (!FileSystem.documentDirectory) return { ...DEFAULTS };
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return { ...DEFAULTS };
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed = JSON.parse(raw) as Partial<PushPrefs>;
    return { enabled: parsed.enabled !== false };
  } catch {
    return { ...DEFAULTS };
  }
}

export async function savePushPrefs(prefs: PushPrefs): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.writeAsStringAsync(FILE, JSON.stringify(prefs));
}