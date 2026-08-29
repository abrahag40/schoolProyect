/**
 * El pase de lista y el motor de avisos, por el camino real (§13 capa 3).
 *
 * Corre contra Postgres con el rol restringido y sobre HTTP: la maestra guarda
 * la lista y se verifica que a la madre le LLEGA el aviso — el EFECTO, no un
 * `ok: true` (§14). Es la prueba que sostiene el Sprint Goal completo.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { ModuloApp } from '../src/app.module.js';

const ID_COLEGIO = '61111111-1111-4111-8111-111111111111';
const ID_ACADEMIA = '62222222-2222-4222-8222-222222222222';
const CONTRASENA = 'prueba-asistencia-2026';

/** Contratos de lo que responde el API, declarados una vez. */
interface GruposRespuesta {
  hoy: string;
  grupos: Array<{
    id: string;
    nombre: string;
    tipo: string;
    inscritos: number;
    listaDeHoy: boolean;
  }>;
}

interface ListaRespuesta {
  cohorte: { id: string; nombre: string; tipo: string; sede: string };
  fecha: string;
  yaRegistrada: boolean;
  alumnos: Array<{ alumnoId: string; nombre: string; apellidos: string; estado: string | null }>;
}

interface PaseListaRespuesta {
  fecha: string;
  guardados: number;
  resumen: { presentes: number; ausentes: number; retardos: number; justificadas: number };
  avisosGenerados: number;
}

let app: INestApplication;
let base: string;
let owner: pg.Client;

const ids: Record<string, string> = {};

/** El "hoy" de la escuela, calculado como lo calcula el servicio. */
const HOY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

