/**
 * El saldo a favor, por el camino real (§13 capa 3) — AZ-M4.10.
 *
 * ESTE ARCHIVO EXISTE POR UNA PREGUNTA DEL CEO: "en mi universidad yo podía
 * pagar por mensualidad o pagar todo el semestre en un solo pago". El sistema
 * registraba ese pago adelantado, lo mostraba como saldo a favor... y ahí lo
 * dejaba. Al generar el cargo del mes siguiente, el dinero que la familia ya
 * había entregado no lo tocaba, mientras la app decía "se aplicarán al próximo
 * cargo". El estudio de cobranza lo confirmó contra el reglamento de pagos de
 * la UPAEP, que da por sentado que el pago adelantado se acredita contra el
 * total del periodo.
 *
 * Se prueba por el EFECTO (§14): no que un endpoint responda `ok`, sino que el
 * saldo de la familia baje y que el asiento quede en la base.
 *
 * Y de paso quedan fijados los dos defectos legales que este sprint corrigió:
 * el contador del Artículo 7 (§52) y el ámbito del Acuerdo por vertical (§51).
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { ModuloApp } from '../src/app.module.js';

const ID_COLEGIO = '83333333-3333-4333-8333-333333333333';
const ID_ACADEMIA = '84444444-4444-4444-8444-444444444444';
const CONTRASENA = 'prueba-saldo-2026';

const HOY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Mexico_City',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date());

/** El periodo de N meses antes del actual (o después, si N es negativo). */
function mesesAntes(n: number): string {
  const [anio, mes] = HOY.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(anio, mes - 1 - n, 1)).toISOString().slice(0, 7);
}

const MES_1 = mesesAntes(3);
const MES_2 = mesesAntes(2);
const MES_3 = mesesAntes(1);
const INICIO_CICLO = `${MES_1}-01`;

interface CargoDeEstado {
  concepto: string;
  periodo: string;
  miSaldo: string;
}

interface EstadoDeCuentaRespuesta {
  cargos: CargoDeEstado[];
  totalAPagar: string;
  saldoAFavor: string;
  devolucionDeSaldo: { permitido: boolean; motivo: string };
  avisos: string[];
}

interface GeneracionRespuesta {
  generados: number;
  saldoAFavorAplicado: string;
  familiasConSaldoAplicado: number;
}

interface PagoRespuesta {
  aplicado: string;
  saldoAFavor: string;
}

interface MorosidadRespuesta {
  familias: Array<{
    alumno: string;
    saldo: string;
    situacion: { periodosEnMora: number; puedeSuspender: boolean; explicacion: string };
  }>;
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

