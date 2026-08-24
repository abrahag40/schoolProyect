#!/usr/bin/env node
/**
 * Crea (idempotente) el rol de aplicacion azahar_app y le otorga permisos.
 *
 * POR QUE EXISTE ESTE SCRIPT — la leccion mas cara que heredamos:
 * el usuario dueno de la base tiene BYPASSRLS. Si la aplicacion (o peor: las
 * pruebas) se conectan con el dueno, las politicas RLS NO se evaluan y el
 * sistema parece aislado cuando no lo esta. Un test de aislamiento corriendo
 * con el dueno da verde SIEMPRE y no prueba nada.
 *
 * Por eso el rol de aplicacion es NOSUPERUSER + NOBYPASSRLS explicito, y es el
 * unico que usan runtime y pruebas. El dueno solo migra.
 *
 * Uso:
 *   node scripts/ensure-app-role.mjs               (crea rol + permisos)
 *   node scripts/ensure-app-role.mjs --grants-only (solo re-otorga permisos)
 */
import pg from 'pg';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// El script se invoca desde varios directorios (raiz, paquete, CI). Cargar el
// .env aqui evita depender de que quien llama recuerde exportar variables.
const rutaEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

const URL_OWNER = process.env.DATABASE_URL_OWNER;
if (!URL_OWNER) {
  console.error('[db] Falta DATABASE_URL_OWNER. Copia .env.example a .env.');
  process.exit(1);
}

// La contrasena del rol de app se deriva de DATABASE_URL para que .env sea la
// unica fuente y no haya dos lugares que puedan desincronizarse.
const urlApp = new URL(process.env.DATABASE_URL ?? '');
const usuarioApp = decodeURIComponent(urlApp.username || 'azahar_app');
const passwordApp = decodeURIComponent(urlApp.password || '');

if (!passwordApp) {
  console.error('[db] DATABASE_URL debe incluir la contrasena del rol de aplicacion.');
  process.exit(1);
}

const soloGrants = process.argv.includes('--grants-only');
const cliente = new pg.Client({ connectionString: URL_OWNER });
await cliente.connect();

try {
  if (!soloGrants) {
    // CREATE ROLE no admite IF NOT EXISTS: se resuelve con un bloque DO.
    await cliente.query(
      `DO $$
       BEGIN
         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $rol$${usuarioApp}$rol$) THEN
           EXECUTE format(
             'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOINHERIT',
             $rol$${usuarioApp}$rol$, $pw$${passwordApp}$pw$
           );
         ELSE
           EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS',
             $rol$${usuarioApp}$rol$, $pw$${passwordApp}$pw$);
         END IF;
       END $$;`,
    );
    console.log(`[db] rol ${usuarioApp} listo (NOSUPERUSER, NOBYPASSRLS)`);
  }

  // Permisos de datos, nunca de esquema: el rol de app no puede alterar tablas.
  await cliente.query(`GRANT USAGE ON SCHEMA public TO "${usuarioApp}"`);
  await cliente.query(
    `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${usuarioApp}"`,
  );
  await cliente.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO "${usuarioApp}"`);
  // Sin esto, cada tabla nueva nacería inaccesible para la app y el fallo
  // aparecería en el sprint siguiente, lejos de su causa.
  await cliente.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public
       GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "${usuarioApp}"`,
  );
  await cliente.query(
    `ALTER DEFAULT PRIVILEGES IN SCHEMA public
       GRANT USAGE, SELECT ON SEQUENCES TO "${usuarioApp}"`,
  );

  // Funciones SECURITY DEFINER de superficie minima (p.ej. resolver la escuela
  // por slug en el login). Se otorgan una por una a proposito: un GRANT masivo
  // sobre ALL FUNCTIONS haria que cualquier funcion privilegiada futura quedara
  // expuesta al rol de aplicacion sin que nadie lo decidiera.
  const funcionesPermitidas = ['resolver_escuela_por_slug(text)'];
  for (const firma of funcionesPermitidas) {
    const { rows } = await cliente.query(
      `SELECT 1 FROM pg_proc WHERE proname = $1 AND pronamespace = 'public'::regnamespace`,
      [firma.split('(')[0]],
    );
    if (rows.length > 0) {
      await cliente.query(`GRANT EXECUTE ON FUNCTION ${firma} TO "${usuarioApp}"`);
      console.log(`[db] EXECUTE otorgado sobre ${firma}`);
    }
  }
  console.log(`[db] permisos otorgados a ${usuarioApp} (incluye tablas futuras)`);
} finally {
  await cliente.end();
}
