import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      DB_DRIVER: 'sqlite',
      DB_FILE: ':memory:',
      JWT_SECRET: 'test-secret-do-not-use-in-prod',
      JWT_EXPIRES_IN: '1h',
      LLM_API_KEY: '',
    },
    fileParallelism: false,
    testTimeout: 15000,
  },
});
