import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { registerPushTokenWithApi } from '@/lib/api';
import { getStableDeviceId } from '@/lib/device-id';
import { loadPushPrefs } from '@/lib/push-prefs';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function projectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId ??
    undefined
  );
}

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('jobs', {
    name: 'Job alerts',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#133A42',
  });
}

export async function getExpoPushTokenAsync(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  await ensureAndroidChannel();

  const current = await Notifications.getPermissionsAsync();
  let status = current.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') {
    return null;
  }

  const id = projectId();
  if (!id) {
    console.warn('[push] Missing EAS projectId');
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId: id });
  return token.data || null;
}

export async function syncPushRegistration(authToken: string): Promise<{
  token: string | null;
  enabled: boolean;
}> {
  const prefs = await loadPushPrefs();
  if (!prefs.enabled) {
    return { token: null, enabled: false };
  }

  const pushToken = await getExpoPushTokenAsync();
  if (!pushToken) {
    return { token: null, enabled: prefs.enabled };
  }

  const deviceId = await getStableDeviceId();
  await registerPushTokenWithApi(authToken, {
    deviceId,
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    pushToken,
    pushEnabled: true,
    appVersion: Constants.expoConfig?.version || '',
    osVersion: String(Platform.Version ?? ''),
    name: Platform.OS,
  });

  return { token: pushToken, enabled: true };
}