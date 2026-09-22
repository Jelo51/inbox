import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import pluginVue from 'eslint-plugin-vue';
import vueParser from 'vue-eslint-parser';
import prettier from 'eslint-config-prettier';

/**
 * Configuration ESLint « flat » partagée par tout le monorepo.
 * Voir CLAUDE.md pour les conventions.
 */
export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'docs/design-reference/**',
      'apps/api/prisma/migrations/**',
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node, ...globals.es2022 },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message:
            'Utiliser le service horloge (packages/shared) plutôt que new Date() pour rester testable.',
        },
      ],
    },
  },

  // Interface : pas d'emoji, pas de Google Fonts (cf. cahier des charges §2 et §7).
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tseslint.parser, sourceType: 'module' },
      globals: { ...globals.browser },
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Nuxt importe automatiquement `useI18n`, `useHead`, `computed`… : `no-undef`
  // n'a rien à vérifier ici, et TypeScript signale déjà les vrais oublis.
  {
    files: ['apps/web/**/*.{ts,vue}'],
    languageOptions: { globals: { ...globals.browser } },
    rules: { 'no-undef': 'off' },
  },

  // Scripts outillage et seed : la console est le canal de sortie légitime.
  {
    files: ['**/scripts/**', '**/prisma/**', '**/*.config.{ts,js,mjs}', '**/vitest.setup.ts'],
    rules: { 'no-console': 'off', 'no-restricted-syntax': 'off' },
  },

  // clock.ts EST le service horloge : c'est le seul endroit où `new Date()`
  // a le droit d'exister.
  {
    files: ['packages/shared/src/utils/clock.ts', 'apps/api/src/lib/clock.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },

  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**'],
    rules: { 'no-restricted-syntax': 'off', '@typescript-eslint/no-explicit-any': 'off' },
  },

  prettier,
);
