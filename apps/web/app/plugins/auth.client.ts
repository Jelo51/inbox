import { useAuthStore } from '~/stores/auth';

/**
 * Reprise de session au chargement. Uniquement côté client : le cookie de
 * rafraîchissement est `httpOnly` et lié au navigateur, le rendu serveur ne
 * peut donc pas s'en servir.
 */
export default defineNuxtPlugin(async () => {
  const auth = useAuthStore();
  await auth.restore();
});
