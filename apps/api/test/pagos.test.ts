/**
 * Pagos, estado de cuenta y morosidad por el camino real (§13 capa 3).
 *
 * Lo que se verifica aqui son los dos numeros que un ser humano mira antes de
 * actuar: lo que una madre debe antes de pagar, y los meses de atraso que un
 * director mira antes de llamar. Y una tercera cosa que no se ve pero decide:
 * que cada padre separado vea SU parte y no el total.
 *
 * NOTA DE ROBUSTEZ: los periodos se calculan relativos al mes en curso, no se
 * escriben a mano. Una prueba con fechas fijas se pone roja sola al pasar el
 * tiempo, y entonces alguien la "arregla" cambiando el numero en vez de mirar
 * que rompio — que es como se pierde un gate. Leccion del Sprint 4: los datos
 * de prueba comodos esconden defectos.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { ModuloApp } from '../src/app.module.js';

const ID_COLEGIO = '81111111-1111-4111-8111-111111111111';
const ID_ACADEMIA = '82222222-2222-4222-8222-222222222222';
const CONTRASENA = 'prueba-pagos-2026';

const HOY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

/** El periodo de N meses antes del actual, en formato AAAA-MM. */
function mesesAntes(n: number): string {
  const [anio, mes] = HOY.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(anio, mes - 1 - n, 1)).toISOString().slice(0, 7);
}