  // Un COLEGIO (el Acuerdo lo alcanza) y una ACADEMIA (no lo alcanza). La
  // diferencia entre ambos es el defecto §51 que este sprint corrige.
  await owner.query(
    `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn") VALUES
       ($1,'Colegio S','colegio-s','COLEGIO',true,now()),
       ($2,'Academia S','academia-s','ACADEMIA_DEPORTIVA',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  // Gracia configurada en CERO en las dos, a propósito: así lo único que puede
  // estirar la ventana sin recargo es el piso legal, y la diferencia entre el
  // colegio y la academia queda aislada (§51).
  for (const t of [ID_COLEGIO, ID_ACADEMIA]) {
    await owner.query(
      `INSERT INTO configuracion_escuela
         (id, tenant_id, dia_vencimiento_por_omision, dias_gracia_sin_recargo,
          recargo_porcentaje, actualizado_en)
       VALUES (gen_random_uuid(), $1, 5, 0, 0, now())`,
      [t],
    );
  }

  const { rows: sedes } = await owner.query(
    `INSERT INTO sede (id, tenant_id, nombre, activa, "creadaEn") VALUES
       (gen_random_uuid(),$1,'Campus S',true,now()),
       (gen_random_uuid(),$2,'Cancha S',true,now()) RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const { rows: periodos } = await owner.query(
    `INSERT INTO periodo (id, tenant_id, nombre, tipo, inicio, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Ciclo S','CICLO_ESCOLAR',$3::date,true,now()),
       (gen_random_uuid(),$2,'Temporada S','TEMPORADA',$3::date,true,now())
     RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA, INICIO_CICLO],
  );
  const sede = (t: string) => sedes.find((s) => s.tenant_id === t)!.id;
  const periodo = (t: string) => periodos.find((p) => p.tenant_id === t)!.id;

  const { rows: cohortes } = await owner.query(
    `INSERT INTO cohorte (id, tenant_id, periodo_id, sede_id, nombre, tipo, orden, activa, creada_en) VALUES
       (gen_random_uuid(),$1,$3,$5,'2o B','GRADO',2,true,now()),
       (gen_random_uuid(),$2,$4,$6,'Sub-14','CATEGORIA',14,true,now())
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
  ids.segundoB = cohortes.find((c) => c.nombre === '2o B')!.id;
  ids.sub14 = cohortes.find((c) => c.nombre === 'Sub-14')!.id;

  const { rows: alumnos } = await owner.query(
    `INSERT INTO alumno (id, tenant_id, nombre, apellidos, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Mariana','Solis',true,now()),
       (gen_random_uuid(),$2,'Tadeo','Rivas',true,now())
     RETURNING id, nombre`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  for (const a of alumnos) ids[a.nombre.toLowerCase()] = a.id;

  for (const [alumno, tenant, cohorte] of [
    ['mariana', ID_COLEGIO, 'segundoB'],
    ['tadeo', ID_ACADEMIA, 'sub14'],
  ] as const) {
    await owner.query(
      `INSERT INTO inscripcion (id, tenant_id, alumno_id, cohorte_id, estado, alta_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'ACTIVA',now())`,
      [tenant, ids[alumno], ids[cohorte]],
    );
  }

  const { rows: usuarios } = await owner.query(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn") VALUES
       (gen_random_uuid(),$1,'admin@s.mx',$3,'Administradora S',true,now()),
       (gen_random_uuid(),$1,'rocio@s.mx',$3,'Rocio Solis',true,now()),
       (gen_random_uuid(),$2,'admin@s.mx',$3,'Admin Academia S',true,now())
     RETURNING id, tenant_id, email`,
    [ID_COLEGIO, ID_ACADEMIA, h],
  );
  const rolDe: Record<string, string> = { 'admin@s.mx': 'ADMIN', 'rocio@s.mx': 'TUTOR' };
  for (const u of usuarios) {
    ids[`u:${u.email}:${u.tenant_id}`] = u.id;
    await owner.query(
      `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3::"Rol",now())`,
      [u.tenant_id, u.id, rolDe[u.email] ?? 'ADMIN'],
    );
  }

  // Rocio paga el 100% de Mariana: el caso del pago adelantado sin repartos que
  // distraigan. Paola paga el 100% de Tadeo en la academia.
  for (const [nombre, apellidos, correo, alumno] of [
    ['Rocio', 'Solis', 'rocio@s.mx', 'mariana'],
    ['Paola', 'Rivas', '', 'tadeo'],
  ] as const) {
    const tenant = alumno === 'tadeo' ? ID_ACADEMIA : ID_COLEGIO;
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
       VALUES (gen_random_uuid(),$1,$2,$3,'MADRE',true,100,true,true,now())`,
      [tenant, tutor[0].id, ids[alumno]],
    );
  }

  app = await NestFactory.create(ModuloApp, { logger: false });
  await app.listen(0);
  base = await app.getUrl();
}, 60_000);

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

async function get<T = Record<string, unknown>>(token: string, ruta: string) {
  const r = await fetch(`${base}${ruta}`, { headers: conToken(token) });
  return { estado: r.status, cuerpo: (await r.json().catch(() => null)) as T };
}

/** Cuánto se le aplicó en total a un pago, leído de la base. */
async function aplicadoDe(referencia: string): Promise<string> {
  const { rows } = await owner.query(
    `SELECT coalesce(sum(a.monto), 0)::text AS aplicado
       FROM pago p LEFT JOIN aplicacion_de_pago a ON a.pago_id = p.id
      WHERE p.referencia = $1`,
    [referencia],
  );
  return rows[0].aplicado;
}

// ---------------------------------------------------------------------------

