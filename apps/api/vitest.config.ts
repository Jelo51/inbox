import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Les suites API partagent la base de développement : pas de parallélisme.
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
