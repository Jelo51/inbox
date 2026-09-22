import { defineStore } from 'pinia';
import { ApiError, useApiClient } from '~/composables/useApiClient';

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: 'USER' | 'PRO' | 'MODERATOR' | 'ADMIN';
  locale: string;
  emailVerified: boolean;
  hasPhone: boolean;
  bio: string | null;
  cityId: string | null;
  createdAt: string;
}

export interface PendingAcceptance {
  type: string;
  version: string;
  title: string;
  effectiveAt: string;
}

interface SessionResponse {
  user: SessionUser;
  accessToken: string;
  expiresIn: number;
  csrfToken: string;
  pendingLegalAcceptances: PendingAcceptance[];
}

/**
 * Le jeton d'accès vit en mémoire, jamais dans `localStorage` : un script
 * injecté pourrait l'y lire. Sa persistance entre deux chargements de page est
 * assurée par le cookie de rafraîchissement, que le script ne peut pas lire.
 */
export const useAuthStore = defineStore('auth', () => {
  const api = useApiClient();

  const user = ref<SessionUser | null>(null);
  const accessToken = ref<string | null>(null);
  const csrfToken = ref<string | null>(null);
  const pendingLegal = ref<PendingAcceptance[]>([]);
  const initialised = ref(false);

  const isAuthenticated = computed(() => user.value !== null);
  const isVerified = computed(() => user.value?.emailVerified === true);
  const needsLegalAcceptance = computed(() => pendingLegal.value.length > 0);
  const isStaff = computed(() => user.value?.role === 'MODERATOR' || user.value?.role === 'ADMIN');

  function applySession(session: SessionResponse) {
    user.value = session.user;
    accessToken.value = session.accessToken;
    csrfToken.value = session.csrfToken;
    pendingLegal.value = session.pendingLegalAcceptances;
  }

  function clearSession() {
    user.value = null;
    accessToken.value = null;
    csrfToken.value = null;
    pendingLegal.value = [];
  }

  async function login(email: string, password: string) {
    applySession(
      await api.request<SessionResponse>('/auth/login', {
        method: 'POST',
        body: { email, password },
      }),
    );
  }

  async function register(input: {
    email: string;
    password: string;
    displayName: string;
    phone?: string;
    locale: string;
    isAdult: true;
    acceptedLegalVersions: Record<string, string>;
  }) {
    applySession(
      await api.request<SessionResponse>('/auth/register', { method: 'POST', body: input }),
    );
  }

  /**
   * Tente de reprendre la session au chargement de l'application. Un échec est
   * le cas normal d'un visiteur non connecté : il ne doit rien afficher.
   */
  async function restore() {
    if (initialised.value) return;
    try {
      applySession(
        await api.request<SessionResponse>('/auth/refresh', {
          method: 'POST',
          csrfToken: readCsrfCookie(),
        }),
      );
    } catch {
      clearSession();
    } finally {
      initialised.value = true;
    }
  }

  async function logout() {
    try {
      await api.request('/auth/logout', { method: 'POST', csrfToken: csrfToken.value });
    } finally {
      clearSession();
    }
  }

  async function acceptLegal() {
    await api.request('/auth/legal/accept', {
      method: 'POST',
      body: {},
      accessToken: accessToken.value,
    });
    pendingLegal.value = [];
  }

  async function resendVerification() {
    await api.request('/auth/verify-email/resend', {
      method: 'POST',
      accessToken: accessToken.value,
    });
  }

  /**
   * Appel authentifié avec renouvellement transparent : un jeton d'accès de
   * quinze minutes expire forcément pendant une session de navigation.
   */
  async function authedRequest<T>(
    path: string,
    options: Parameters<typeof api.request>[1] = {},
  ): Promise<T> {
    try {
      return await api.request<T>(path, { ...options, accessToken: accessToken.value });
    } catch (err) {
      if (!(err instanceof ApiError) || err.status !== 401) throw err;

      applySession(
        await api.request<SessionResponse>('/auth/refresh', {
          method: 'POST',
          csrfToken: csrfToken.value ?? readCsrfCookie(),
        }),
      );

      return api.request<T>(path, { ...options, accessToken: accessToken.value });
    }
  }

  return {
    user,
    accessToken,
    csrfToken,
    pendingLegal,
    initialised,
    isAuthenticated,
    isVerified,
    isStaff,
    needsLegalAcceptance,
    login,
    register,
    restore,
    logout,
    acceptLegal,
    resendVerification,
    authedRequest,
    clearSession,
  };
});

/** Le cookie CSRF est volontairement lisible : c'est le principe de la double soumission. */
function readCsrfCookie(): string | null {
  if (import.meta.server) return null;
  const match = document.cookie.match(/(?:^|;\s*)inbox_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}