describe('el pago adelantado se acredita contra los cargos que vienen', () => {
  it('preparación: catálogo y el primer mes generado', async () => {
    const admin = await entrar('colegio-s', 'admin@s.mx');

    await post(admin, '/catalogo-cargos', {
      clave: 'colegiatura',
      nombre: 'Colegiatura',
      periodicidad: 'MENSUAL',
      monto: '1000.00',
      diaVencimiento: 5,
      vigenteDesde: INICIO_CICLO,
      esColegiatura: true,
      deducibleIedu: true,
      nivelEducativo: 'PRIMARIA',
    });

    const { cuerpo } = await post<GeneracionRespuesta>(admin, '/cargos/generar', {
      periodo: MES_1,
    });
    expect(cuerpo.generados).toBe(1);
    // Nadie ha pagado nada todavía: no hay saldo a favor que aplicar.
    expect(cuerpo.saldoAFavorAplicado).toBe('0.00');
  });

  it('Rocío paga tres meses de una vez: se aplica lo que existe y el resto queda a favor', async () => {
    const admin = await entrar('colegio-s', 'admin@s.mx');
    const { cuerpo } = await post<PagoRespuesta>(admin, '/pagos', {
      tutorId: ids['t:Rocio'],
      monto: '3000.00',
      fecha: HOY,
      metodo: 'TRANSFERENCIA',
      referencia: 'ADELANTADO-3-MESES',
    });

    // Solo existe el cargo del mes 1. Los otros dos meses todavía no se generan.
    expect(cuerpo.aplicado).toBe('1000.00');
    expect(cuerpo.saldoAFavor).toBe('2000.00');
  });

  it('AQUÍ ESTABA EL HUECO: generar el mes 2 consume el saldo a favor', async () => {
    const admin = await entrar('colegio-s', 'admin@s.mx');

    // Se da de alta la excursión JUSTO ANTES de generar, para que nazca después
    // del pago: es el escenario que separa las dos banderas. Vence el día 20 y
    // se cobra por cuenta del operador que la presta.
    await post(admin, '/catalogo-cargos', {
      clave: 'excursion',
      nombre: 'Excursión',
      periodicidad: 'UNICO',
      monto: '300.00',
      diaVencimiento: 20,
      vigenteDesde: INICIO_CICLO,
      esColegiatura: false,
      aceptaSaldoAFavor: false,
    });

    const { cuerpo } = await post<GeneracionRespuesta>(admin, '/cargos/generar', {
      periodo: MES_2,
    });

    // Colegiatura del mes 2 + la excursión, anclada al inicio del ciclo.
    expect(cuerpo.generados).toBe(2);
    // Antes de este sprint esto era '0.00' y la familia tenía que volver a pagar
    // un mes que ya había pagado. Y son 1,000 y no 1,300: la excursión no toca
    // el saldo a favor.
    expect(cuerpo.saldoAFavorAplicado).toBe('1000.00');
    expect(cuerpo.familiasConSaldoAplicado).toBe(1);
  });

  it('y el efecto se ve en la base, no solo en la respuesta (§14)', async () => {
    // El asiento existe y está atado al pago original: 1,000 + 1,000 = 2,000.
    expect(await aplicadoDe('ADELANTADO-3-MESES')).toBe('2000.00');
  });

  it('la madre ve su colegiatura al corriente y su saldo restante, sin hacer nada', async () => {
    const rocio = await entrar('colegio-s', 'rocio@s.mx');
    const { cuerpo } = await get<EstadoDeCuentaRespuesta>(
      rocio,
      `/mis-hijos/${ids.mariana!}/estado-de-cuenta`,
    );

    // Solo le queda la excursión, que no consume crédito.
    expect(cuerpo.cargos.map((c) => c.concepto)).toEqual(['Excursión']);
    expect(cuerpo.totalAPagar).toBe('300.00');
    expect(cuerpo.saldoAFavor).toBe('1000.00');
  });

  it('correr la generación otra vez no aplica un peso de más (idempotencia)', async () => {
    const admin = await entrar('colegio-s', 'admin@s.mx');
    const { cuerpo } = await post<GeneracionRespuesta>(admin, '/cargos/generar', {
      periodo: MES_2,
    });

    expect(cuerpo.generados).toBe(0);
    expect(cuerpo.saldoAFavorAplicado).toBe('0.00');
    expect(await aplicadoDe('ADELANTADO-3-MESES')).toBe('2000.00');
  });

  it('el mes 3 consume lo que queda y no deja saldo a favor de sobra', async () => {
    const admin = await entrar('colegio-s', 'admin@s.mx');
    const { cuerpo } = await post<GeneracionRespuesta>(admin, '/cargos/generar', {
      periodo: MES_3,
    });

    expect(cuerpo.saldoAFavorAplicado).toBe('1000.00');

    const rocio = await entrar('colegio-s', 'rocio@s.mx');
    const { cuerpo: estado } = await get<EstadoDeCuentaRespuesta>(
      rocio,
      `/mis-hijos/${ids.mariana!}/estado-de-cuenta`,
    );
    expect(estado.saldoAFavor).toBe('0.00');
    // Los tres meses de colegiatura pagados con un solo depósito; queda la
    // excursión, que es lo único que el crédito no podía tocar.
    expect(estado.totalAPagar).toBe('300.00');
    expect(estado.cargos.map((c) => c.concepto)).toEqual(['Excursión']);
  });

  it('las invariantes del dinero siguen en pie después de aplicar crédito', async () => {
    const { rows: partes } = await owner.query(
      `SELECT p.id FROM parte_de_cargo p JOIN aplicacion_de_pago a ON a.parte_de_cargo_id = p.id
        GROUP BY p.id, p.monto HAVING sum(a.monto) > p.monto`,
    );
    expect(partes, 'una parte recibió más dinero del que debía').toHaveLength(0);

    const { rows: pagos } = await owner.query(
      `SELECT p.id FROM pago p JOIN aplicacion_de_pago a ON a.pago_id = p.id
        GROUP BY p.id, p.monto HAVING sum(a.monto) > p.monto`,
    );
    expect(pagos, 'un pago aplicó más de lo que entró').toHaveLength(0);
  });
});