function diasEntre(desde: string, hasta: string): number {
  return Math.floor(
    (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86_400_000,
  );
}

/// Dos meses cerrados: ambos con su fecha limite (dia 10) ya pasada.
const VIEJO = mesesAntes(2);
const RECIENTE = mesesAntes(1);
const INICIO_CICLO = `${VIEJO}-01`;

/** Lo que responde el API. Declarado una vez para que el compilador proteja en
 *  cada afirmacion, en vez de arrastrar datos sin tipo por todo el archivo. */
interface CargoDeEstado {
  concepto: string;
  periodo: string;
  total: string;
  miParte: string;
  miSaldo: string;
  vence: string;
  sinRecargoHasta: string;
  recargoHoy: string;
  vencido: boolean;
}

interface EstadoDeCuentaRespuesta {
  alumno: string;
  hoy: string;
  cargos: CargoDeEstado[];
  totalAPagar: string;
  recargoTotal: string;
  saldoAFavor: string;
}

interface FamiliaRespuesta {
  alumnoId: string;
  alumno: string;
  pagadores: Array<{ tutorId: string; nombre: string }>;
  saldo: string;
  diasDeAtraso: number;
  situacion: { periodosEnMora: number; puedeSuspender: boolean; explicacion: string };
}

interface ResultadoPagoRespuesta {
  pagoId: string;
  aplicado: string;
  saldoAFavor: string;
  aplicaciones: Array<{ concepto: string; periodo: string; monto: string }>;
  detalles?: Array<{ campo: string; mensaje: string }>;
}

interface MorosidadRespuesta {
  hoy: string;
  cobrado: string;
  porCobrar: string;
  vencido: string;
  familias: FamiliaRespuesta[];
}

let app: INestApplication;
let base: string;
let owner: pg.Client;
const ids: Record<string, string> = {};

beforeAll(async () => {
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL_OWNER });
  await owner.connect();

  for (const t of [
    'plataforma.evento',
    'plataforma.cliente',
    'plataforma.miembro',
    'plataforma.socio',
    'aplicacion_de_pago',
    'pago',
    'parte_de_cargo',
    'cargo',
    'concepto_cargo',
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
       ($1,'Colegio P','colegio-p','COLEGIO',true,now()),
       ($2,'Academia P','academia-p','ACADEMIA_DEPORTIVA',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  for (const t of [ID_COLEGIO, ID_ACADEMIA]) {
    await owner.query(
      `INSERT INTO configuracion_escuela
         (id, tenant_id, dia_vencimiento_por_omision, dias_gracia_sin_recargo,
          recargo_porcentaje, actualizado_en)
       VALUES (gen_random_uuid(), $1, 5, 10, 3.50, now())`,
      [t],
    );
  }

  const { rows: sedes } = await owner.query(
    `INSERT INTO sede (id, tenant_id, nombre, activa, "creadaEn") VALUES
       (gen_random_uuid(),$1,'Campus P',true,now()),
       (gen_random_uuid(),$2,'Cancha P',true,now()) RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const { rows: periodos } = await owner.query(
    `INSERT INTO periodo (id, tenant_id, nombre, tipo, inicio, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Ciclo P','CICLO_ESCOLAR',$3::date,true,now()),
       (gen_random_uuid(),$2,'Temporada P','TEMPORADA',$3::date,true,now())
     RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA, INICIO_CICLO],
  );
  const sede = (t: string) => sedes.find((s) => s.tenant_id === t)!.id;
  const periodo = (t: string) => periodos.find((p) => p.tenant_id === t)!.id;

  const { rows: cohortes } = await owner.query(
    `INSERT INTO cohorte (id, tenant_id, periodo_id, sede_id, nombre, tipo, orden, activa, creada_en) VALUES
       (gen_random_uuid(),$1,$3,$5,'1o A','GRADO',1,true,now()),
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
  ids.sub12 = cohortes.find((c) => c.nombre === 'Sub-12')!.id;

  const { rows: alumnos } = await owner.query(
    `INSERT INTO alumno (id, tenant_id, nombre, apellidos, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Ana','Perez',true,now()),
       (gen_random_uuid(),$1,'Luis','Perez',true,now()),
       (gen_random_uuid(),$2,'Diego','Ortiz',true,now())
     RETURNING id, nombre`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  for (const a of alumnos) ids[a.nombre.toLowerCase()] = a.id;

  for (const [alumno, tenant, cohorte] of [
    ['ana', ID_COLEGIO, 'primeroA'],
    ['luis', ID_COLEGIO, 'primeroA'],
    ['diego', ID_ACADEMIA, 'sub12'],
  ] as const) {
    await owner.query(
      `INSERT INTO inscripcion (id, tenant_id, alumno_id, cohorte_id, estado, alta_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'ACTIVA',now())`,
      [tenant, ids[alumno], ids[cohorte]],
    );
  }

  const { rows: usuarios } = await owner.query(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn") VALUES
       (gen_random_uuid(),$1,'admin@p.mx',$3,'Administradora P',true,now()),
       (gen_random_uuid(),$1,'elena@p.mx',$3,'Elena Loera',true,now()),
       (gen_random_uuid(),$1,'jorge@p.mx',$3,'Jorge Ramirez',true,now()),
       (gen_random_uuid(),$1,'maestra@p.mx',$3,'Maestra P',true,now()),
       (gen_random_uuid(),$2,'admin@p.mx',$3,'Admin Academia',true,now())
     RETURNING id, tenant_id, email`,
    [ID_COLEGIO, ID_ACADEMIA, h],
  );
  const rolDe: Record<string, string> = {
    'admin@p.mx': 'ADMIN',
    'elena@p.mx': 'TUTOR',
    'jorge@p.mx': 'TUTOR',
    'maestra@p.mx': 'DOCENTE',
  };
  for (const u of usuarios) {
    ids[`u:${u.email}:${u.tenant_id}`] = u.id;
    await owner.query(
      `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3::"Rol",now())`,
      [u.tenant_id, u.id, rolDe[u.email] ?? 'ADMIN'],
    );
  }

  // Ana: padres separados 60/40 — el caso del mercado mexicano.
  // Luis: un solo pagador.
  const familia: Array<[string, string, string, number, string]> = [
    ['Elena', 'Loera', 'elena@p.mx', 60, 'ana'],
    ['Jorge', 'Ramirez', 'jorge@p.mx', 40, 'ana'],
    ['Sofia', 'Nava', '', 100, 'luis'],
    ['Paola', 'Ortiz', '', 100, 'diego'],
  ];
  for (const [nombre, apellidos, correo, porcentaje, alumno] of familia) {
    const tenant = alumno === 'diego' ? ID_ACADEMIA : ID_COLEGIO;
    const usuarioId = correo ? ids[`u:${correo}:${tenant}`] : null;
    const { rows: tutor } = await owner.query(
      `INSERT INTO tutor (id, tenant_id, nombre, apellidos, email, usuario_id, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,now()) RETURNING id`,
      [tenant, nombre, apellidos, correo || null, usuarioId],
    );
    ids[`t:${nombre}`] = tutor[0].id;
    await owner.query(
      `INSERT INTO tutor_alumno
         (id, tenant_id, tutor_id, alumno_id, parentesco, es_pagador, porcentaje_pago,
          es_contacto_emergencia, puede_recoger, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'TUTOR',true,$4,false,true,now())`,
      [tenant, tutor[0].id, ids[alumno], porcentaje],
    );
  }

  app = await NestFactory.create(ModuloApp, { logger: false });
  await app.listen(0);
  base = await app.getUrl();

  // Catalogo y dos meses de cargos, ya vencidos ambos.
  const admin = await entrar('colegio-p', 'admin@p.mx');
  await post(admin, '/catalogo-cargos', {
    clave: 'colegiatura',
    nombre: 'Colegiatura',
    periodicidad: 'MENSUAL',
    monto: '2450.00',
    diaVencimiento: 5,
    vigenteDesde: INICIO_CICLO,
    // Sin esta marca no cuenta para el Articulo 7 (§52). Es deliberado que haya
    // que declararla: el sistema no adivina cual de los cobros mensuales de una
    // escuela es la colegiatura y cual el comedor.
    esColegiatura: true,
  });
  await post(admin, '/cargos/generar', { periodo: VIEJO });
  await post(admin, '/cargos/generar', { periodo: RECIENTE });
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

async function post<T = Record<string, unknown>>(token: string, ruta: string, cuerpo: unknown) {
  const r = await fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: conToken(token),
    body: JSON.stringify(cuerpo),
  });
  return { estado: r.status, cuerpo: (await r.json().catch(() => null)) as T };
}

/**
 * Lector tipado de respuestas. El generico obliga a declarar QUE se espera en
 * los puntos donde la prueba navega la estructura, en vez de arrastrar un dato
 * sin tipo por todo el archivo — la misma frontera de confianza que tienen el
 * cliente web y el movil.
 */
async function get<T = Record<string, unknown>>(token: string, ruta: string) {
  const r = await fetch(`${base}${ruta}`, { headers: conToken(token) });
  return { estado: r.status, cuerpo: (await r.json().catch(() => null)) as T };
}

const pago = (tutor: string, monto: string) => ({
  tutorId: ids[`t:${tutor}`],
  monto,
  fecha: HOY,
  metodo: 'TRANSFERENCIA' as const,
  referencia: `REF-${monto}`,
});

describe('quien puede registrar un pago', () => {
  it('un tutor NO registra pagos: eso es caja, no familia', async () => {
    const token = await entrar('colegio-p', 'elena@p.mx');
    const { estado } = await post(token, '/pagos', pago('Elena', '100.00'));
    expect(estado).toBe(403);
  });

  it('un docente tampoco', async () => {
    const token = await entrar('colegio-p', 'maestra@p.mx');
    const { estado } = await post(token, '/pagos', pago('Elena', '100.00'));
    expect(estado).toBe(403);
  });

  it('sin sesion, nada', async () => {
    expect((await fetch(`${base}/morosidad`)).status).toBe(401);
  });
});

describe('registro de pagos: lo mas viejo primero (AZ-M4.9)', () => {
  it('el pago exacto de Elena salda el mes MAS VIEJO, no el reciente', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { estado, cuerpo } = await post<ResultadoPagoRespuesta>(
      admin,
      '/pagos',
      pago('Elena', '1470.00'),
    );

    expect(estado).toBe(201);
    expect(cuerpo.aplicado).toBe('1470.00');
    expect(cuerpo.saldoAFavor).toBe('0.00');
    // Y se puede decir al padre EXACTAMENTE que cubrio su transferencia.
    expect(cuerpo.aplicaciones).toEqual([
      { concepto: 'Colegiatura', periodo: VIEJO, monto: '1470.00' },
    ]);
  });

  it('un abono parcial deja el resto abierto, sin inventar nada', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { cuerpo } = await post<ResultadoPagoRespuesta>(admin, '/pagos', pago('Jorge', '500.00'));
    expect(cuerpo.aplicado).toBe('500.00');
    expect(cuerpo.aplicaciones).toEqual([
      { concepto: 'Colegiatura', periodo: VIEJO, monto: '500.00' },
    ]);
  });

  it('un pago grande recorre meses en orden y lo que sobra queda A FAVOR', async () => {
    // Jorge debe 480 del mes viejo y 980 del reciente: 1,460 en total.
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { cuerpo } = await post<ResultadoPagoRespuesta>(
      admin,
      '/pagos',
      pago('Jorge', '5000.00'),
    );

    expect(cuerpo.aplicaciones).toEqual([
      { concepto: 'Colegiatura', periodo: VIEJO, monto: '480.00' },
      { concepto: 'Colegiatura', periodo: RECIENTE, monto: '980.00' },
    ]);
    expect(cuerpo.aplicado).toBe('1460.00');
    // Pagar por adelantado no se rechaza ni se pierde.
    expect(cuerpo.saldoAFavor).toBe('3540.00');
  });

  it('un pago con fecha futura se rechaza', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const manana = new Date(`${HOY}T12:00:00Z`);
    manana.setUTCDate(manana.getUTCDate() + 1);
    const { estado } = await post<ResultadoPagoRespuesta>(admin, '/pagos', {
      ...pago('Elena', '100.00'),
      fecha: manana.toISOString().slice(0, 10),
    });
    expect(estado).toBe(400);
  });

  it('un importe mal escrito se rechaza con 400, no con 500', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { estado, cuerpo } = await post<ResultadoPagoRespuesta>(admin, '/pagos', {
      ...pago('Elena', '100'),
      monto: '$1,470',
    });
    expect(estado).toBe(400);
    expect(cuerpo.detalles![0]).toMatchObject({ campo: 'monto' });
  });
});

