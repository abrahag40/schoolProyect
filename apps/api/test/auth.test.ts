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

/** Lo que responde el login y `GET /mi-escuela`. Declarado una vez, para que el
 *  compilador proteja cada afirmacion en vez de arrastrar datos sin tipo. */
interface SesionRespuesta {
  token: string;
  usuario: { id: string; nombre: string; roles: string[] };
  escuela: { id: string; nombre: string; vertical: string };
  /// Presente solo cuando el login RECHAZA. El mensaje es generico a proposito.
  message?: string;
}

interface EscuelaRespuesta {
  escuela: { nombre: string; vertical: string } | null;
  sedes: Array<{
    id: string;
    nombre: string;
    cct: string | null;
    rvoes: Array<{ nivelEducativo: string; acuerdo: string }>;
  }>;
  misRoles: string[];
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
    'tutor_alumno',
    'consentimiento',
    'tutor',
    'inscripcion',
    'alumno',
    'cohorte',
    'periodo',
    'aviso_privacidad',
    'rvoe',
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
       ($1,'Colegio Prueba','colegio-prueba','COLEGIO',true,now()),
       ($2,'Academia Prueba','academia-prueba','ACADEMIA_DEPORTIVA',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const { rows: sedes } = await owner.query(
    `INSERT INTO sede (id, tenant_id, nombre, cct, activa, "creadaEn") VALUES
       (gen_random_uuid(),$1,'Campus Unico','31PPR9999Z',true,now()),
       (gen_random_uuid(),$2,'Cancha Unica',NULL,true,now())
     RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  // El RVOE vive en su propia tabla desde el Sprint 6: se otorga por NIVEL, no
  // por plantel (AZ-A1). La academia no tiene ninguno, que es su caso real.
  await owner.query(
    `INSERT INTO rvoe (id, tenant_id, sede_id, nivel_educativo, acuerdo, creado_en)
     VALUES (gen_random_uuid(), $1, $2, 'PRIMARIA', 'ACUERDO 999/2024', now())`,
    [ID_COLEGIO, sedes.find((s) => s.tenant_id === ID_COLEGIO)!.id],
  );
  await owner.query(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn") VALUES
       (gen_random_uuid(),$1,'admin@prueba.mx',$3,'Admin Colegio',true,now()),
       (gen_random_uuid(),$2,'admin@prueba.mx',$3,'Admin Academia',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA, h],
  );
  // Roles multiples: la persona del colegio administra Y da clase (AZ-M1.3).
  await owner.query(
    `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
     SELECT gen_random_uuid(), u.tenant_id, u.id, r.rol::"Rol", now()
       FROM usuario u
       CROSS JOIN LATERAL (VALUES ('ADMIN'), ('DOCENTE')) AS r(rol)
      WHERE u.tenant_id = $1`,
    [ID_COLEGIO],
  );
  await owner.query(
    `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
     SELECT gen_random_uuid(), u.tenant_id, u.id, 'DUENO', now()
       FROM usuario u WHERE u.tenant_id = $1`,
    [ID_ACADEMIA],
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
  // Tipado en la frontera de red: de aqui en adelante el compilador protege.
  return { estado: r.status, cuerpo: (await r.json().catch(() => null)) as SesionRespuesta };
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

    const dc = (await rc.json()) as EscuelaRespuesta;
    const da = (await ra.json()) as EscuelaRespuesta;

    expect(dc.escuela!.nombre).toBe('Colegio Prueba');
    expect(dc.sedes).toHaveLength(1);
    expect(dc.sedes[0]!.nombre).toBe('Campus Unico');

    expect(da.escuela!.nombre).toBe('Academia Prueba');
    expect(da.sedes[0]!.nombre).toBe('Cancha Unica');

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
    const datos = (await r.json()) as EscuelaRespuesta;
    expect(datos.sedes[0]!.cct).toBeNull();
    // Una academia deportiva no tiene RVOE: la lista viene vacia, no con nulos.
    expect(datos.sedes[0]!.rvoes).toEqual([]);

    const colegio = await login('colegio-prueba');
    const r2 = await fetch(`${base}/mi-escuela`, {
      headers: { Authorization: `Bearer ${colegio.cuerpo.token}` },
    });
    const datos2 = (await r2.json()) as EscuelaRespuesta;
    expect(datos2.sedes[0]!.cct).toBe('31PPR9999Z');
    expect(datos2.sedes[0]!.rvoes).toEqual([
      { nivelEducativo: 'PRIMARIA', acuerdo: 'ACUERDO 999/2024' },
    ]);
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
