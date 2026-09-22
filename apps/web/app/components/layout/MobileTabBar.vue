<script setup lang="ts">
import { Heart, House, MessageSquare, Plus, UserRound } from 'lucide-vue-next';

/**
 * Barre d'onglets fixe du bas, affichée jusqu'à 760 px, avec le bouton
 * « Déposer » au centre comme sur la maquette. Toutes les cibles font au moins
 * 44 px de haut, et la barre respecte la zone sûre des appareils à encoche.
 */
const { t } = useI18n();
const localePath = useLocalePath();

const tabs = computed(() => [
  { to: '/', icon: House, label: t('nav.home') },
  { to: '/favoris', icon: Heart, label: t('nav.favorites') },
  { to: '/messages', icon: MessageSquare, label: t('nav.messages') },
  { to: '/compte', icon: UserRound, label: t('nav.account') },
]);
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-card md:hidden"
    style="padding-bottom: env(safe-area-inset-bottom)"
    :aria-label="t('nav.home')"
  >
    <ul class="grid h-tabbar grid-cols-5 items-stretch">
      <li v-for="(tab, index) in tabs.slice(0, 2)" :key="tab.to" class="contents">
        <NuxtLink
          :to="localePath(tab.to)"
          class="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-grey"
          active-class="text-orange"
          :style="{ gridColumn: index + 1 }"
        >
          <component :is="tab.icon" class="h-5 w-5" aria-hidden="true" />
          <span>{{ tab.label }}</span>
        </NuxtLink>
      </li>

      <li class="relative flex items-center justify-center" style="grid-column: 3">
        <NuxtLink
          :to="localePath('/deposer')"
          class="absolute -top-5 flex h-14 w-14 flex-col items-center justify-center rounded-full bg-orange text-white shadow-raised"
          :aria-label="t('nav.publish')"
        >
          <Plus class="h-6 w-6" aria-hidden="true" />
        </NuxtLink>
        <span class="mt-6 text-[11px] font-medium text-grey">{{ t('nav.publish') }}</span>
      </li>

      <li v-for="(tab, index) in tabs.slice(2)" :key="tab.to" class="contents">
        <NuxtLink
          :to="localePath(tab.to)"
          class="flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-grey"
          active-class="text-orange"
          :style="{ gridColumn: index + 4 }"
        >
          <component :is="tab.icon" class="h-5 w-5" aria-hidden="true" />
          <span>{{ tab.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
