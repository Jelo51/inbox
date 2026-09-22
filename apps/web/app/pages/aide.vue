<script setup lang="ts">
import { LifeBuoy, Mail, ShieldCheck } from 'lucide-vue-next';

const { t, tm, rt } = useI18n();
const localePath = useLocalePath();

useHead({ title: () => `${t('help.title')} — ${t('app.name')}` });

interface HelpItem {
  q: string;
  a: string;
}
interface HelpSection {
  title: string;
  items: HelpItem[];
}

/**
 * Les questions vivent dans les fichiers de traduction, pas dans le gabarit :
 * ce sont des textes qui changent souvent et qui existent en deux langues.
 */
const sections = computed(() =>
  (tm('help.sections') as unknown[]).map((section) => {
    const value = section as { title: unknown; items: unknown[] };
    return {
      title: rt(value.title as string),
      items: value.items.map((item) => {
        const entry = item as { q: unknown; a: unknown };
        return { q: rt(entry.q as string), a: rt(entry.a as string) };
      }),
    } satisfies HelpSection;
  }),
);
</script>

<template>
  <div class="shell max-w-3xl py-10">
    <h1 class="flex items-center gap-2 text-2xl font-bold tracking-tight sm:text-3xl">
      <LifeBuoy class="size-6 text-orange" aria-hidden="true" />
      {{ t('help.title') }}
    </h1>
    <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('help.intro') }}</p>

    <section v-for="section in sections" :key="section.title" class="mt-10">
      <h2 class="border-t border-line pt-6 text-lg font-bold tracking-tight">
        {{ section.title }}
      </h2>

      <dl class="mt-4 space-y-5">
        <div v-for="item in section.items" :key="item.q">
          <dt class="text-sm font-semibold">{{ item.q }}</dt>
          <dd class="mt-1 text-sm leading-relaxed text-muted">{{ item.a }}</dd>
        </div>
      </dl>
    </section>

    <div class="mt-10 flex flex-wrap gap-3 border-t border-line pt-6">
      <NuxtLink :to="localePath('/contact')" class="btn-primary">
        <Mail class="size-4" aria-hidden="true" />
        {{ t('help.contactCta') }}
      </NuxtLink>
      <NuxtLink :to="localePath('/securite')" class="btn-secondary">
        <ShieldCheck class="size-4" aria-hidden="true" />
        {{ t('help.safetyCta') }}
      </NuxtLink>
    </div>
  </div>
</template>
