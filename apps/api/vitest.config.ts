import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rutaEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

export default defineConfig({
  test: {
    // Comparten la misma base: en paralelo se pisarian.
    fileParallelism: false,
    include: ['test/**/*.test.ts'],
    retry: 0,
    testTimeout: 30_000,
    hookTimeout: 40_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      DATABASE_URL_OWNER: process.env.DATABASE_URL_OWNER ?? '',
      AUTH_SECRET: process.env.AUTH_SECRET ?? '',
    },
  },
});
