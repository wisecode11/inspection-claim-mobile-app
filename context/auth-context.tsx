import { createContext, PropsWithChildren, useContext, useEffect, useState } from 'react';

import { AuthUser, loginWithApi } from '@/lib/api';
import { clearSession, loadSession, saveSession } from '@/lib/auth-storage';

type AuthContextValue = {
  isReady: boolean;
  token: string | null;
  user: AuthUser | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const restore = async () => {
      const session = await loadSession();
      setToken(session.token);
      setUser(session.user);
      setIsReady(true);
    };

    void restore();
  }, []);

  const login = async (email: string, password: string) => {
    const data = await loginWithApi(email, password);
    await saveSession({ token: data.token, user: data.user });
    setToken(data.token);
    setUser(data.user);
  };

  const logout = async () => {
    try {
      await clearSession();
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ isReady, token, user, login, logout }}>
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
