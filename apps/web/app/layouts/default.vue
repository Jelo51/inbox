<script setup lang="ts">
import { useAuthStore } from '~/stores/auth';

const auth = useAuthStore();
const { t } = useI18n();
const localePath = useLocalePath();
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas">
    <SiteHeader />

    <!-- Rappel de vérification : sans elle, ni publication ni message. -->
    <div v-if="auth.isAuthenticated && !auth.isVerified" class="shell pt-4">
      <AppAlert tone="warning" :title="t('auth.verify.bannerTitle')">
        <p>{{ t('auth.verify.bannerText') }}</p>
        <button type="button" class="btn-secondary mt-3" @click="auth.resendVerification()">
          {{ t('auth.verify.resend') }}
        </button>
      </AppAlert>
    </div>

    <!-- Nouvelle version des CGU : réacceptation exigée avant de continuer. -->
    <div v-if="auth.needsLegalAcceptance" class="shell pt-4">
      <AppAlert tone="info" :title="t('auth.legalUpdate.title')">
        <p>{{ t('auth.legalUpdate.intro') }}</p>
        <NuxtLink :to="localePath('/conditions-mises-a-jour')" class="btn-primary mt-3">
          {{ t('auth.legalUpdate.readDocument') }}
        </NuxtLink>
      </AppAlert>
    </div>

    <main id="contenu" class="flex-1 pb-tabbar md:pb-0">
      <slot />
    </main>

    <SiteFooter />
    <MobileTabBar />
    <CookieBanner />
  </div>
</template>
