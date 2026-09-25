import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthCompany, AuthUser } from '@/lib/api';

const WEB_TOKEN_KEY = 'roofcheck_auth_token';
const WEB_REFRESH_KEY = 'roofcheck_auth_refresh';
const WEB_USER_KEY = 'roofcheck_auth_user';
const WEB_COMPANY_KEY = 'roofcheck_auth_company';

// Native: tokens are credentials, so they go in the OS Keychain/Keystore via
// SecureStore, encrypted at rest and outside the app sandbox's plain files.
// User/company are just profile display data, not secrets, so they stay in
// a regular file — SecureStore also caps values at ~2KB, too tight to rely on.
const SECURE_TOKEN_KEY = 'roofcheck_auth_token';
const SECURE_REFRESH_KEY = 'roofcheck_auth_refresh';
const PROFILE_FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-auth-profile.json`;
// Pre-SecureStore installs left the whole session, tokens included, in this
// plaintext file. One-time migration below moves it into SecureStore and
// deletes the file so the plaintext copy doesn't linger on already-installed devices.
const LEGACY_SESSION_FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-auth.json`;

export type StoredSession = {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  company: AuthCompany | null;
};

type StoredProfile = {
  user: AuthUser | null;
  company: AuthCompany | null;
};

async function loadProfile(): Promise<StoredProfile> {
  if (!FileSystem.documentDirectory) return { user: null, company: null };

  const info = await FileSystem.getInfoAsync(PROFILE_FILE);
  if (!info.exists) return { user: null, company: null };

  const raw = await FileSystem.readAsStringAsync(PROFILE_FILE);
  const parsed = JSON.parse(raw) as StoredProfile;
  return { user: parsed.user ?? null, company: parsed.company ?? null };
}

async function saveProfile(profile: StoredProfile): Promise<void> {
  if (!FileSystem.documentDirectory) return;
  await FileSystem.writeAsStringAsync(PROFILE_FILE, JSON.stringify(profile));
}

async function migrateLegacySessionIfNeeded(): Promise<void> {
  if (!FileSystem.documentDirectory) return;

  const info = await FileSystem.getInfoAsync(LEGACY_SESSION_FILE);
  if (!info.exists) return;

  try {
    const raw = await FileSystem.readAsStringAsync(LEGACY_SESSION_FILE);
    const legacy = JSON.parse(raw) as StoredSession;
    await saveSession({
      token: legacy.token ?? null,
      refreshToken: legacy.refreshToken ?? null,
      user: legacy.user ?? null,
      company: legacy.company ?? null,
    });
  } finally {
    await FileSystem.deleteAsync(LEGACY_SESSION_FILE, { idempotent: true });
  }
}

export async function loadSession(): Promise<StoredSession> {
  try {
    if (Platform.OS === 'web') {
      const token = localStorage.getItem(WEB_TOKEN_KEY);
      const refreshToken = localStorage.getItem(WEB_REFRESH_KEY);
      const rawUser = localStorage.getItem(WEB_USER_KEY);
      const rawCompany = localStorage.getItem(WEB_COMPANY_KEY);
      return {
        token,
        refreshToken,
        user: rawUser ? (JSON.parse(rawUser) as AuthUser) : null,
        company: rawCompany ? (JSON.parse(rawCompany) as AuthCompany) : null,
      };
    }

    await migrateLegacySessionIfNeeded();

    const [token, refreshToken, profile] = await Promise.all([
      SecureStore.getItemAsync(SECURE_TOKEN_KEY),
      SecureStore.getItemAsync(SECURE_REFRESH_KEY),
      loadProfile(),
    ]);

    return { token, refreshToken, user: profile.user, company: profile.company };
  } catch {
    return { token: null, refreshToken: null, user: null, company: null };
  }
}

export async function saveSession(session: StoredSession): Promise<void> {
  if (Platform.OS === 'web') {
    if (session.token) localStorage.setItem(WEB_TOKEN_KEY, session.token);
    else localStorage.removeItem(WEB_TOKEN_KEY);

    if (session.refreshToken) localStorage.setItem(WEB_REFRESH_KEY, session.refreshToken);
    else localStorage.removeItem(WEB_REFRESH_KEY);

    if (session.user) localStorage.setItem(WEB_USER_KEY, JSON.stringify(session.user));
    else localStorage.removeItem(WEB_USER_KEY);

    if (session.company) localStorage.setItem(WEB_COMPANY_KEY, JSON.stringify(session.company));
    else localStorage.removeItem(WEB_COMPANY_KEY);
    return;
  }

  await Promise.all([
    session.token
      ? SecureStore.setItemAsync(SECURE_TOKEN_KEY, session.token)
      : SecureStore.deleteItemAsync(SECURE_TOKEN_KEY),
    session.refreshToken
      ? SecureStore.setItemAsync(SECURE_REFRESH_KEY, session.refreshToken)
      : SecureStore.deleteItemAsync(SECURE_REFRESH_KEY),
    saveProfile({ user: session.user, company: session.company }),
  ]);
}

export async function clearSession(): Promise<void> {
  await saveSession({ token: null, refreshToken: null, user: null, company: null });
}

export function companyDisplayName(company: AuthCompany | null | undefined): string {
  if (!company) return '';
  return (
    company.branding?.companyDisplayName?.trim() ||
    company.name?.trim() ||
    company.legalName?.trim() ||
    ''
  );
}
