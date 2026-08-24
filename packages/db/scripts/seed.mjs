#!/usr/bin/env node
/**
 * Datos de demostracion del Sprint 0: DOS escuelas de verticales distintas.
 *
 * No son dos filas cualquiera: un colegio K-12 y una academia deportiva en la
 * MISMA instalacion es la prueba viva de la tesis multi-vertical del producto
 * (Definicion de Producto, opcion C). Si el modelo solo sirviera para colegios,
 * este seed no se podria escribir.
 *
 * Se ejecuta con el rol dueno porque sembrar no es lo que se esta probando.
 */
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rutaEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

const OPCIONES_HASH = { memoryCost: 19_456, timeCost: 2, parallelism: 1 };
const CONTRASENA_DEMO = 'azahar-demo-2026';

const cliente = new pg.Client({ connectionString: process.env.DATABASE_URL_OWNER });
await cliente.connect();

try {
  await cliente.query('DELETE FROM usuario');
  await cliente.query('DELETE FROM sede');
  await cliente.query('DELETE FROM tenant');

  const hashDemo = await hash(CONTRASENA_DEMO, OPCIONES_HASH);

  const escuelas = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      nombre: 'Colegio Azahar',
      slug: 'colegio-azahar',
      vertical: 'COLEGIO',
      sedes: [
        { nombre: 'Campus Norte', cct: '31PPR0001A', rvoe: 'ACUERDO 123/2024' },
        { nombre: 'Campus Sur', cct: '31PPR0002B', rvoe: 'ACUERDO 124/2024' },
      ],
      usuario: { email: 'directora@colegioazahar.mx', nombre: 'Lucia Mendoza', rol: 'DIRECTOR' },
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      nombre: 'Academia Azahar FC',
      slug: 'academia-azahar',
      vertical: 'ACADEMIA_DEPORTIVA',
      // Una academia no tiene CCT ni RVOE: los campos son opcionales por eso,
      // no por descuido del modelo.
      sedes: [{ nombre: 'Cancha Principal', cct: null, rvoe: null }],
      usuario: { email: 'coach@academiaazahar.mx', nombre: 'Rene Palacios', rol: 'DUENO' },
    },
  ];

  for (const e of escuelas) {
    await cliente.query(
      `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn")
       VALUES ($1, $2, $3, $4::"Vertical", true, now())`,
      [e.id, e.nombre, e.slug, e.vertical],
    );
    for (const s of e.sedes) {
      await cliente.query(
        `INSERT INTO sede (id, tenant_id, nombre, cct, rvoe, activa, "creadaEn")
         VALUES (gen_random_uuid(), $1, $2, $3, $4, true, now())`,
        [e.id, s.nombre, s.cct, s.rvoe],
      );
    }
    await cliente.query(
      `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, rol, activo, "creadoEn")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::"Rol", true, now())`,
      [e.id, e.usuario.email, hashDemo, e.usuario.nombre, e.usuario.rol],
    );
    console.log(`[seed] ${e.nombre} (${e.vertical}) — ${e.usuario.email}`);
  }

  console.log(`[seed] listo. Contrasena de ambas cuentas demo: ${CONTRASENA_DEMO}`);
} finally {
  await cliente.end();
}
