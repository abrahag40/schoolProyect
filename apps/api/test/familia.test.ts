/**
 * La app de familias, probada por el camino real (§13).
 *
 * Cubre lo que el Sprint 2 promete: que un tutor entre, vea SOLO a sus hijos,
 * que la sesion de la web viva en una cookie que JavaScript no puede leer, y
 * que la tuberia de notificaciones registre dispositivos de verdad.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { ModuloApp } from '../src/app.module.js';

const ID_COLEGIO = '51111111-1111-4111-8111-111111111111';
const ID_ACADEMIA = '52222222-2222-4222-8222-222222222222';
const CONTRASENA = 'prueba-familia-2026';

/** Lo que devuelve `GET /mis-hijos`. Declarado para que el compilador proteja
 *  cada afirmacion en vez de arrastrar datos sin tipo. */
interface HijoRespuesta {
  id: string;
  nombre: string;
  apellidos: string;
  cohorte: { nombre: string; tipo: string } | null;
  sede: string | null;
  escuela: string;
  parentesco: string;
  soyPagador: boolean;
}

let app: INestApplication;
let base: string;
let owner: pg.Client;

beforeAll(async () => {
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL_OWNER });
  await owner.connect();
  for (const t of [
    'plataforma.evento',
    'plataforma.cliente',
    'plataforma.miembro',
    'plataforma.socio',
    'dispositivo_push',
    'tutor_alumno',
    'consentimiento',
    'tutor',
    'inscripcion',
    'alumno',
    'cohorte',
    'periodo',
    'aviso_privacidad',
    'usuario_rol',
    'usuario',
    'sede',
    'tenant',
  ]) {
    await owner.query(`DELETE FROM ${t}`);
  }

  const h = await hash(CONTRASENA, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });

  await owner.query(
    `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn") VALUES
       ($1,'Colegio F','colegio-f','COLEGIO',true,now()),
       ($2,'Academia F','academia-f','ACADEMIA_DEPORTIVA',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const { rows: sedes } = await owner.query(
    `INSERT INTO sede (id, tenant_id, nombre, activa, "creadaEn") VALUES
       (gen_random_uuid(),$1,'Campus F',true,now()),
       (gen_random_uuid(),$2,'Cancha F',true,now()) RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const sedeCol = sedes.find((s) => s.tenant_id === ID_COLEGIO)!.id;
  const sedeAca = sedes.find((s) => s.tenant_id === ID_ACADEMIA)!.id;

  const { rows: periodos } = await owner.query(
    `INSERT INTO periodo (id, tenant_id, nombre, tipo, inicio, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Ciclo F','CICLO_ESCOLAR','2026-08-01',true,now()),
       (gen_random_uuid(),$2,'Temporada F','TEMPORADA','2026-09-01',true,now())
     RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const { rows: cohortes } = await owner.query(
    `INSERT INTO cohorte (id, tenant_id, periodo_id, sede_id, nombre, tipo, orden, activa, creada_en) VALUES
       (gen_random_uuid(),$1,$3,$5,'2o B','GRADO',2,true,now()),
       (gen_random_uuid(),$2,$4,$6,'Sub-14','CATEGORIA',14,true,now())
     RETURNING id, tenant_id`,
    [
      ID_COLEGIO,
      ID_ACADEMIA,
      periodos.find((p) => p.tenant_id === ID_COLEGIO)!.id,
      periodos.find((p) => p.tenant_id === ID_ACADEMIA)!.id,
      sedeCol,
      sedeAca,
    ],
  );

  // Dos hermanos en el colegio y un tercer alumno en la academia.
  const { rows: alumnos } = await owner.query(
    `INSERT INTO alumno (id, tenant_id, nombre, apellidos, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Ana','Perez',true,now()),
       (gen_random_uuid(),$1,'Luis','Perez',true,now()),
       (gen_random_uuid(),$2,'Otro','Ajeno',true,now())
     RETURNING id, tenant_id, nombre`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  for (const a of alumnos) {
    await owner.query(
      `INSERT INTO inscripcion (id, tenant_id, alumno_id, cohorte_id, estado, alta_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'ACTIVA',now())`,
      [a.tenant_id, a.id, cohortes.find((c) => c.tenant_id === a.tenant_id)!.id],
    );
  }

  // Tres cuentas: una madre con dos hijos, una madre de otra escuela, y staff.
  const { rows: usuarios } = await owner.query(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn") VALUES
       (gen_random_uuid(),$1,'madre@f.mx',$3,'Madre Perez',true,now()),
       (gen_random_uuid(),$2,'madre@f.mx',$3,'Madre Ajena',true,now()),
       (gen_random_uuid(),$1,'staff@f.mx',$3,'Directora F',true,now())
     RETURNING id, tenant_id, email`,
    [ID_COLEGIO, ID_ACADEMIA, h],
  );
  for (const u of usuarios) {
    await owner.query(
      `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3::"Rol",now())`,
      [u.tenant_id, u.id, u.email === 'staff@f.mx' ? 'DIRECTOR' : 'TUTOR'],
    );
  }

  for (const u of usuarios.filter((x) => x.email === 'madre@f.mx')) {
    const { rows: tutor } = await owner.query(
      `INSERT INTO tutor (id, tenant_id, nombre, apellidos, email, usuario_id, creado_en)
       VALUES (gen_random_uuid(),$1,'Madre','F','madre@f.mx',$2,now()) RETURNING id`,
      [u.tenant_id, u.id],
    );
    for (const a of alumnos.filter((x) => x.tenant_id === u.tenant_id)) {
      await owner.query(
        `INSERT INTO tutor_alumno
           (id, tenant_id, tutor_id, alumno_id, parentesco, es_pagador, creado_en)
         VALUES (gen_random_uuid(),$1,$2,$3,'MADRE',true,now())`,
        [u.tenant_id, tutor[0].id, a.id],
      );
    }
  }

  app = await NestFactory.create(ModuloApp, { logger: false });
  await app.listen(0);
  base = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  await owner?.end();
});

