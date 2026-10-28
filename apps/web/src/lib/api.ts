import type { ApiErrorBody, AuthResponse } from '@financeiro/shared';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) || '/api/v1';

/** Erro de API com mensagem pronta para exibir e erros por campo. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/*
 * O access token fica só em memória (nunca em localStorage), para não ser lido
 * por scripts injetados. O refresh token fica em cookie httpOnly, que o
 * JavaScript não consegue ler. Ao recarregar a página, a sessão é restaurada
 * chamando /auth/refresh.
 */
let accessToken: string | null = null;
let refreshing: Promise<AuthResponse | null> | null = null;
let sessionListener: ((session: AuthResponse | null) => void) | null = null;

export function setSession(session: AuthResponse | null): void {
  accessToken = session?.accessToken ?? null;
  sessionListener?.(session);
}

export function onSessionChange(listener: (session: AuthResponse | null) => void): () => void {
  sessionListener = listener;
  return () => {
    if (sessionListener === listener) sessionListener = null;
  };
}

/**
 * Renova a sessão. Chamadas simultâneas compartilham a mesma requisição,
 * para não gastar o refresh token duas vezes.
 */
export function refreshSession(): Promise<AuthResponse | null> {
  refreshing ??= fetch(`${BASE_URL}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (response) => (response.ok ? ((await response.json()) as AuthResponse) : null))
    .catch(() => null)
    .then((session) => {
      setSession(session);
      return session;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** false nas rotas de login/cadastro: um 401 ali é erro de credencial, não sessão expirada. */
  retryOnUnauthorized?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retryOnUnauthorized = true } = options;

  const send = () =>
    fetch(`${BASE_URL}${path}`, {
      method,
      credentials: 'include',
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

  let response: Response;
  try {
    response = await send();
  } catch {
    throw new ApiError(
      0,
      'Não foi possível falar com o servidor. Verifique se a API está rodando.',
    );
  }

  if (response.status === 401 && retryOnUnauthorized) {
    const session = await refreshSession();
    if (session) response = await send();
  }

  if (!response.ok) {
    const error = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(
      response.status,
      error?.message ?? `Erro ${response.status}`,
      error?.fields ?? {},
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
