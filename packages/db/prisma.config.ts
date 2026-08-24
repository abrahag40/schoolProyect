import { defineConfig } from 'prisma/config';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Configuracion de Prisma Migrate.
 *
 * Nota de seguridad (ADR-004): aqui va DATABASE_URL_OWNER — migrar necesita
 * DDL. El runtime NUNCA usa esta credencial: la aplicacion se conecta con
 * azahar_app (NOBYPASSRLS) via driver adapter en src/index.ts. Si algun dia
 * alguien "simplifica" poniendo la misma URL en los dos lados, el aislamiento
 * multi-tenant se apaga en silencio.
 */
const rutaEnv = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL_OWNER ?? '',
  },
});
