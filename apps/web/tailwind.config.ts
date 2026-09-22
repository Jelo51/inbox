import type { Config } from 'tailwindcss';

/**
 * Jetons de design repris de la maquette validée
 * (docs/design-reference/inbox-demo-v3.jsx).
 *
 * Les paliers sont nommés d'après la maquette plutôt que d'après les tailles
 * Tailwind par défaut, pour que la correspondance reste lisible :
 *   base   ≤ 430 px  1 colonne
 *   sm     ≥ 431 px  2 colonnes
 *   md     ≥ 761 px  2 colonnes, la barre d'onglets du bas disparaît
 *   lg     ≥ 941 px  3 colonnes
 *   xl     ≥ 1181 px 4 colonnes
 */
export default {
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.vue',
    './app/pages/**/*.vue',
    './app/plugins/**/*.{js,ts}',
    './app/composables/**/*.{js,ts}',
    './app/app.vue',
    './app/error.vue',
  ],
  theme: {
    screens: {
      sm: '431px',
      md: '761px',
      lg: '941px',
      xl: '1181px',
    },
    extend: {
      colors: {
        orange: {
          DEFAULT: '#FF6E14',
          hover: '#E85A02',
          soft: '#FFF3EB',
        },
        ink: '#171A1F',
        muted: '#4A5159',
        grey: '#7C848D',
        canvas: '#F6F6F7',
        card: '#FFFFFF',
        line: '#E5E6E8',
        success: '#1E9E62',
        pending: '#B27400',
        danger: '#D33A2C',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // 16 px minimum sur les champs de saisie : en dessous, iOS zoome.
        input: ['1rem', { lineHeight: '1.5rem' }],
      },
      spacing: {
        // Cible tactile minimale recommandée.
        touch: '2.75rem',
        // Hauteur de la barre d'onglets fixe du bas, sur mobile.
        tabbar: '3.75rem',
      },
      borderRadius: {
        card: '0.75rem',
        pill: '9999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 26, 31, 0.04), 0 1px 3px rgba(23, 26, 31, 0.06)',
        raised: '0 4px 12px rgba(23, 26, 31, 0.08)',
        focus: '0 0 0 3px rgba(255, 110, 20, 0.35)',
      },
      maxWidth: {
        shell: '1240px',
      },
    },
  },
  plugins: [],
} satisfies Config;
