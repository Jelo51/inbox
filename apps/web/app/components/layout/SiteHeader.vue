<script setup lang="ts">
import { Heart, LogIn, MessageSquare, Plus, Search, UserRound } from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-line bg-card/95 backdrop-blur">
    <div class="shell flex h-16 items-center gap-3">
      <NuxtLink
        :to="localePath('/')"
        class="flex min-h-touch items-center text-xl font-bold tracking-tight text-orange"
      >
        {{ t('app.name') }}
      </NuxtLink>

      <NuxtLink
        :to="localePath('/recherche')"
        class="ml-auto flex min-h-touch flex-1 items-center gap-2 rounded-pill border border-line bg-canvas px-4 text-sm text-grey hover:border-orange md:max-w-md"
      >
        <Search class="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{{ t('nav.search') }}</span>
      </NuxtLink>

      <nav class="hidden items-center gap-1 md:flex" :aria-label="t('nav.account')">
        <NuxtLink :to="localePath('/favoris')" class="btn-ghost" :aria-label="t('nav.favorites')">
          <Heart class="h-5 w-5" aria-hidden="true" />
          <span class="hidden lg:inline">{{ t('nav.favorites') }}</span>
        </NuxtLink>

        <NuxtLink :to="localePath('/messages')" class="btn-ghost" :aria-label="t('nav.messages')">
          <MessageSquare class="h-5 w-5" aria-hidden="true" />
          <span class="hidden lg:inline">{{ t('nav.messages') }}</span>
        </NuxtLink>

        <NuxtLink
          v-if="auth.isAuthenticated"
          :to="localePath('/compte')"
          class="btn-ghost"
          :aria-label="t('nav.account')"
        >
          <UserRound class="h-5 w-5" aria-hidden="true" />
          <span class="hidden lg:inline">{{ auth.user?.displayName }}</span>
        </NuxtLink>

        <NuxtLink v-else :to="localePath('/connexion')" class="btn-secondary">
          <LogIn class="h-4 w-4" aria-hidden="true" />
          {{ t('auth.login.submit') }}
        </NuxtLink>

        <NuxtLink :to="localePath('/deposer')" class="btn-primary ml-1">
          <Plus class="h-4 w-4" aria-hidden="true" />
          {{ t('nav.publish') }}
        </NuxtLink>
      </nav>
    </div>
  </header>
</template>
