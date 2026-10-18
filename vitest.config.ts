import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // We only test pure helpers; keep the suite fast and deterministic.
    testTimeout: 5000,
  },
});
