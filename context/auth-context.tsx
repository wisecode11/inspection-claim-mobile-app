import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { AuthCompany, AuthUser, clearPushTokenWithApi, loginWithApi } from '@/lib/api';
import { clearCachedJobs } from '@/lib/jobs-storage';
import {
  clearSession,
  companyDisplayName,
  loadSession,
  saveSession,
} from '@/lib/auth-storage';
import { getStableDeviceId } from '@/lib/device-id';
import { syncPushRegistration } from '@/lib/push-notifications';

type AuthContextValue = {
  isReady: boolean;
  token: string | null;
  user: AuthUser | null;
  company: AuthCompany | null;
  companyName: string;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [company, setCompany] = useState<AuthCompany | null>(null);

  useEffect(() => {
    const restore = async () => {
      const session = await loadSession();
      setToken(session.token);
      setUser(session.user);
      setCompany(session.company);
      setIsReady(true);
    };

    void restore();
  }, []);

  useEffect(() => {
    if (!token) return;
    void syncPushRegistration(token).catch((error) => {
      console.warn('[push] registration failed', error);
    });
  }, [token]);

  const login = async (email: string, password: string) => {
    const data = await loginWithApi(email, password);
    await saveSession({
      token: data.token,
      refreshToken: data.refreshToken,
      user: data.user,
      company: data.company,
    });
    setToken(data.token);
    setUser(data.user);
    setCompany(data.company);
  };

  const logout = async () => {
    try {
      if (token) {
        const deviceId = await getStableDeviceId();
        await clearPushTokenWithApi(token, { deviceId }).catch(() => undefined);
      }
      await clearSession();
      await clearCachedJobs();
    } finally {
      setToken(null);
      setUser(null);
      setCompany(null);
    }
  };

  const companyName = useMemo(() => companyDisplayName(company), [company]);

  return (
    <AuthContext.Provider
      value={{ isReady, token, user, company, companyName, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return value;
}