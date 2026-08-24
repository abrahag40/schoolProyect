/**
 * Pruebas de la API por el CAMINO REAL (regla del guard cableado, §13).
 *
 * No se prueban los servicios llamandolos directamente: se levanta la
 * aplicacion completa y se le hacen peticiones HTTP, porque una regla que
 * decide bien pero no esta cableada al router es una regla escrita, no
 * entregada. El defecto que esta regla previene es el clasico: la logica
 * existe, pasa sus pruebas, y nadie la invoca en produccion.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { ModuloApp } from '../src/app.module.js';

const ID_COLEGIO = '31111111-1111-4111-8111-111111111111';
const ID_ACADEMIA = '32222222-2222-4222-8222-222222222222';
const CONTRASENA = 'prueba-azahar-2026';

let app: INestApplication;
let base: string;
let owner: pg.Client;

beforeAll(async () => {
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL_OWNER });
  await owner.connect();
  await owner.query('DELETE FROM usuario');
  await owner.query('DELETE FROM sede');
  await owner.query('DELETE FROM tenant');

  const h = await hash(CONTRASENA, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });
  await owner.query(
    `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn") VALUES
       ($1,'Colegio Prueba','colegio-prueba','COLEGIO',true,now()),
       ($2,'Academia Prueba','academia-prueba','ACADEMIA_DEPORTIVA',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  await owner.query(
    `INSERT INTO sede (id, tenant_id, nombre, cct, rvoe, activa, "creadaEn") VALUES
       (gen_random_uuid(),$1,'Campus Unico','31PPR9999Z','ACUERDO 999/2024',true,now()),
       (gen_random_uuid(),$2,'Cancha Unica',NULL,NULL,true,now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  await owner.query(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, rol, activo, "creadoEn") VALUES
       (gen_random_uuid(),$1,'admin@prueba.mx',$3,'Admin Colegio','DIRECTOR',true,now()),
       (gen_random_uuid(),$2,'admin@prueba.mx',$3,'Admin Academia','DUENO',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA, h],
  );

  app = await NestFactory.create(ModuloApp, { logger: false });
  await app.listen(0); // puerto libre: no choca con la API de desarrollo
  base = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  await owner?.end();
});

async function login(escuela: string, email = 'admin@prueba.mx', contrasena = CONTRASENA) {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ escuela, email, contrasena }),
  });
  return { estado: r.status, cuerpo: await r.json().catch(() => null) };
}

describe('salud', () => {
  it('la sonda consulta la base, no solo responde 200', async () => {
    const r = await fetch(`${base}/salud`);
    expect(r.status).toBe(200);
    // Si solo devolviera {ok:true} sin tocar la base, el balanceador creeria
    // sano a un proceso incapaz de leer datos.
    expect(await r.json()).toMatchObject({ estado: 'ok', baseDatos: 'ok' });
  });
});

describe('inicio de sesion', () => {
  it('entra con credenciales correctas y el token trae su escuela', async () => {
    const { estado, cuerpo } = await login('colegio-prueba');
    expect(estado).toBe(200);
    expect(cuerpo.usuario.nombre).toBe('Admin Colegio');
    expect(cuerpo.escuela.nombre).toBe('Colegio Prueba');
    expect(typeof cuerpo.token).toBe('string');
  });

  it('el mismo correo en otra escuela devuelve a OTRA persona', async () => {
    const { cuerpo } = await login('academia-prueba');
    expect(cuerpo.usuario.nombre).toBe('Admin Academia');
  });

  it('rechaza contrasena incorrecta', async () => {
    const { estado } = await login('colegio-prueba', 'admin@prueba.mx', 'incorrecta');
    expect(estado).toBe(401);
  });

  it('rechaza una escuela que no existe', async () => {
    const { estado } = await login('escuela-inventada');
    expect(estado).toBe(401);
  });

  it('no permite enumerar: el mensaje es identico en los tres fracasos', async () => {
    // Si el mensaje distinguiera "esa escuela no existe" de "esa contrasena es
    // incorrecta", cualquiera podria averiguar que escuelas y que correos son
    // reales probando combinaciones.
    const a = await login('escuela-inventada');
    const b = await login('colegio-prueba', 'nadie@prueba.mx');
    const c = await login('colegio-prueba', 'admin@prueba.mx', 'incorrecta');
    expect(a.cuerpo.message).toBe(b.cuerpo.message);
    expect(b.cuerpo.message).toBe(c.cuerpo.message);
  });

  it('valida el cuerpo en el borde: correo mal formado no llega al dominio', async () => {
    const r = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ escuela: 'colegio-prueba', email: 'no-es-correo', contrasena: 'x' }),
    });
    expect(r.status).toBeGreaterThanOrEqual(400);
  });
});

describe('datos protegidos', () => {
  it('sin token no se entra (deny-by-default)', async () => {
    const r = await fetch(`${base}/mi-escuela`);
    expect(r.status).toBe(401);
  });

  it('con un token manipulado no se entra', async () => {
    const { cuerpo } = await login('colegio-prueba');
    const manipulado = cuerpo.token.slice(0, -4) + 'aaaa';
    const r = await fetch(`${base}/mi-escuela`, {
      headers: { Authorization: `Bearer ${manipulado}` },
    });
    expect(r.status).toBe(401);
  });

  it('cada token alcanza unicamente los datos de SU escuela', async () => {
    const colegio = await login('colegio-prueba');
    const academia = await login('academia-prueba');

    const rc = await fetch(`${base}/mi-escuela`, {
      headers: { Authorization: `Bearer ${colegio.cuerpo.token}` },
    });
    const ra = await fetch(`${base}/mi-escuela`, {
      headers: { Authorization: `Bearer ${academia.cuerpo.token}` },
    });

    const dc = await rc.json();
    const da = await ra.json();

    expect(dc.escuela.nombre).toBe('Colegio Prueba');
    expect(dc.sedes).toHaveLength(1);
    expect(dc.sedes[0].nombre).toBe('Campus Unico');

    expect(da.escuela.nombre).toBe('Academia Prueba');
    expect(da.sedes[0].nombre).toBe('Cancha Unica');

    // Ninguna respuesta contiene rastro de la otra escuela.
    expect(JSON.stringify(dc)).not.toContain('Cancha');
    expect(JSON.stringify(da)).not.toContain('Campus');
  });

  it('los datos fiscales viajan cuando aplican y son nulos cuando no', async () => {
    // Una academia deportiva no tiene clave SEP ni RVOE: el modelo lo admite
    // sin inventar valores vacios, y la API los expone como null explicito.
    const academia = await login('academia-prueba');
    const r = await fetch(`${base}/mi-escuela`, {
      headers: { Authorization: `Bearer ${academia.cuerpo.token}` },
    });
    const datos = await r.json();
    expect(datos.sedes[0].cct).toBeNull();
    expect(datos.sedes[0].rvoe).toBeNull();

    const colegio = await login('colegio-prueba');
    const r2 = await fetch(`${base}/mi-escuela`, {
      headers: { Authorization: `Bearer ${colegio.cuerpo.token}` },
    });
    const datos2 = await r2.json();
    expect(datos2.sedes[0].cct).toBe('31PPR9999Z');
    expect(datos2.sedes[0].rvoe).toBe('ACUERDO 999/2024');
  });

  it('la respuesta no filtra columnas internas (contrato explicito, §31)', async () => {
    const colegio = await login('colegio-prueba');
    const r = await fetch(`${base}/mi-escuela`, {
      headers: { Authorization: `Bearer ${colegio.cuerpo.token}` },
    });
    const texto = await r.text();
    expect(texto).not.toContain('password_hash');
    expect(texto).not.toContain('passwordHash');
    expect(texto).not.toContain('tenant_id');
  });
});
