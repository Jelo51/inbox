<script setup lang="ts">
import { LEGAL_DOCUMENT_SLUGS } from '@inbox/shared';

/**
 * Les conseils de sécurité ont leur propre adresse, plus courte à dicter et à
 * mettre dans un courrier, mais restent le même document versionné que les
 * autres : ils changent quand les escroqueries changent.
 */
</script>

<template>
  <LegalDocument :slug="LEGAL_DOCUMENT_SLUGS.CONSEILS_SECURITE" />
</template>
