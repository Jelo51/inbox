<script setup lang="ts">
import {
  BadgeCheck,
  CircleAlert,
  CreditCard,
  Database,
  Heart,
  LogOut,
  MessageSquare,
  Settings,
  SquareStack,
} from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';

definePageMeta({ middleware: 'auth' });

const { t, locale } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();

useHead({ title: () => `${t('account.title')} — ${t('app.name')}` });

const sections = computed(() => [
  { to: '/compte/annonces', icon: SquareStack, label: t('account.listings') },
  { to: '/favoris', icon: Heart, label: t('account.favorites') },
  { to: '/messages', icon: MessageSquare, label: t('account.messages') },
  { to: '/compte/abonnement', icon: CreditCard, label: t('account.subscription') },
  { to: '/compte/parametres', icon: Settings, label: t('account.settings') },
  { to: '/compte/mes-donnees', icon: Database, label: t('account.data') },
]);

const memberSince = computed(() =>
  auth.user
    ? new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'fr-FR', {
        month: 'long',
        year: 'numeric',
      }).format(new Date(auth.user.createdAt))
    : '',
);

async function logout() {
  await auth.logout();
  await navigateTo(localePath('/'));
}
</script>

<template>
  <div class="shell max-w-2xl py-8">
    <h1 class="text-2xl font-bold tracking-tight">{{ t('account.title') }}</h1>

    <section v-if="auth.user" class="card-surface mt-6 p-5">
      <p class="text-lg font-semibold">{{ auth.user.displayName }}</p>
      <p class="mt-1 text-sm text-muted">{{ auth.user.email }}</p>

      <p
        class="mt-3 inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-xs font-semibold"
        :class="auth.isVerified ? 'bg-success/10 text-success' : 'bg-pending/10 text-pending'"
      >
        <component
          :is="auth.isVerified ? BadgeCheck : CircleAlert"
          class="h-3.5 w-3.5"
          aria-hidden="true"
        />
        {{ auth.isVerified ? t('account.verified') : t('account.unverified') }}
      </p>

      <p class="mt-3 text-xs text-grey">
        {{ t('account.memberSince', { date: memberSince }) }}
      </p>
    </section>

    <nav class="mt-6 grid gap-3 sm:grid-cols-2" :aria-label="t('account.title')">
      <NuxtLink
        v-for="section in sections"
        :key="section.to"
        :to="localePath(section.to)"
        class="card-surface flex min-h-touch items-center gap-3 p-4 text-sm font-medium transition-colors hover:border-orange"
      >
        <component :is="section.icon" class="h-5 w-5 shrink-0 text-grey" aria-hidden="true" />
        {{ section.label }}
      </NuxtLink>
    </nav>

    <button type="button" class="btn-secondary mt-6 w-full" @click="logout">
      <LogOut class="h-4 w-4" aria-hidden="true" />
      {{ t('account.logout') }}
    </button>
  </div>
</template>
