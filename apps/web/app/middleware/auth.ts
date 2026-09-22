import { useAuthStore } from '~/stores/auth';

/**
 * Protège les pages réservées aux comptes connectés. Le contrôle sérieux reste
 * côté serveur sur chaque route de l'API : celui-ci évite seulement d'afficher
 * une page vide.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore();
  await auth.restore();

  if (!auth.isAuthenticated) {
    const localePath = useLocalePath();
    return navigateTo({
      path: localePath('/connexion'),
      query: { suite: to.fullPath },
    });
  }
});
