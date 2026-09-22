import { useAuthStore } from '~/stores/auth';

/**
 * Protège le back-office côté navigation. Le contrôle qui compte reste celui du
 * serveur, appliqué sur le routeur `/admin` entier : celui-ci évite seulement
 * d'afficher une page qui se remplirait d'erreurs.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  await auth.restore();

  const localePath = useLocalePath();

  if (!auth.isAuthenticated) {
    return navigateTo({ path: localePath('/connexion'), query: { suite: to.fullPath } });
  }

  if (!auth.isStaff) {
    return abortNavigation({ statusCode: 404, statusMessage: 'Page introuvable' });
  }
});
