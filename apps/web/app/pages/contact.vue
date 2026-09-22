<script setup lang="ts">
import { Mail } from 'lucide-vue-next';

const { t } = useI18n();
const localePath = useLocalePath();
const { request } = useApiClient();

useHead({ title: () => `${t('contact.title')} — ${t('app.name')}` });

interface PublisherPayload {
  publisher: {
    name: string;
    legalForm: string | null;
    rccm: string | null;
    address: string;
    email: string;
    phone: string | null;
    publicationDirector: string;
    privacyEmail: string;
    abuseEmail: string;
    dpoName: string | null;
    dpoEmail: string | null;
  };
  host: { name: string; address: string; country: string; website: string | null };
}

/**
 * L'identité vient de l'API, pas du front : elle est portée par des variables
 * d'environnement et changera le jour de l'immatriculation de la société. La
 * recopier ici reviendrait à la laisser se périmer en silence.
 */
const { data } = await useAsyncData('publisher', () => request<PublisherPayload>('/legal'));

const addresses = computed(() =>
  data.value
    ? [
        { label: t('contact.general'), email: data.value.publisher.email },
        { label: t('contact.privacy'), email: data.value.publisher.privacyEmail },
        { label: t('contact.abuse'), email: data.value.publisher.abuseEmail },
      ]
    : [],
);
</script>

<template>
  <div class="shell max-w-2xl py-10">
    <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ t('contact.title') }}</h1>
    <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('contact.intro') }}</p>

    <ul class="mt-6 space-y-3">
      <li v-for="entry in addresses" :key="entry.email" class="card-surface p-4">
        <p class="text-sm font-semibold">{{ entry.label }}</p>
        <a
          :href="`mailto:${entry.email}`"
          class="mt-1 inline-flex items-center gap-2 text-sm text-orange hover:text-orange-hover"
        >
          <Mail class="size-4" aria-hidden="true" />
          {{ entry.email }}
        </a>
      </li>
    </ul>

    <p class="mt-4 text-sm leading-relaxed text-muted">{{ t('contact.delay') }}</p>

    <section class="mt-8 border-t border-line pt-6">
      <h2 class="text-sm font-semibold">{{ t('contact.beforeWriting') }}</h2>
      <p class="mt-2 text-sm leading-relaxed text-muted">{{ t('contact.beforeWritingBody') }}</p>
    </section>

    <section v-if="data" class="mt-8 border-t border-line pt-6 text-sm leading-relaxed">
      <h2 class="font-semibold">{{ t('contact.publisher') }}</h2>
      <p class="mt-2 text-muted">
        {{ data.publisher.name }}<br />
        {{ data.publisher.address }}
      </p>
      <p class="mt-2 text-muted">
        {{ t('contact.director') }} : {{ data.publisher.publicationDirector }}
      </p>

      <h2 class="mt-6 font-semibold">{{ t('contact.host') }}</h2>
      <p class="mt-2 text-muted">
        {{ data.host.name }}<br />
        {{ data.host.address }}
      </p>

      <NuxtLink
        :to="localePath('/legal/mentions-legales')"
        class="mt-4 inline-block text-orange hover:text-orange-hover"
      >
        {{ t('footer.mentions') }}
      </NuxtLink>
    </section>
  </div>
</template>
