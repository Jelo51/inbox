import { fileURLToPath } from 'node:url';

export default defineNuxtConfig({
  compatibilityDate: '2025-09-01',
  srcDir: 'app/',
  future: { compatibilityVersion: 4 },

  // Le référencement des annonces compte : rendu côté serveur, pas de SPA.
  ssr: true,

  typescript: { strict: true, typeCheck: false },

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@nuxtjs/i18n'],

  // Sans `pathPrefix: false`, Nuxt nommerait les composants d'après leur
  // dossier (`ui/FormField.vue` deviendrait `<UiFormField>`), et les balises
  // non résolues se rendraient silencieusement comme des éléments inconnus.
  components: [{ path: '~/components', pathPrefix: false }],

  css: [
    // Polices servies localement : aucun appel à Google Fonts, donc aucun
    // transfert de données vers un tiers au chargement de la page.
    '@fontsource/plus-jakarta-sans/400.css',
    '@fontsource/plus-jakarta-sans/500.css',
    '@fontsource/plus-jakarta-sans/600.css',
    '@fontsource/plus-jakarta-sans/700.css',
    '@fontsource/jetbrains-mono/400.css',
    '@fontsource/jetbrains-mono/500.css',
    '@fontsource/jetbrains-mono/600.css',
    '~/assets/css/main.css',
  ],

  i18n: {
    locales: [
      { code: 'fr', language: 'fr-CM', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-CM', name: 'English', file: 'en.json' },
    ],
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
    langDir: 'locales/',
    detectBrowserLanguage: {
      useCookie: true,
      // Cookie strictement nécessaire : il mémorise un choix de l'utilisateur.
      cookieKey: 'inbox_locale',
      alwaysRedirect: false,
      redirectOn: 'root',
      cookieSecure: process.env.NODE_ENV === 'production',
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3001/api/v1',
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      umamiScriptUrl: process.env.NUXT_PUBLIC_UMAMI_SCRIPT_URL ?? '',
      umamiWebsiteId: process.env.NUXT_PUBLIC_UMAMI_WEBSITE_ID ?? '',
    },
  },

  alias: {
    '@inbox/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
  },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      meta: [
        { charset: 'utf-8' },
        // `viewport-fit=cover` pour les encoches ; pas de maximum-scale, qui
        // empêcherait le zoom et casserait l'accessibilité.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#FF6E14' },
      ],
    },
  },

  nitro: {
    compressPublicAssets: true,
  },
});
