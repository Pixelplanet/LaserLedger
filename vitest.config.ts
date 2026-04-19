import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    env: {
      NODE_ENV: 'test',
      JWT_SECRET: 'test-secret-do-not-use-in-prod-aaaaaaaaaaaaaaaaaaaa',
      APP_BASE_URL: 'http://localhost:5173',
      UPLOAD_DIR: './test-uploads',
    },
    include: ['server/src/**/*.test.ts', 'shared/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['server/src/**/*.ts'],
      exclude: ['server/src/**/*.test.ts', 'server/src/db/migrations/**', 'server/src/db/seeds/**'],
    },
    setupFiles: ['server/src/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
});
