import { useRuntimeConfig } from '#app';

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Message à afficher sous un champ précis du formulaire. */
  fieldError(field: string): string | null {
    return this.details?.[field]?.[0] ?? null;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  /** Jeton d'accès à joindre ; le magasin d'authentification le fournit. */
  accessToken?: string | null;
  /** Requis sur les routes qui s'appuient sur le cookie de rafraîchissement. */
  csrfToken?: string | null;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

function buildUrl(base: string, path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${base}${path}`, base);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/**
 * Client HTTP de l'API. `credentials: 'include'` est indispensable : le jeton
 * de rafraîchissement vit dans un cookie `httpOnly` que le script ne peut pas
 * lire, et qui doit donc voyager tout seul.
 */
export function useApiClient() {
  const config = useRuntimeConfig();
  const base = config.public.apiBase;

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };

    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;
    if (options.csrfToken) headers['X-CSRF-Token'] = options.csrfToken;

    const response = await fetch(buildUrl(base, path, options.query), {
      method: options.method ?? 'GET',
      headers,
      credentials: 'include',
      ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
      ...(options.signal && { signal: options.signal }),
    });

    if (response.status === 204) return undefined as T;

    const payload = (await response.json().catch(() => null)) as
      { error?: ApiErrorShape } | T | null;

    if (!response.ok) {
      const error = (payload as { error?: ApiErrorShape } | null)?.error;
      throw new ApiError(
        response.status,
        error?.code ?? 'UNKNOWN_ERROR',
        error?.message ?? 'Une erreur est survenue',
        error?.details,
      );
    }

    return payload as T;
  }

  return { request, base };
}