describe('la bandera por concepto decide qué puede consumir el saldo a favor', () => {
  it('la excursión sigue pendiente aunque hubo saldo a favor de sobra', async () => {
    // Es el punto: la escuela solo junta ese dinero para el operador. Gastarle
    // el saldo a favor a la familia sin que nadie lo decida la deja sin él para
    // la colegiatura, que es lo que sí es su obligación.
    const rocio = await entrar('colegio-s', 'rocio@s.mx');
    const { cuerpo } = await get<EstadoDeCuentaRespuesta>(
      rocio,
      `/mis-hijos/${ids.mariana!}/estado-de-cuenta`,
    );
    expect(cuerpo.cargos.map((c) => c.concepto)).toEqual(['Excursión']);
  });
});

describe('Artículo 7 en el panel: colegiaturas, no adeudos (§52)', () => {
  it('la excursión vencida NO acerca a la familia a la suspensión', async () => {
    const admin = await entrar('colegio-s', 'admin@s.mx');
    const { cuerpo } = await get<MorosidadRespuesta>(admin, '/morosidad');
    const mariana = cuerpo.familias.find((f) => f.alumno === 'Solis, Mariana')!;

    // Debe 300 y son de una excursión: cero colegiaturas vencidas.
    expect(mariana.saldo).toBe('300.00');
    expect(mariana.situacion.periodosEnMora).toBe(0);
    expect(mariana.situacion.puedeSuspender).toBe(false);
  });
});

describe('el Acuerdo no obliga a todas las instituciones (§51)', () => {
  it('a la academia no se le cita una ley que no le aplica', async () => {
    const admin = await entrar('academia-s', 'admin@s.mx');
    await post(admin, '/catalogo-cargos', {
      clave: 'mensualidad',
      nombre: 'Mensualidad',
      periodicidad: 'MENSUAL',
      monto: '800.00',
      diaVencimiento: 5,
      vigenteDesde: INICIO_CICLO,
      esColegiatura: true,
    });
    for (const p of [MES_1, MES_2, MES_3]) {
      await post(admin, '/cargos/generar', { periodo: p });
    }

    const { cuerpo } = await get<MorosidadRespuesta>(admin, '/morosidad');
    const tadeo = cuerpo.familias.find((f) => f.alumno === 'Rivas, Tadeo')!;

    // Tres cuotas vencidas: en un colegio esto habilitaría a suspender. Aquí no,
    // porque el Acuerdo de PROFECO no alcanza a una academia deportiva.
    expect(tadeo.situacion.periodosEnMora).toBe(3);
    expect(tadeo.situacion.puedeSuspender).toBe(false);
    expect(tadeo.situacion.explicacion).toMatch(/no aplica a esta institución/);
    expect(tadeo.situacion.explicacion).not.toMatch(/La ley permite/);
  });

  it('y tampoco se le impone el piso de diez días sin recargo', async () => {
    // El cargo de la academia vence el día 5 y ahí termina su ventana. En un
    // colegio, el Artículo 4 la estiraría hasta el día 10 aunque venciera antes.
    const { rows } = await owner.query(
      `SELECT c.fecha_limite_sin_recargo::text AS limite
         FROM cargo c WHERE c.tenant_id = $1 ORDER BY c.periodo LIMIT 1`,
      [ID_ACADEMIA],
    );
    expect(rows[0].limite).toBe(`${MES_1}-05`);

    const { rows: colegio } = await owner.query(
      `SELECT c.fecha_limite_sin_recargo::text AS limite
         FROM cargo c JOIN concepto_cargo cc ON cc.id = c.concepto_id
        WHERE c.tenant_id = $1 AND cc.clave = 'colegiatura' ORDER BY c.periodo LIMIT 1`,
      [ID_COLEGIO],
    );
    expect(colegio[0].limite).toBe(`${MES_1}-10`);
  });
});

