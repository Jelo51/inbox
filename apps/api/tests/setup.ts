/**
 * Environnement minimal mais valide pour les tests : la validation au démarrage
 * est délibérément stricte, les tests doivent donc fournir une configuration
 * complète plutôt que de la contourner.
 */
process.env.NODE_ENV = 'test';
process.env.APP_URL ??= 'http://localhost:3000';
process.env.API_URL ??= 'http://localhost:3001';
process.env.DATABASE_URL ??= 'postgresql://inbox@127.0.0.1:5432/inbox?schema=public';
process.env.JWT_SECRET ??= 'test-jwt-secret-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.REFRESH_SECRET ??= 'test-refresh-secret-bbbbbbbbbbbbbbbbbbbbbbbb';
process.env.CSRF_SECRET ??= 'test-csrf-secret-cccccccccccccccccccccccccccc';
process.env.PUBLISHER_NAME ??= 'Flavien Noponkoue';
process.env.PUBLISHER_ADDRESS ??= '2 avenue Robert Schuman, 51100 Reims, France';
process.env.PUBLISHER_EMAIL ??= 'contact@inbox.cm';
process.env.PUBLICATION_DIRECTOR ??= 'Flavien Noponkoue';
process.env.PRIVACY_CONTACT_EMAIL ??= 'donnees@inbox.cm';
process.env.ABUSE_CONTACT_EMAIL ??= 'abus@inbox.cm';
process.env.HOST_NAME ??= 'OVH SAS';
process.env.HOST_ADDRESS ??= '2 rue Kellermann, 59100 Roubaix, France';
process.env.HOST_COUNTRY ??= 'France';