async function login(escuela: string, email: string) {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ escuela, email, contrasena: CONTRASENA }),
  });
  return {
    estado: r.status,
    // Tipado en la frontera: de aqui en adelante el compilador protege.
    cuerpo: (await r.json()) as { token: string },
    // La cookie tal como el navegador la recibiria.
    cookie: r.headers.get('set-cookie') ?? '',
  };
}

describe('sesion por cookie (deuda del Sprint 0, pagada)', () => {
  it('el login emite una cookie que JavaScript no puede leer', async () => {
    const { cookie } = await login('colegio-f', 'madre@f.mx');
    expect(cookie).toContain('azahar_sesion=');
    // HttpOnly es toda la razon del cambio: sin este atributo, un script
    // inyectado podria robar la sesion como pasaba con sessionStorage.
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//i);
  });

  it('la cookie sola basta para entrar: no hace falta el encabezado', async () => {
    const { cookie } = await login('colegio-f', 'madre@f.mx');
    const soloCookie = cookie.split(';')[0]!;

    const r = await fetch(`${base}/mis-hijos`, { headers: { Cookie: soloCookie } });
    expect(r.status).toBe(200);
  });

  it('cerrar sesion retira la cookie del navegador', async () => {
    // El Content-Type es obligatorio desde el 4-sep-2026: cerrar la sesion es
    // un POST que muta, y forzar el cierre de sesion ajena es CSRF de manual.
    // Sin el encabezado el API responde 415 (ver `exigir-json.middleware.ts`).
    const r = await fetch(`${base}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(r.status).toBe(204);
    const cookie = r.headers.get('set-cookie') ?? '';
    // Se vacia y se expira: el navegador la borra de verdad.
    expect(cookie).toContain('azahar_sesion=;');
  });

  it('la app movil sigue entrando con el encabezado (cada superficie, su mecanismo)', async () => {
    const { cuerpo } = await login('colegio-f', 'madre@f.mx');
    const r = await fetch(`${base}/mis-hijos`, {
      headers: { Authorization: `Bearer ${cuerpo.token}` },
    });
    expect(r.status).toBe(200);
  });
});

describe('mis hijos', () => {
  it('una madre ve a sus dos hijos, con su grupo y su escuela', async () => {
    const { cuerpo } = await login('colegio-f', 'madre@f.mx');
    const r = await fetch(`${base}/mis-hijos`, {
      headers: { Authorization: `Bearer ${cuerpo.token}` },
    });
    const hijos = (await r.json()) as HijoRespuesta[];

    expect(hijos).toHaveLength(2);
    expect(hijos.map((h) => h.nombre).sort()).toEqual(['Ana', 'Luis']);
    expect(hijos[0]!.cohorte).toMatchObject({ nombre: '2o B', tipo: 'GRADO' });
    expect(hijos[0]!.escuela).toBe('Colegio F');
    expect(hijos[0]!.parentesco).toBe('MADRE');
    expect(hijos[0]!.soyPagador).toBe(true);
  });

  it('el mismo correo en otra escuela devuelve a OTRA familia', async () => {
    const { cuerpo } = await login('academia-f', 'madre@f.mx');
    const r = await fetch(`${base}/mis-hijos`, {
      headers: { Authorization: `Bearer ${cuerpo.token}` },
    });
    const hijos = (await r.json()) as HijoRespuesta[];
    expect(hijos).toHaveLength(1);
    expect(hijos[0]!.nombre).toBe('Otro');
    // La cohorte habla el idioma de SU vertical.
    expect(hijos[0]!.cohorte!.tipo).toBe('CATEGORIA');
    // Y no hay rastro de los alumnos de la otra escuela.
    expect(JSON.stringify(hijos)).not.toContain('Perez');
  });

  it('el personal de la escuela NO entra por la puerta de las familias', async () => {
    // Ver a todos los alumnos jamas debe salir por el endpoint de "mis hijos".
    const { cuerpo } = await login('colegio-f', 'staff@f.mx');
    const r = await fetch(`${base}/mis-hijos`, {
      headers: { Authorization: `Bearer ${cuerpo.token}` },
    });
    expect(r.status).toBe(403);
  });

  it('sin sesion no se entra', async () => {
    const r = await fetch(`${base}/mis-hijos`);
    expect(r.status).toBe(401);
  });
});

describe('notificaciones', () => {
  it('registra el dispositivo y el envio de prueba lo alcanza', async () => {
    const { cuerpo } = await login('colegio-f', 'madre@f.mx');
    const auth = { Authorization: `Bearer ${cuerpo.token}`, 'Content-Type': 'application/json' };

    const registro = await fetch(`${base}/notificaciones/dispositivo`, {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ token: 'ExponentPushToken[prueba-001]', plataforma: 'ANDROID' }),
    });
    expect(registro.status).toBe(200);

    // Se verifica el EFECTO (§14): que el envio reporte haber alcanzado al
    // dispositivo, no que el endpoint devuelva ok.
    const envio = await fetch(`${base}/notificaciones/prueba`, { method: 'POST', headers: auth });
    expect(await envio.json()).toMatchObject({ dispositivos: 1, enviados: 1, fallidos: 0 });
  });

  it('re-registrar el mismo dispositivo no lo duplica', async () => {
    // El sistema operativo devuelve el mismo token en cada arranque: si esto
    // duplicara, la familia recibiria cada aviso dos veces.
    const { cuerpo } = await login('colegio-f', 'madre@f.mx');
    const auth = { Authorization: `Bearer ${cuerpo.token}`, 'Content-Type': 'application/json' };
    const cuerpoReg = JSON.stringify({
      token: 'ExponentPushToken[prueba-001]',
      plataforma: 'ANDROID',
    });

    await fetch(`${base}/notificaciones/dispositivo`, {
      method: 'POST',
      headers: auth,
      body: cuerpoReg,
    });
    await fetch(`${base}/notificaciones/dispositivo`, {
      method: 'POST',
      headers: auth,
      body: cuerpoReg,
    });

    const envio = await fetch(`${base}/notificaciones/prueba`, { method: 'POST', headers: auth });
    const resumen = (await envio.json()) as { dispositivos: number };
    expect(resumen.dispositivos).toBe(1);
  });

  it('un token con formato invalido se rechaza con 400, no con 500', async () => {
    // Un 500 diria "el servidor fallo" cuando el que se equivoco fue el
    // cliente: ensucia el monitoreo y no le dice al integrador que corregir.
    // Este defecto existio y se corrigio en este mismo sprint.
    const { cuerpo } = await login('colegio-f', 'madre@f.mx');
    const r = await fetch(`${base}/notificaciones/dispositivo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cuerpo.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'no-es-un-token', plataforma: 'ANDROID' }),
    });

    expect(r.status).toBe(400);
    const error = (await r.json()) as { detalles: Array<{ campo: string; mensaje: string }> };
    // Y el detalle dice QUE campo y POR QUE, en lenguaje de persona.
    expect(error.detalles[0]).toMatchObject({ campo: 'token' });
    expect(error.detalles[0]!.mensaje).toMatch(/no es valido/i);
  });
});