describe('estado de cuenta: cada quien ve LO SUYO (AZ-M4.5)', () => {
  it('Elena ve su 60% pendiente, no el total del cargo', async () => {
    // Mostrarle 2,450 a quien paga el 60% la invita a pagar de mas.
    const elena = await entrar('colegio-p', 'elena@p.mx');
    const { estado, cuerpo } = await get<EstadoDeCuentaRespuesta>(
      elena,
      `/mis-hijos/${ids.ana!}/estado-de-cuenta`,
    );

    expect(estado).toBe(200);
    expect(cuerpo.alumno).toBe('Ana Perez');
    expect(cuerpo.cargos).toHaveLength(1);
    expect(cuerpo.cargos[0]!).toMatchObject({
      periodo: RECIENTE,
      total: '2450.00',
      miParte: '1470.00',
      miSaldo: '1470.00',
      vencido: true,
    });
    expect(cuerpo.totalAPagar).toBe('1470.00');
  });

  it('el recargo va calculado, y sale de la fecha congelada en el cargo', async () => {
    // 1,470 al 3.5% = 51.45. Y la fecha limite es el dia 10, aunque venza el 5.
    const elena = await entrar('colegio-p', 'elena@p.mx');
    const { cuerpo } = await get<EstadoDeCuentaRespuesta>(
      elena,
      `/mis-hijos/${ids.ana!}/estado-de-cuenta`,
    );

    expect(cuerpo.cargos[0]!.sinRecargoHasta).toBe(`${RECIENTE}-10`);
    expect(cuerpo.cargos[0]!.vence).toBe(`${RECIENTE}-05`);
    expect(cuerpo.cargos[0]!.recargoHoy).toBe('51.45');
    expect(cuerpo.recargoTotal).toBe('51.45');
  });

  it('Jorge no debe nada y tiene saldo a favor: dos padres, dos realidades', async () => {
    const jorge = await entrar('colegio-p', 'jorge@p.mx');
    const { cuerpo } = await get<EstadoDeCuentaRespuesta>(
      jorge,
      `/mis-hijos/${ids.ana!}/estado-de-cuenta`,
    );

    expect(cuerpo.cargos).toEqual([]);
    expect(cuerpo.totalAPagar).toBe('0.00');
    expect(cuerpo.saldoAFavor).toBe('3540.00');
  });

  it('un tutor NO ve el estado de cuenta de un alumno ajeno', async () => {
    // RLS no separa a dos familias de la misma escuela: lo hace el vinculo.
    const elena = await entrar('colegio-p', 'elena@p.mx');
    const { estado } = await get<EstadoDeCuentaRespuesta>(
      elena,
      `/mis-hijos/${ids.luis!}/estado-de-cuenta`,
    );
    expect(estado).toBe(404);
  });

  it('el personal de la escuela no entra por la puerta de la familia', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { estado } = await get<EstadoDeCuentaRespuesta>(
      admin,
      `/mis-hijos/${ids.ana!}/estado-de-cuenta`,
    );
    expect(estado).toBe(403);
  });
});

