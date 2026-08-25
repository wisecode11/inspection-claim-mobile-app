import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

import type { AuthCompany, AuthUser } from '@/lib/api';

const WEB_TOKEN_KEY = 'roofcheck_auth_token';
const WEB_REFRESH_KEY = 'roofcheck_auth_refresh';
const WEB_USER_KEY = 'roofcheck_auth_user';
const WEB_COMPANY_KEY = 'roofcheck_auth_company';
const SESSION_FILE = `${FileSystem.documentDirectory ?? ''}roofcheck-auth.json`;

export type StoredSession = {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  company: AuthCompany | null;
};

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

    if (!FileSystem.documentDirectory) {
      return { token: null, refreshToken: null, user: null, company: null };
    }

    const info = await FileSystem.getInfoAsync(SESSION_FILE);
    if (!info.exists) {
      return { token: null, refreshToken: null, user: null, company: null };
    }

    const raw = await FileSystem.readAsStringAsync(SESSION_FILE);
    const parsed = JSON.parse(raw) as StoredSession;
    return {
      token: parsed.token ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user ?? null,
      company: parsed.company ?? null,
    };
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

  if (!FileSystem.documentDirectory) return;
  await FileSystem.writeAsStringAsync(SESSION_FILE, JSON.stringify(session));
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