describe('advertencia fiscal en el estado de cuenta (AZ-M4.5b)', () => {
  it('se le dice a la familia que el efectivo mata la deducción', async () => {
    const rocio = await entrar('colegio-s', 'rocio@s.mx');
    const { cuerpo } = await get<EstadoDeCuentaRespuesta>(
      rocio,
      `/mis-hijos/${ids.mariana!}/estado-de-cuenta`,
    );

    expect(cuerpo.avisos).toHaveLength(1);
    expect(cuerpo.avisos[0]).toMatch(/efectivo/);
  });
});

describe('devolución del saldo a favor', () => {
  it('pagar de más SÍ salda la excursión: pagar es pagar, la bandera es solo para el crédito', async () => {
    const admin = await entrar('colegio-s', 'admin@s.mx');
    await post(admin, '/pagos', {
      tutorId: ids['t:Rocio'],
      monto: '500.00',
      fecha: HOY,
      metodo: 'TRANSFERENCIA',
      referencia: 'SOBRE-PAGO',
    });

    const rocio = await entrar('colegio-s', 'rocio@s.mx');
    const { cuerpo } = await get<EstadoDeCuentaRespuesta>(
      rocio,
      `/mis-hijos/${ids.mariana!}/estado-de-cuenta`,
    );

    // Sin nada vencido, lo que sobra se puede devolver.
    expect(cuerpo.totalAPagar).toBe('0.00');
    expect(cuerpo.saldoAFavor).toBe('200.00');
    expect(cuerpo.devolucionDeSaldo.permitido).toBe(true);
  });

  it('con un cargo vencido sin pagar, NO se devuelve — y se dice por qué', async () => {
    const admin = await entrar('colegio-s', 'admin@s.mx');

    // Segunda salida, también por cuenta de un tercero. Nace vencida y el
    // crédito no puede tocarla: es el único camino por el que saldo a favor y
    // adeudo vencido coexisten, y justo el que esta regla protege.
    await post(admin, '/catalogo-cargos', {
      clave: 'excursion-planetario',
      nombre: 'Excursión al planetario',
      periodicidad: 'UNICO',
      monto: '300.00',
      diaVencimiento: 20,
      vigenteDesde: INICIO_CICLO,
      esColegiatura: false,
      aceptaSaldoAFavor: false,
    });
    const { cuerpo: generacion } = await post<GeneracionRespuesta>(admin, '/cargos/generar', {
      periodo: MES_3,
    });
    // El crédito de 200 sigue intacto: la nueva salida no lo consumió.
    expect(generacion.saldoAFavorAplicado).toBe('0.00');

    const rocio = await entrar('colegio-s', 'rocio@s.mx');
    const { cuerpo } = await get<EstadoDeCuentaRespuesta>(
      rocio,
      `/mis-hijos/${ids.mariana!}/estado-de-cuenta`,
    );

    expect(cuerpo.saldoAFavor).toBe('200.00');
    expect(cuerpo.devolucionDeSaldo.permitido).toBe(false);
    expect(cuerpo.devolucionDeSaldo.motivo).toMatch(/cargos vencidos/);
  });
});
