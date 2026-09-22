<script setup lang="ts">
import {
  ArrowLeft,
  CreditCard,
  Flag,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-vue-next';
import { useAuthStore } from '~/stores/auth';

const { t } = useI18n();
const localePath = useLocalePath();
const auth = useAuthStore();

const links = computed(() =>
  [
    { to: '/admin', icon: LayoutDashboard, label: t('admin.nav.dashboard'), adminOnly: false },
    {
      to: '/admin/moderation',
      icon: ShieldCheck,
      label: t('admin.nav.moderation'),
      adminOnly: false,
    },
    { to: '/admin/signalements', icon: Flag, label: t('admin.nav.reports'), adminOnly: false },
    { to: '/admin/membres', icon: Users, label: t('admin.nav.users'), adminOnly: false },
    { to: '/admin/paiements', icon: CreditCard, label: t('admin.nav.payments'), adminOnly: true },
    { to: '/admin/audit', icon: ScrollText, label: t('admin.nav.audit'), adminOnly: false },
  ].filter((link) => !link.adminOnly || auth.user?.role === 'ADMIN'),
);
</script>

<template>
  <div class="flex min-h-screen flex-col bg-canvas">
    <header class="border-b border-line bg-card">
      <div class="shell flex h-14 items-center gap-4">
        <NuxtLink :to="localePath('/admin')" class="font-bold tracking-tight">
          <span class="text-orange">Inbox</span>
          <span class="ml-1.5 text-sm font-semibold text-muted">{{ t('admin.title') }}</span>
        </NuxtLink>

        <NuxtLink
          :to="localePath('/')"
          class="ml-auto inline-flex min-h-touch items-center gap-1.5 text-sm text-muted hover:text-orange-hover"
        >
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          {{ t('admin.nav.backToSite') }}
        </NuxtLink>
      </div>

      <nav class="shell -mb-px flex gap-1 overflow-x-auto" :aria-label="t('admin.title')">
        <NuxtLink
          v-for="link in links"
          :key="link.to"
          :to="localePath(link.to)"
          class="flex min-h-touch shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted hover:text-ink"
          active-class="border-orange text-orange"
        >
          <component :is="link.icon" class="h-4 w-4" aria-hidden="true" />
          {{ link.label }}
        </NuxtLink>
      </nav>
    </header>

    <main id="contenu" class="flex-1 py-6">
      <slot />
    </main>
  </div>
</template>
