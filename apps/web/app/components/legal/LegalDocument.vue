<script setup lang="ts">
import { LEGAL_DOCUMENT_SLUGS } from '@inbox/shared';
import { renderMarkdown } from '~/utils/markdown';

/**
 * Affichage d'un document légal.
 *
 * Partagé par `/legal/[type]` et par les pages qui portent un nom propre —
 * `/securite` — pour que le même document ne s'affiche pas de deux façons
 * selon le chemin par lequel on y arrive.
 */
const props = defineProps<{ slug: string }>();

const { t, locale } = useI18n();
const localePath = useLocalePath();
const { request } = useApiClient();

interface LegalDocumentPayload {
  type: string;
  slug: string;
  locale: string;
  version: string;
  title: string;
  body: string;
  effectiveAt: string;
}

interface VersionEntry {
  version: string;
  title: string;
  effectiveAt: string;
  publishedAt: string | null;
}

const { data, error } = await useAsyncData(
  () => `legal-${props.slug}-${locale.value}`,
  async () => {
    const [document, history] = await Promise.all([
      request<{ document: LegalDocumentPayload }>(`/legal/${props.slug}`, {
        query: { locale: locale.value },
      }),
      request<{ versions: VersionEntry[] }>(`/legal/${props.slug}/versions`, {
        query: { locale: locale.value },
      }),
    ]);
    return { document: document.document, versions: history.versions };
  },
  { watch: [() => props.slug, locale] },
);

// Une page légale est publique et indexable : une absence doit être une vraie
// 404, pas une page vide qui se référencerait.
if (error.value) {
  throw createError({ statusCode: 404, statusMessage: t('legal.notPublished'), fatal: true });
}

const html = computed(() => (data.value ? renderMarkdown(data.value.document.body) : ''));

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale.value === 'en' ? 'en-GB' : 'fr-FR', {
    dateStyle: 'long',
  }).format(new Date(value));
}

const previousVersions = computed(
  () => data.value?.versions.filter((v) => v.version !== data.value?.document.version) ?? [],
);

const DOCUMENT_LABELS: Record<string, string> = {
  [LEGAL_DOCUMENT_SLUGS.MENTIONS_LEGALES]: 'footer.mentions',
  [LEGAL_DOCUMENT_SLUGS.CGU]: 'footer.terms',
  [LEGAL_DOCUMENT_SLUGS.CGV]: 'footer.sales',
  [LEGAL_DOCUMENT_SLUGS.CONFIDENTIALITE]: 'footer.privacy',
  [LEGAL_DOCUMENT_SLUGS.COOKIES]: 'footer.cookies',
  [LEGAL_DOCUMENT_SLUGS.REGLES_PUBLICATION]: 'footer.rules',
  [LEGAL_DOCUMENT_SLUGS.CONSEILS_SECURITE]: 'footer.safety',
};

const otherDocuments = computed(() =>
  Object.entries(DOCUMENT_LABELS)
    .filter(([value]) => value !== props.slug)
    .map(([value, key]) => ({ slug: value, label: t(key) })),
);

useHead(() => ({
  title: data.value ? `${data.value.document.title} — ${t('app.name')}` : t('footer.legal'),
}));
</script>

<template>
  <div v-if="data" class="shell max-w-3xl py-10">
    <h1 class="text-2xl font-bold tracking-tight sm:text-3xl">{{ data.document.title }}</h1>

    <p class="tabular mt-2 text-sm text-grey">
      {{ t('legal.version', { version: data.document.version }) }} —
      {{ t('legal.effectiveAt', { date: formatDate(data.document.effectiveAt) }) }}
    </p>

    <p v-if="data.document.locale === 'en'" class="mt-3 text-sm text-muted">
      {{ t('legal.authoritative') }}
    </p>

    <!-- eslint-disable-next-line vue/no-v-html -- Markdown de nos propres documents, échappé au rendu. -->
    <article class="prose-legal mt-8" v-html="html" />

    <section v-if="previousVersions.length" class="mt-12 border-t border-line pt-6">
      <h2 class="text-sm font-semibold">{{ t('legal.history') }}</h2>
      <ul class="tabular mt-3 space-y-1 text-sm text-muted">
        <li v-for="version in previousVersions" :key="version.version">
          {{ t('legal.version', { version: version.version }) }} —
          {{ formatDate(version.effectiveAt) }}
        </li>
      </ul>
    </section>

    <nav class="mt-10 border-t border-line pt-6" :aria-label="t('legal.allDocuments')">
      <h2 class="text-sm font-semibold">{{ t('legal.allDocuments') }}</h2>
      <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <li v-for="other in otherDocuments" :key="other.slug">
          <NuxtLink
            :to="localePath(`/legal/${other.slug}`)"
            class="text-muted hover:text-orange-hover"
          >
            {{ other.label }}
          </NuxtLink>
        </li>
      </ul>
    </nav>
  </div>
</template>
