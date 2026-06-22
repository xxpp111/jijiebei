// admin/src/auth/AuthContext.tsx
// 登录态 context（account/role + login/logout）。token 在 api/client.ts 内存态。
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import type { Account } from '../api/types';
import { pbAuth, clearAuth, getAccount } from '../api/client';

interface AuthCtx {
  account: Account | null;
  login: (identity: string, password: string) => Promise<Account>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(getAccount());

  const login = useCallback(async (identity: string, password: string) => {
    const { record } = await pbAuth(identity, password);
    setAccount(record);
    return record;
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setAccount(null);
  }, []);

  return <Ctx.Provider value={{ account, login, logout }}>{children}</Ctx.Provider>;
}
