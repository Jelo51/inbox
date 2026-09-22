<script setup lang="ts">
const { t } = useI18n();
const localePath = useLocalePath();

/**
 * Le pied de page est présent sur toutes les pages, et porte les liens vers
 * tous les documents légaux ainsi que l'accès aux réglages de cookies.
 */
const legalLinks = computed(() => [
  { to: '/legal/mentions-legales', label: t('footer.mentions') },
  { to: '/legal/conditions-generales', label: t('footer.terms') },
  { to: '/legal/conditions-de-vente', label: t('footer.sales') },
  { to: '/legal/confidentialite', label: t('footer.privacy') },
  { to: '/legal/cookies', label: t('footer.cookies') },
  { to: '/legal/regles-de-publication', label: t('footer.rules') },
  { to: '/securite', label: t('footer.safety') },
]);

const helpLinks = computed(() => [
  { to: '/aide', label: t('footer.help') },
  { to: '/contact', label: t('footer.contact') },
  { to: '/pro', label: t('nav.pro') },
]);
</script>

<template>
  <footer class="mt-16 border-t border-line bg-card pb-tabbar md:pb-0">
    <div class="shell grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <p class="text-lg font-bold text-orange">{{ t('app.name') }}</p>
        <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('app.tagline') }}</p>
      </div>

      <nav :aria-label="t('footer.legal')">
        <h2 class="text-sm font-semibold text-ink">{{ t('footer.legal') }}</h2>
        <ul class="mt-3 space-y-2">
          <li v-for="link in legalLinks" :key="link.to">
            <NuxtLink
              :to="localePath(link.to)"
              class="inline-flex min-h-[1.75rem] items-center text-sm text-muted hover:text-orange-hover"
            >
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <nav :aria-label="t('footer.help')">
        <h2 class="text-sm font-semibold text-ink">{{ t('footer.help') }}</h2>
        <ul class="mt-3 space-y-2">
          <li v-for="link in helpLinks" :key="link.to">
            <NuxtLink
              :to="localePath(link.to)"
              class="inline-flex min-h-[1.75rem] items-center text-sm text-muted hover:text-orange-hover"
            >
              {{ link.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>

      <div>
        <h2 class="text-sm font-semibold text-ink">{{ t('footer.manageCookies') }}</h2>
        <p class="mt-3 text-sm leading-relaxed text-muted">
          Inbox ne dépose que des cookies strictement nécessaires au fonctionnement du site. La
          mesure d'audience utilisée n'en pose aucun.
        </p>
        <NuxtLink :to="localePath('/legal/cookies')" class="btn-secondary mt-3">
          {{ t('footer.manageCookies') }}
        </NuxtLink>
      </div>
    </div>

    <div class="border-t border-line">
      <div class="shell flex flex-col gap-2 py-4 text-xs text-grey sm:flex-row sm:justify-between">
        <p>Inbox — {{ new Date().getFullYear() }}</p>
        <LocaleSwitcher />
      </div>
    </div>
  </footer>
</template>
