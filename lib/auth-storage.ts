import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import { AuthUser } from '@/lib/api';

const WEB_TOKEN_KEY = 'roofcheck_auth_token';
const WEB_USER_KEY = 'roofcheck_auth_user';
const SESSION_FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-auth.json`;

type StoredSession = {
  token: string | null;
  user: AuthUser | null;
};

export async function loadSession(): Promise<StoredSession> {
  try {
    if (Platform.OS === 'web') {
      const token = localStorage.getItem(WEB_TOKEN_KEY);
      const rawUser = localStorage.getItem(WEB_USER_KEY);
      return {
        token,
        user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null,
      };
    }

    if (!FileSystem.documentDirectory) {
      return { token: null, user: null };
    }

    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) {
      return { token: null, user: null };
    }

    const raw = await FileSystem.readAsStringAsync(SESSION_FILE);
    const parsed = JSON.parse(raw) as StoredSession;
    return {
      token: parsed.token ?? null,
      user: parsed.user ?? null,
    };
  } catch {
    return { token: null, user: null };
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  if (Platform.OS === 'web') {
    if (session.token) {
      localStorage.setItem(WEB_TOKEN_KEY, session.token);
    } else {
      localStorage.removeItem(WEB_TOKEN_KEY);
    }
    if (session.user) {
      localStorage.setItem(WEB_USER_KEY, JSON.stringify(session.user));
    } else {
      localStorage.removeItem(WEB_USER_KEY);
    }
    return;
  }

  if (!FileSystem.documentDirectory) {
    return;
  }

  await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  await saveSession({ token: null, user: null });
}
