import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // The suites were written for Jest and use describe/it/expect as globals
    globals: true,
    include: ['test/**/*.test.js'],
  },
});