function diasAtras(n: number): string {
  const d = new Date(`${HOY}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

// Una fecha distinta por escenario: la clave de idempotencia lleva el dia, asi
// que fechas separadas mantienen los casos independientes entre si.
const F_ANA = diasAtras(9);
const F_LUIS = [diasAtras(8), diasAtras(7), diasAtras(6)];
const F_RETARDO = diasAtras(5);
const F_CORRECCION = diasAtras(4);
const F_PUSH = diasAtras(3);

beforeAll(async () => {
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL_OWNER });
  await owner.connect();
  for (const t of [
    'plataforma.evento',
    'plataforma.cliente',
    'plataforma.miembro',
    'plataforma.socio',
    'notificacion',
    'asistencia',
    'asignacion_docente',
    'configuracion_escuela',
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
  await owner.query('TRUNCATE evento_auditoria');

  const h = await hash(CONTRASENA, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });

  await owner.query(
    `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn") VALUES
       ($1,'Colegio A','colegio-a','COLEGIO',true,now()),
       ($2,'Academia A','academia-a','ACADEMIA_DEPORTIVA',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  // Parametros explicitos: la prueba no debe depender de los valores por
  // omision del codigo, o cambiarlos la volveria roja sin que nada se rompa.
  for (const t of [ID_COLEGIO, ID_ACADEMIA]) {
    await owner.query(
      `INSERT INTO configuracion_escuela
         (id, tenant_id, umbral_faltas, ventana_dias, avisar_falta_del_dia, zona_horaria, actualizado_en)
       VALUES (gen_random_uuid(), $1, 3, 30, true, 'America/Mexico_City', now())`,
      [t],
    );
  }

  const { rows: sedes } = await owner.query(
    `INSERT INTO sede (id, tenant_id, nombre, activa, "creadaEn") VALUES
       (gen_random_uuid(),$1,'Campus A',true,now()),
       (gen_random_uuid(),$2,'Cancha A',true,now()) RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const { rows: periodos } = await owner.query(
    `INSERT INTO periodo (id, tenant_id, nombre, tipo, inicio, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Ciclo A','CICLO_ESCOLAR','2026-08-01',true,now()),
       (gen_random_uuid(),$2,'Temporada A','TEMPORADA','2026-08-01',true,now())
     RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const sede = (t: string) => sedes.find((s) => s.tenant_id === t)!.id;
  const periodo = (t: string) => periodos.find((p) => p.tenant_id === t)!.id;

  const { rows: cohortes } = await owner.query(
    `INSERT INTO cohorte (id, tenant_id, periodo_id, sede_id, nombre, tipo, orden, activa, creada_en) VALUES
       (gen_random_uuid(),$1,$3,$5,'1o A','GRADO',1,true,now()),
       (gen_random_uuid(),$1,$3,$5,'2o A','GRADO',2,true,now()),
       (gen_random_uuid(),$2,$4,$6,'Sub-12','CATEGORIA',12,true,now())
     RETURNING id, nombre`,
    [
      ID_COLEGIO,
      ID_ACADEMIA,
      periodo(ID_COLEGIO),
      periodo(ID_ACADEMIA),
      sede(ID_COLEGIO),
      sede(ID_ACADEMIA),
    ],
  );
  ids.primeroA = cohortes.find((c) => c.nombre === '1o A')!.id;
  ids.segundoA = cohortes.find((c) => c.nombre === '2o A')!.id;
  ids.sub12 = cohortes.find((c) => c.nombre === 'Sub-12')!.id;

  const { rows: alumnos } = await owner.query(
    `INSERT INTO alumno (id, tenant_id, nombre, apellidos, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Ana','Perez',true,now()),
       (gen_random_uuid(),$1,'Luis','Perez',true,now()),
       (gen_random_uuid(),$1,'Rosa','Perez',true,now()),
       (gen_random_uuid(),$1,'Otro','Ajeno',true,now())
     RETURNING id, nombre`,
    [ID_COLEGIO],
  );
  for (const a of alumnos) ids[a.nombre.toLowerCase()] = a.id;

  for (const [alumno, cohorte] of [
    ['ana', ids.primeroA!],
    ['luis', ids.primeroA!],
    ['rosa', ids.primeroA!],
    ['otro', ids.segundoA!],
  ] as const) {
    await owner.query(
      `INSERT INTO inscripcion (id, tenant_id, alumno_id, cohorte_id, estado, alta_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'ACTIVA',now())`,
      [ID_COLEGIO, ids[alumno], cohorte],
    );
  }

  const { rows: usuarios } = await owner.query(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn") VALUES
       (gen_random_uuid(),$1,'maestra@t.mx',$3,'Maestra Nava',true,now()),
       (gen_random_uuid(),$1,'dir@t.mx',$3,'Directora A',true,now()),
       (gen_random_uuid(),$1,'madre@t.mx',$3,'Madre Perez',true,now()),
       (gen_random_uuid(),$1,'otra@t.mx',$3,'Otra Madre',true,now()),
       (gen_random_uuid(),$2,'coach@t.mx',$3,'Coach A',true,now())
     RETURNING id, email`,
    [ID_COLEGIO, ID_ACADEMIA, h],
  );
  const rolPorCorreo: Record<string, string> = {
    'maestra@t.mx': 'DOCENTE',
    'dir@t.mx': 'DIRECTOR',
    'madre@t.mx': 'TUTOR',
    'otra@t.mx': 'TUTOR',
    'coach@t.mx': 'DOCENTE',
  };
  for (const u of usuarios) {
    ids[u.email] = u.id;
    await owner.query(
      `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3::"Rol",now())`,
      [u.email === 'coach@t.mx' ? ID_ACADEMIA : ID_COLEGIO, u.id, rolPorCorreo[u.email]],
    );
  }

  // La maestra solo tiene 1o A. Es el corazon de la prueba de permisos.
  await owner.query(
    `INSERT INTO asignacion_docente (id, tenant_id, usuario_id, cohorte_id, titular, creada_en) VALUES
       (gen_random_uuid(),$1,$2,$3,true,now()),
       (gen_random_uuid(),$4,$5,$6,true,now())`,
    [ID_COLEGIO, ids['maestra@t.mx'], ids.primeroA!, ID_ACADEMIA, ids['coach@t.mx'], ids.sub12!],
  );

  for (const [correo, hijos] of [
    ['madre@t.mx', ['ana', 'luis', 'rosa']],
    ['otra@t.mx', ['otro']],
  ] as const) {
    const { rows: tutor } = await owner.query(
      `INSERT INTO tutor (id, tenant_id, nombre, apellidos, email, usuario_id, creado_en)
       VALUES (gen_random_uuid(),$1,'Tutora','T',$2,$3,now()) RETURNING id`,
      [ID_COLEGIO, correo, ids[correo]],
    );
    for (const hijo of hijos) {
      await owner.query(
        `INSERT INTO tutor_alumno (id, tenant_id, tutor_id, alumno_id, parentesco, es_pagador, creado_en)
         VALUES (gen_random_uuid(),$1,$2,$3,'MADRE',true,now())`,
        [ID_COLEGIO, tutor[0].id, ids[hijo]],
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

async function entrar(escuela: string, email: string): Promise<string> {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ escuela, email, contrasena: CONTRASENA }),
  });
  return ((await r.json()) as { token: string }).token;
}

const conToken = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

async function pasarLista(
  token: string,
  cohorteId: string,
  fecha: string,
  registros: Array<{ alumnoId: string; estado: string }>,
) {
  const r = await fetch(`${base}/pase-lista`, {
    method: 'POST',
    headers: conToken(token),
    body: JSON.stringify({ cohorteId, fecha, registros }),
  });
  return { estado: r.status, cuerpo: (await r.json()) as PaseListaRespuesta };
}

async function avisosDe(token: string) {
  const r = await fetch(`${base}/mis-avisos`, { headers: conToken(token) });
  return (await r.json()) as Array<{ id: string; tipo: string; titulo: string; leida: boolean }>;
}

describe('mis grupos: quien ve que', () => {
  it('la maestra ve SOLO el grupo que tiene asignado', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const r = await fetch(`${base}/pase-lista/grupos`, { headers: conToken(token) });
    const cuerpo = (await r.json()) as GruposRespuesta & ListaRespuesta;

    expect(cuerpo.grupos).toHaveLength(1);
    expect(cuerpo.grupos[0]!).toMatchObject({ nombre: '1o A', tipo: 'GRADO', inscritos: 3 });
    // Y el "hoy" viene de la escuela: la pantalla no lo calcula por su cuenta.
    expect(cuerpo.hoy).toBe(HOY);
  });

  it('la direccion ve todos los grupos del periodo', async () => {
    const token = await entrar('colegio-a', 'dir@t.mx');
    const r = await fetch(`${base}/pase-lista/grupos`, { headers: conToken(token) });
    expect(((await r.json()) as GruposRespuesta).grupos).toHaveLength(2);
  });

  it('un tutor no entra al pase de lista', async () => {
    const token = await entrar('colegio-a', 'madre@t.mx');
    const r = await fetch(`${base}/pase-lista/grupos`, { headers: conToken(token) });
    expect(r.status).toBe(403);
  });

  it('sin sesion, nada', async () => {
    expect((await fetch(`${base}/pase-lista/grupos`)).status).toBe(401);
  });
});

describe('la lista de un grupo', () => {
  it('trae a los inscritos ordenados y sin estado previo', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const r = await fetch(`${base}/pase-lista/${ids.primeroA!}`, { headers: conToken(token) });
    const cuerpo = (await r.json()) as GruposRespuesta & ListaRespuesta;

    expect(cuerpo.cohorte).toMatchObject({ nombre: '1o A', sede: 'Campus A' });
    expect(cuerpo.yaRegistrada).toBe(false);
    expect(cuerpo.alumnos.map((a) => a.nombre)).toEqual(['Ana', 'Luis', 'Rosa']);
    expect(cuerpo.alumnos[0]!.estado).toBeNull();
  });

  it('la maestra NO puede abrir la lista de un grupo ajeno de su propia escuela', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const r = await fetch(`${base}/pase-lista/${ids.segundoA!}`, { headers: conToken(token) });
    expect(r.status).toBe(403);
  });

  it('tampoco la de otra escuela: el aislamiento aguanta con un id valido en la mano', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const r = await fetch(`${base}/pase-lista/${ids.sub12!}`, { headers: conToken(token) });
    expect(r.status).toBe(403);
  });
});

describe('guardar el pase de lista', () => {
  it('guarda, resume, y deja la lista marcada como registrada', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const { estado, cuerpo } = await pasarLista(token, ids.primeroA!, F_ANA, [
      { alumnoId: ids.ana!, estado: 'AUSENTE' },
      { alumnoId: ids.luis!, estado: 'PRESENTE' },
      { alumnoId: ids.rosa!, estado: 'PRESENTE' },
    ]);

    expect(estado).toBe(200);
    expect(cuerpo.resumen).toEqual({ presentes: 2, ausentes: 1, retardos: 0, justificadas: 0 });

    const r = await fetch(`${base}/pase-lista/${ids.primeroA!}?fecha=${F_ANA}`, {
      headers: conToken(token),
    });
    const lista = (await r.json()) as ListaRespuesta;
    expect(lista.yaRegistrada).toBe(true);
    expect(lista.alumnos.find((a) => a.nombre === 'Ana')!.estado).toBe('AUSENTE');
  });

  it('no se pasa lista de un dia que no ha ocurrido', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const manana = new Date(`${HOY}T12:00:00Z`);
    manana.setUTCDate(manana.getUTCDate() + 1);
    const { estado } = await pasarLista(token, ids.primeroA!, manana.toISOString().slice(0, 10), [
      { alumnoId: ids.ana!, estado: 'AUSENTE' },
    ]);
    expect(estado).toBe(400);
  });

  it('no se marca a un alumno que no esta en ese grupo', async () => {
    // RLS no lo impediria: 'Otro' es de la MISMA escuela. La frontera de grupo
    // es de aplicacion y por eso se prueba aqui.
    const token = await entrar('colegio-a', 'dir@t.mx');
    const { estado } = await pasarLista(token, ids.primeroA!, F_ANA, [
      { alumnoId: ids.otro!, estado: 'AUSENTE' },
    ]);
    expect(estado).toBe(400);
  });

  it('un estado inventado se rechaza con 400, no con 500', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const r = await fetch(`${base}/pase-lista`, {
      method: 'POST',
      headers: conToken(token),
      body: JSON.stringify({
        cohorteId: ids.primeroA!,
        fecha: F_ANA,
        registros: [{ alumnoId: ids.ana!, estado: 'DE_VACACIONES' }],
      }),
    });
    expect(r.status).toBe(400);
  });

  it('corregir un estado deja rastro en la bitacora inmutable (§39)', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    await pasarLista(token, ids.primeroA!, F_CORRECCION, [
      { alumnoId: ids.rosa!, estado: 'PRESENTE' },
    ]);
    await pasarLista(token, ids.primeroA!, F_CORRECCION, [
      { alumnoId: ids.rosa!, estado: 'AUSENTE' },
    ]);

    const { rows } = await owner.query(
      `SELECT datos FROM evento_auditoria WHERE tipo = 'asistencia.corregida'`,
    );
    // La fila de asistencia se corrige; la historia de quien la corrigio, no.
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.datos.de === 'PRESENTE' && r.datos.a === 'AUSENTE')).toBe(true);
  });
});

describe('el aviso llega a la familia (el Sprint Goal)', () => {
  it('la falta de Ana produce un aviso para su madre, sin que nadie lo escriba', async () => {
    const madre = await entrar('colegio-a', 'madre@t.mx');
    const avisos = await avisosDe(madre);

    const deAna = avisos.filter((a) => a.titulo.includes('Ana'));
    expect(deAna).toHaveLength(1);
    expect(deAna[0]!.tipo).toBe('asistencia.falta');
    expect(deAna[0]!.leida).toBe(false);
  });

  it('guardar dos veces la misma lista NO duplica el aviso (§15)', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const madre = await entrar('colegio-a', 'madre@t.mx');
    const antes = (await avisosDe(madre)).length;

    const { cuerpo } = await pasarLista(token, ids.primeroA!, F_ANA, [
      { alumnoId: ids.ana!, estado: 'AUSENTE' },
      { alumnoId: ids.luis!, estado: 'PRESENTE' },
      { alumnoId: ids.rosa!, estado: 'PRESENTE' },
    ]);

    expect(cuerpo.avisosGenerados).toBe(0);
    expect((await avisosDe(madre)).length).toBe(antes);
  });

  it('un retardo no genera aviso: el canal se reserva para lo que importa', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const { cuerpo } = await pasarLista(token, ids.primeroA!, F_RETARDO, [
      { alumnoId: ids.rosa!, estado: 'RETARDO' },
    ]);
    expect(cuerpo.avisosGenerados).toBe(0);
  });

  it('al tercer dia de falta llega ademas el aviso acumulado, con el numero', async () => {
    const token = await entrar('colegio-a', 'maestra@t.mx');
    const primeros = await pasarLista(token, ids.primeroA!, F_LUIS[0]!, [
      { alumnoId: ids.luis!, estado: 'AUSENTE' },
    ]);
    const segundos = await pasarLista(token, ids.primeroA!, F_LUIS[1]!, [
      { alumnoId: ids.luis!, estado: 'AUSENTE' },
    ]);
    const terceros = await pasarLista(token, ids.primeroA!, F_LUIS[2]!, [
      { alumnoId: ids.luis!, estado: 'AUSENTE' },
    ]);

    // Uno, uno... y dos: la falta del dia MAS el acumulado.
    expect(primeros.cuerpo.avisosGenerados).toBe(1);
    expect(segundos.cuerpo.avisosGenerados).toBe(1);
    expect(terceros.cuerpo.avisosGenerados).toBe(2);

    const madre = await entrar('colegio-a', 'madre@t.mx');
    const acumulado = (await avisosDe(madre)).find((a) => a.tipo === 'asistencia.acumulada');
    // El numero en el texto es el mecanismo con evidencia, no un adorno.
    expect(acumulado?.titulo).toContain('Luis lleva 3 faltas');
  });

  it('el aviso alcanza al telefono registrado: se verifica el EFECTO (§14)', async () => {
    const madre = await entrar('colegio-a', 'madre@t.mx');
    await fetch(`${base}/notificaciones/dispositivo`, {
      method: 'POST',
      headers: conToken(madre),
      body: JSON.stringify({ token: 'ExponentPushToken[madre-001]', plataforma: 'ANDROID' }),
    });

    const maestra = await entrar('colegio-a', 'maestra@t.mx');
    await pasarLista(maestra, ids.primeroA!, F_PUSH, [{ alumnoId: ids.ana!, estado: 'AUSENTE' }]);

    const { rows } = await owner.query(
      `SELECT dispositivos, enviada_en FROM notificacion WHERE clave = $1`,
      [`falta:${ids.ana!}:${F_PUSH}`],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].enviada_en).not.toBeNull();
    // Alcanzo un telefono de verdad (el simulado cuenta tokens validos).
    expect(rows[0].dispositivos).toBe(1);
  });

  it('la familia de otra escuela no ve nada de esto', async () => {
    const coach = await entrar('academia-a', 'coach@t.mx');
    const r = await fetch(`${base}/mis-avisos`, { headers: conToken(coach) });
    expect(await r.json()).toEqual([]);
  });
});

describe('marcar leido', () => {
  it('la madre marca su aviso y queda leido', async () => {
    const madre = await entrar('colegio-a', 'madre@t.mx');
    const aviso = (await avisosDe(madre))[0]!;

    const r = await fetch(`${base}/mis-avisos/${aviso.id}/leido`, {
      method: 'POST',
      headers: conToken(madre),
    });
    expect(r.status).toBe(204);
    expect((await avisosDe(madre)).find((a) => a.id === aviso.id)!.leida).toBe(true);
  });

  it('otra familia de la MISMA escuela no puede tocar ese aviso', async () => {
    const madre = await entrar('colegio-a', 'madre@t.mx');
    const sinLeer = (await avisosDe(madre)).find((a) => !a.leida)!;

    const otra = await entrar('colegio-a', 'otra@t.mx');
    await fetch(`${base}/mis-avisos/${sinLeer.id}/leido`, {
      method: 'POST',
      headers: conToken(otra),
    });

    // RLS no separa a dos familias del mismo colegio: lo hace el WHERE con
    // usuarioId. Se verifica por el EFECTO — el aviso sigue sin leer.
    expect((await avisosDe(madre)).find((a) => a.id === sinLeer.id)!.leida).toBe(false);
    expect(await avisosDe(otra)).toEqual([]);
  });
});