describe('panel de morosidad (AZ-M4.8)', () => {
  it('los tres numeros de arriba cuadran contra lo cobrado y lo debido', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { cuerpo } = await get<MorosidadRespuesta>(admin, '/morosidad');

    // Cobrado: 1470 (Elena) + 500 + 480 + 980 (Jorge) = 3,430.
    expect(cuerpo.cobrado).toBe('3430.00');
    // Por cobrar: Ana reciente 1,470 + Luis viejo y reciente 4,900 = 6,370.
    expect(cuerpo.porCobrar).toBe('6370.00');
    // Todo lo pendiente ya paso su fecha limite.
    expect(cuerpo.vencido).toBe('6370.00');
  });

  it('lo mas urgente va primero, y el atraso se cuenta desde la fecha legal', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { cuerpo } = await get<MorosidadRespuesta>(admin, '/morosidad');

    expect(cuerpo.familias).toHaveLength(2);
    const [primero, segundo] = cuerpo.familias as [FamiliaRespuesta, FamiliaRespuesta];

    // Luis debe dos meses; Ana solo el reciente.
    expect(primero.alumno).toBe('Perez, Luis');
    expect(primero.saldo).toBe('4900.00');
    expect(primero.diasDeAtraso).toBe(diasEntre(`${VIEJO}-10`, HOY));

    expect(segundo.alumno).toBe('Perez, Ana');
    expect(segundo.saldo).toBe('1470.00');
    expect(segundo.diasDeAtraso).toBe(diasEntre(`${RECIENTE}-10`, HOY));
  });

  it('el Articulo 7 se cuenta en MESES y el panel dice donde esta parada la escuela', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { cuerpo } = await get<MorosidadRespuesta>(admin, '/morosidad');
    const luis = cuerpo.familias.find((f) => f.alumno === 'Perez, Luis')!;

    expect(luis.situacion.periodosEnMora).toBe(2);
    // Dos meses NO alcanzan: la ley pide tres. Y se dice cuantos faltan en vez
    // de un "no se puede" que no ayuda a nadie.
    expect(luis.situacion.puedeSuspender).toBe(false);
    expect(luis.situacion.explicacion).toMatch(/falta\(n\) 1/);
  });

  it('la familia que ya pago su mes viejo baja de un mes de mora', async () => {
    const admin = await entrar('colegio-p', 'admin@p.mx');
    const { cuerpo } = await get<MorosidadRespuesta>(admin, '/morosidad');
    const ana = cuerpo.familias.find((f) => f.alumno === 'Perez, Ana')!;
    expect(ana.situacion.periodosEnMora).toBe(1);
    // Y se ven los dos pagadores con su identificador, no solo quien pago: es
    // lo que permite a caja registrar el pago sin ir a buscar a la persona.
    expect(ana.pagadores.map((p) => p.nombre)).toEqual(['Elena Loera', 'Jorge Ramirez']);
    expect(ana.pagadores[0]!.tutorId).toBe(ids['t:Elena']);
  });
});

