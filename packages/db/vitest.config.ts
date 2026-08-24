import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Un solo .env en la raiz del monorepo: las pruebas no mantienen su propia
// copia de credenciales (dos lugares que se desincronizan = falso verde).
const rutaEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

export default defineConfig({
  test: {
    // Las pruebas tocan una base real compartida: en paralelo se pisarian entre
    // si. Serie por decision, no por descuido.
    fileParallelism: false,
    sequence: { concurrent: false },
    include: ['test/**/*.test.ts'],
    // Sin reintentos: una prueba que pasa "a la segunda" ensena al equipo a
    // ignorar el rojo.
    retry: 0,
    testTimeout: 20_000,
    hookTimeout: 30_000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? '',
      DATABASE_URL_OWNER: process.env.DATABASE_URL_OWNER ?? '',
    },
  },
});
