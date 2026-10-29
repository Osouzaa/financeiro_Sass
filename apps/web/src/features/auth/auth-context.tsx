import type {
  AuthResponse,
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UserDto,
} from '@financeiro/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, onSessionChange, refreshSession, setSession } from '@/lib/api';

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthContextValue {
  status: Status;
  user: UserDto | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Atualiza os dados do usuário em memória (após editar perfil ou foto). */
  updateUser: (user: UserDto) => void;
  /** Troca a senha; a API devolve uma sessão nova para este dispositivo. */
  changePassword: (input: ChangePasswordInput) => Promise<void>;
  /** Relê o usuário da API (ex.: depois de confirmar o e-mail). */
  reloadUser: () => Promise<void>;
  /** Encerra a sessão só neste navegador (a conta já foi excluída na API). */
  endSession: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<UserDto | null>(null);

  useEffect(() => {
    const unsubscribe = onSessionChange((session) => {
      setUser(session?.user ?? null);
      setStatus(session ? 'authenticated' : 'anonymous');
      if (!session) queryClient.clear();
    });
    // Restaura a sessão a partir do cookie ao abrir o app
    void refreshSession();
    return unsubscribe;
  }, [queryClient]);

  const login = useCallback(async (input: LoginInput) => {
    setSession(
      await api<AuthResponse>('/auth/login', {
        method: 'POST',
        body: input,
        retryOnUnauthorized: false,
      }),
    );
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    setSession(
      await api<AuthResponse>('/auth/register', {
        method: 'POST',
        body: input,
        retryOnUnauthorized: false,
      }),
    );
  }, []);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST', retryOnUnauthorized: false }).catch(
      () => undefined,
    );
    setSession(null);
  }, []);

  const updateUser = useCallback((next: UserDto) => setUser(next), []);

  const changePassword = useCallback(async (input: ChangePasswordInput) => {
    setSession(await api<AuthResponse>('/auth/password', { method: 'POST', body: input }));
  }, []);

  const reloadUser = useCallback(async () => {
    setUser(await api<UserDto>('/auth/me'));
  }, []);

  const endSession = useCallback(() => setSession(null), []);

  const value = useMemo(
    () => ({
      status,
      user,
      login,
      register,
      logout,
      updateUser,
      changePassword,
      reloadUser,
      endSession,
    }),
    [status, user, login, register, logout, updateUser, changePassword, reloadUser, endSession],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

// Provider e hook juntos são o padrão para contextos; o aviso de fast refresh não se aplica.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>');
  return context;
}