describe('las invariantes del dinero, contra la base', () => {
  it('lo aplicado a una parte nunca excede lo que esa parte debe', async () => {
    const { rows } = await owner.query(
      `SELECT p.id, p.monto::text AS debe, sum(a.monto)::text AS aplicado
         FROM parte_de_cargo p JOIN aplicacion_de_pago a ON a.parte_de_cargo_id = p.id
        GROUP BY p.id, p.monto
       HAVING sum(a.monto) > p.monto`,
    );
    expect(rows, 'hay partes con mas dinero aplicado del que debian').toHaveLength(0);
  });

  it('lo aplicado de un pago nunca excede su importe', async () => {
    const { rows } = await owner.query(
      `SELECT p.id, p.monto::text, sum(a.monto)::text AS aplicado
         FROM pago p JOIN aplicacion_de_pago a ON a.pago_id = p.id
        GROUP BY p.id, p.monto
       HAVING sum(a.monto) > p.monto`,
    );
    expect(rows, 'hay pagos que aplicaron mas de lo que entro').toHaveLength(0);
  });

  it('un pago de cero o negativo no entra ni por SQL directo', async () => {
    await expect(
      owner.query(
        `INSERT INTO pago (id, tenant_id, tutor_id, monto, fecha, metodo, registrado_en)
         VALUES (gen_random_uuid(), $1, $2, 0, now()::date, 'EFECTIVO', now())`,
        [ID_COLEGIO, ids['t:Elena']],
      ),
    ).rejects.toThrow(/pago_monto_positivo/);
  });
});

describe('aislamiento entre escuelas', () => {
  it('la academia no ve un solo peso del colegio', async () => {
    const admin = await entrar('academia-p', 'admin@p.mx');
    const { cuerpo } = await get<MorosidadRespuesta>(admin, '/morosidad');

    expect(cuerpo.cobrado).toBe('0.00');
    expect(cuerpo.familias).toEqual([]);
    expect(JSON.stringify(cuerpo)).not.toContain('Perez');
  });

  it('tampoco puede registrarle un pago a un tutor ajeno', async () => {
    const admin = await entrar('academia-p', 'admin@p.mx');
    const { estado } = await post<ResultadoPagoRespuesta>(admin, '/pagos', pago('Elena', '100.00'));
    // El tutor de la otra escuela sencillamente no existe para esta sesion.
    expect(estado).toBe(404);
  });
});
