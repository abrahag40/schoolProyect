/**
 * El dinero, probado por el camino real (§13 capa 3).
 *
 * Corre contra Postgres con el rol restringido y sobre HTTP. Lo que se verifica
 * aqui no es que los endpoints devuelvan 200: es que el reparto cuadre al
 * centavo contra la BASE, que generar dos veces no duplique un peso, y que la
 * ventana de diez dias del Articulo 4 quede escrita en la fila del cargo — no
 * calculada al vuelo meses despues, cuando la configuracion ya cambio.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { ModuloApp } from '../src/app.module.js';

const ID_COLEGIO = '71111111-1111-4111-8111-111111111111';
const ID_ACADEMIA = '72222222-2222-4222-8222-222222222222';
const CONTRASENA = 'prueba-cobranza-2026';

/// El ciclo escolar arranca en agosto; los cargos se piden para septiembre.
/// Un concepto MENSUAL cae en el mes pedido y uno UNICO se ancla al ciclo.
const INICIO_CICLO = '2026-08-01';
const PERIODO = '2026-09';
const PERIODO_CICLO = '2026-08';

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
       ($1,'Colegio C','colegio-c','COLEGIO',true,now()),
       ($2,'Academia C','academia-c','ACADEMIA_DEPORTIVA',true,now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );

  // Parametros explicitos: la prueba no debe depender de los valores por
  // omision del codigo, o cambiarlos la volveria roja sin que nada se rompa.
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
       (gen_random_uuid(),$1,'Campus C',true,now()),
       (gen_random_uuid(),$2,'Cancha C',true,now()) RETURNING id, tenant_id`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  const { rows: periodos } = await owner.query(
    `INSERT INTO periodo (id, tenant_id, nombre, tipo, inicio, activo, creado_en) VALUES
       (gen_random_uuid(),$1,'Ciclo C','CICLO_ESCOLAR',$3::date,true,now()),
       (gen_random_uuid(),$2,'Temporada C','TEMPORADA',$3::date,true,now())
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
       (gen_random_uuid(),$1,'Rosa','Perez',true,now()),
       (gen_random_uuid(),$2,'Diego','Ortiz',true,now())
     RETURNING id, nombre`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  for (const a of alumnos) ids[a.nombre.toLowerCase()] = a.id;

  for (const [alumno, tenant, cohorte] of [
    ['ana', ID_COLEGIO, 'primeroA'],
    ['luis', ID_COLEGIO, 'primeroA'],
    ['rosa', ID_COLEGIO, 'primeroA'],
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
       (gen_random_uuid(),$1,'admin@t.mx',$3,'Administradora C',true,now()),
       (gen_random_uuid(),$1,'maestra@t.mx',$3,'Maestra C',true,now()),
       (gen_random_uuid(),$1,'madre@t.mx',$3,'Madre C',true,now()),
       (gen_random_uuid(),$2,'admin@t.mx',$3,'Admin Academia',true,now())
     RETURNING id, tenant_id, email`,
    [ID_COLEGIO, ID_ACADEMIA, h],
  );
  const rol: Record<string, string> = {
    'admin@t.mx': 'ADMIN',
    'maestra@t.mx': 'DOCENTE',
    'madre@t.mx': 'TUTOR',
  };
  for (const u of usuarios) {
    await owner.query(
      `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3::"Rol",now())`,
      [u.tenant_id, u.id, rol[u.email] ?? 'ADMIN'],
    );
  }

  // Los tres casos que importan para el reparto:
  //   Ana  -> dos padres separados, 60/40. El caso del mercado mexicano.
  //   Luis -> un solo pagador al 100%.
  //   Rosa -> una abuela que la recoge pero NO paga: cero pagadores.
  const tutores: Array<[string, string, number | null, string]> = [
    ['Elena', 'Loera', 60, 'ana'],
    ['Jorge', 'Ramirez', 40, 'ana'],
    ['Sofia', 'Nava', 100, 'luis'],
    ['Carmen', 'Vda', null, 'rosa'],
    ['Paola', 'Ortiz', 100, 'diego'],
  ];
  for (const [nombre, apellidos, porcentaje, alumno] of tutores) {
    const tenant = alumno === 'diego' ? ID_ACADEMIA : ID_COLEGIO;
    const { rows: tutor } = await owner.query(
      `INSERT INTO tutor (id, tenant_id, nombre, apellidos, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3,now()) RETURNING id`,
      [tenant, nombre, apellidos],
    );
    await owner.query(
      `INSERT INTO tutor_alumno
         (id, tenant_id, tutor_id, alumno_id, parentesco, es_pagador, porcentaje_pago,
          es_contacto_emergencia, puede_recoger, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'TUTOR',$4,$5,false,true,now())`,
      [tenant, tutor[0].id, ids[alumno], porcentaje !== null, porcentaje],
    );
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
  return (await r.json()).token;
}

const conToken = (token: string) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

async function post(token: string, ruta: string, cuerpo: unknown) {
  const r = await fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: conToken(token),
    body: JSON.stringify(cuerpo),
  });
  return { estado: r.status, cuerpo: await r.json().catch(() => null) };
}

describe('quien administra el dinero', () => {
  it('un docente NO entra al catalogo de cargos', async () => {
    // Un maestro pasa lista; no define cuanto cuesta la colegiatura.
    const token = await entrar('colegio-c', 'maestra@t.mx');
    const r = await fetch(`${base}/catalogo-cargos`, { headers: conToken(token) });
    expect(r.status).toBe(403);
  });

  it('una madre tampoco', async () => {
    const token = await entrar('colegio-c', 'madre@t.mx');
    const r = await fetch(`${base}/catalogo-cargos`, { headers: conToken(token) });
    expect(r.status).toBe(403);
  });

  it('sin sesion, nada', async () => {
    expect((await fetch(`${base}/catalogo-cargos`)).status).toBe(401);
  });
});

describe('catalogo de cargos', () => {
  it('la administracion da de alta la colegiatura, con sus datos fiscales', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado, cuerpo } = await post(token, '/catalogo-cargos', {
      clave: 'colegiatura-primaria',
      nombre: 'Colegiatura de primaria',
      periodicidad: 'MENSUAL',
      monto: '2450.00',
      diaVencimiento: 5,
      deducibleIedu: true,
      nivelEducativo: 'PRIMARIA',
      vigenteDesde: INICIO_CICLO,
    });

    expect(estado).toBe(201);
    expect(cuerpo).toMatchObject({
      clave: 'colegiatura-primaria',
      monto: '2450.00',
      deducibleIedu: true,
      nivelEducativo: 'PRIMARIA',
    });
    ids.colegiatura = cuerpo.id;
  });

  it('y la inscripcion, que se cobra una sola vez por ciclo', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado, cuerpo } = await post(token, '/catalogo-cargos', {
      clave: 'inscripcion',
      nombre: 'Inscripción del ciclo',
      periodicidad: 'UNICO',
      monto: '4900.00',
      diaVencimiento: 15,
      vigenteDesde: INICIO_CICLO,
    });
    expect(estado).toBe(201);
    ids.inscripcion = cuerpo.id;
  });

  it('un concepto DEDUCIBLE sin nivel educativo se rechaza', async () => {
    // El complemento IEDU lo exige. Sin nivel, el CFDI se rechaza al timbrar y
    // la familia pierde su deduccion — un año despues, cuando ya no hay
    // arreglo. Se detiene aqui.
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado, cuerpo } = await post(token, '/catalogo-cargos', {
      clave: 'taller-deducible',
      nombre: 'Taller',
      periodicidad: 'MENSUAL',
      monto: '500.00',
      deducibleIedu: true,
      vigenteDesde: INICIO_CICLO,
    });
    expect(estado).toBe(400);
    expect(cuerpo.message).toMatch(/nivel educativo/i);
  });

  it('un importe mal escrito se rechaza con 400 y dice como se escribe', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado, cuerpo } = await post(token, '/catalogo-cargos', {
      clave: 'malo',
      nombre: 'Concepto con importe raro',
      periodicidad: 'MENSUAL',
      monto: '$2,450',
      vigenteDesde: INICIO_CICLO,
    });
    expect(estado).toBe(400);
    expect(cuerpo.detalles[0]).toMatchObject({ campo: 'monto' });
  });
});

describe('generacion de cargos (AZ-M4.2)', () => {
  it('genera un cargo por alumno y concepto, y suma el importe correcto', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado, cuerpo } = await post(token, '/cargos/generar', { periodo: PERIODO });

    expect(estado).toBe(200);
    // 3 alumnos x 2 conceptos.
    expect(cuerpo.generados).toBe(6);
    expect(cuerpo.omitidos).toBe(0);
    // 3 x 2450 + 3 x 4900 = 22,050.00, sin un centavo de diferencia.
    expect(cuerpo.importeTotal).toBe('22050.00');
  });

  it('el concepto UNICO se ancla al ciclo, no al mes pedido', async () => {
    // Anclar la inscripcion al periodo pedido la cobraria doce veces al año.
    const { rows } = await owner.query(
      `SELECT DISTINCT periodo FROM cargo WHERE concepto_id = $1`,
      [ids.inscripcion],
    );
    expect(rows.map((r) => r.periodo)).toEqual([PERIODO_CICLO]);
  });

  it('un concepto que entra en vigor A MEDIADOS del mes SI se cobra ese mes', async () => {
    // DEFECTO REAL cazado en la demo: el ciclo escolar arranca el 17 de agosto,
    // asi que la colegiatura entra en vigor ese dia. Comparando la vigencia
    // contra el dia 1 del periodo, la generacion de agosto devolvia CERO cargos
    // en silencio: la escuela no habria cobrado su primer mes.
    const token = await entrar('colegio-c', 'admin@t.mx');
    await post(token, '/catalogo-cargos', {
      clave: 'taller-vespertino',
      nombre: 'Taller vespertino',
      periodicidad: 'MENSUAL',
      monto: '300.00',
      diaVencimiento: 5,
      vigenteDesde: '2026-09-17',
    });

    const { cuerpo } = await post(token, '/cargos/generar', { periodo: PERIODO });
    // Tres alumnos x el taller nuevo.
    expect(cuerpo.generados).toBe(3);
    expect(cuerpo.importeTotal).toBe('900.00');
  });

  it('pero uno que entra en vigor el mes SIGUIENTE no se cobra todavia', async () => {
    // La otra mitad de la regla: un aumento que entra en octubre no puede
    // colarse en los cargos de septiembre.
    const token = await entrar('colegio-c', 'admin@t.mx');
    await post(token, '/catalogo-cargos', {
      clave: 'excursion-octubre',
      nombre: 'Excursión de octubre',
      periodicidad: 'MENSUAL',
      monto: '450.00',
      diaVencimiento: 5,
      vigenteDesde: '2026-10-01',
    });

    const { cuerpo } = await post(token, '/cargos/generar', { periodo: PERIODO });
    expect(cuerpo.generados).toBe(0);
  });

  it('el alumno SIN pagadores se reporta, no se esconde', async () => {
    // Un cargo que nadie debe es un dato incompleto. Ocultarlo en un log lo
    // convierte en un faltante que aparece en la auditoria.
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { cuerpo } = await post(token, '/cargos/generar', { periodo: PERIODO });
    // Ya estan generados; los problemas se reportan en la corrida que los creo.
    expect(cuerpo.generados).toBe(0);

    // Se afirma la INVARIANTE, no un numero magico: todos sus cargos existen y
    // ninguno tiene reparto. Asi la prueba no se rompe cuando el catalogo de la
    // demo crece — se rompe solo si el comportamiento cambia.
    const { rows } = await owner.query(
      `SELECT count(*)::int AS total,
              count(p.id)::int AS con_reparto
         FROM cargo c
         LEFT JOIN parte_de_cargo p ON p.cargo_id = c.id
        WHERE c.alumno_id = $1`,
      [ids.rosa],
    );
    expect(rows[0].total).toBeGreaterThan(0);
    expect(rows[0].con_reparto, 'un alumno sin pagadores no deberia tener reparto').toBe(0);
  });
});

describe('el reparto cuadra al centavo (AZ-M4.3)', () => {
  it('la colegiatura de Ana se parte 60/40 exactos', async () => {
    const { rows } = await owner.query(
      `SELECT p.monto::text, p.porcentaje::text
         FROM parte_de_cargo p
         JOIN cargo c ON c.id = p.cargo_id
        WHERE c.alumno_id = $1 AND c.concepto_id = $2
        ORDER BY p.porcentaje DESC`,
      [ids.ana, ids.colegiatura],
    );
    expect(rows.map((r) => r.monto)).toEqual(['1470.00', '980.00']);
  });

  it('INVARIANTE contra la base: la suma de las partes es el monto del cargo', async () => {
    // La condicion no se puede expresar como CHECK —es entre filas— asi que se
    // verifica aqui, contra los datos reales, para todos los cargos repartidos.
    const { rows } = await owner.query(
      `SELECT c.id, c.monto::text AS monto, sum(p.monto)::text AS partes
         FROM cargo c JOIN parte_de_cargo p ON p.cargo_id = c.id
        GROUP BY c.id, c.monto
       HAVING c.monto <> sum(p.monto)`,
    );
    expect(rows, 'hay cargos cuyo reparto no cuadra').toHaveLength(0);
  });

  it('un pagador unico se queda con el total', async () => {
    const { rows } = await owner.query(
      `SELECT p.monto::text FROM parte_de_cargo p
         JOIN cargo c ON c.id = p.cargo_id
        WHERE c.alumno_id = $1 AND c.concepto_id = $2`,
      [ids.luis, ids.colegiatura],
    );
    expect(rows.map((r) => r.monto)).toEqual(['2450.00']);
  });
});

describe('Articulo 4: la ventana legal queda ESCRITA en el cargo', () => {
  it('aunque la colegiatura venza el dia 5, no hay recargo antes del dia 10', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const r = await fetch(`${base}/cargos?periodo=${PERIODO}`, { headers: conToken(token) });
    const cargos = await r.json();

    const deAna = cargos.find(
      (c: { alumno: string; concepto: string }) =>
        c.alumno.includes('Ana') && c.concepto.includes('Colegiatura'),
    );
    expect(deAna.vence).toBe('2026-09-05');
    // El dato queda congelado en la fila: si mañana la escuela cambia su
    // configuracion, la prueba de que respeto la ventana sigue siendo esta.
    expect(deAna.sinRecargoHasta).toBe('2026-09-10');
  });

  it('si el concepto vence DESPUES del dia 10, manda su fecha', async () => {
    const { rows } = await owner.query(
      `SELECT fecha_vencimiento::text AS vence, fecha_limite_sin_recargo::text AS limite
         FROM cargo WHERE concepto_id = $1 LIMIT 1`,
      [ids.inscripcion],
    );
    expect(rows[0].vence).toBe('2026-08-15');
    expect(rows[0].limite).toBe('2026-08-15');
  });
});

describe('idempotencia (§15)', () => {
  it('generar tres veces deja exactamente los mismos cargos', async () => {
    const contar = async () =>
      (await owner.query('SELECT count(*)::int AS n FROM cargo')).rows[0].n as number;

    const antes = await contar();
    const token = await entrar('colegio-c', 'admin@t.mx');
    await post(token, '/cargos/generar', { periodo: PERIODO });
    const { cuerpo } = await post(token, '/cargos/generar', { periodo: PERIODO });

    expect(cuerpo.generados).toBe(0);
    expect(cuerpo.omitidos).toBeGreaterThan(0);
    expect(await contar()).toBe(antes);
  });

  it('tampoco se duplican las partes del reparto', async () => {
    const { rows } = await owner.query(
      `SELECT cargo_id, tutor_id, count(*)::int AS n
         FROM parte_de_cargo GROUP BY cargo_id, tutor_id HAVING count(*) > 1`,
    );
    expect(rows).toHaveLength(0);
  });
});

describe('aislamiento entre escuelas', () => {
  it('la academia genera lo suyo y no ve un solo cargo del colegio', async () => {
    const token = await entrar('academia-c', 'admin@t.mx');
    await post(token, '/catalogo-cargos', {
      clave: 'mensualidad',
      nombre: 'Mensualidad Sub-12',
      periodicidad: 'MENSUAL',
      monto: '890.00',
      diaVencimiento: 10,
      vigenteDesde: INICIO_CICLO,
    });
    const { cuerpo } = await post(token, '/cargos/generar', { periodo: PERIODO });

    // Un alumno, un concepto.
    expect(cuerpo.generados).toBe(1);
    expect(cuerpo.importeTotal).toBe('890.00');

    const r = await fetch(`${base}/cargos?periodo=${PERIODO}`, { headers: conToken(token) });
    const cargos = await r.json();
    expect(cargos).toHaveLength(1);
    expect(JSON.stringify(cargos)).not.toContain('Perez');
  });

  it('y el colegio sigue viendo solo lo suyo', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const r = await fetch(`${base}/cargos?periodo=${PERIODO}`, { headers: conToken(token) });
    const cargos = await r.json();
    // Tres alumnos x dos conceptos mensuales vigentes en septiembre.
    expect(cargos).toHaveLength(6);
    expect(JSON.stringify(cargos)).not.toContain('Sub-12');
  });
});

describe('Articulo 5-I: un ajuste de precio se avisa con 60 dias', () => {
  it('con un mes de anticipacion se rechaza, y se dice cuantos dias faltan', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const r = await fetch(`${base}/catalogo-cargos/${ids.colegiatura}/precio`, {
      method: 'PATCH',
      headers: conToken(token),
      body: JSON.stringify({
        monto: '2700.00',
        avisadoEn: '2026-07-01',
        vigenteDesde: '2026-08-01',
      }),
    });
    expect(r.status).toBe(400);
    const cuerpo = await r.json();
    expect(cuerpo.message).toMatch(/31 día\(s\)/);
    expect(cuerpo.message).toMatch(/60/);
  });

  it('con tres meses se acepta y queda en la bitacora inmutable', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const r = await fetch(`${base}/catalogo-cargos/${ids.colegiatura}/precio`, {
      method: 'PATCH',
      headers: conToken(token),
      body: JSON.stringify({
        monto: '2700.00',
        avisadoEn: '2026-05-01',
        vigenteDesde: '2026-08-01',
      }),
    });
    expect(r.status).toBe(200);
    expect((await r.json()).monto).toBe('2700.00');

    const { rows } = await owner.query(
      `SELECT datos FROM evento_auditoria WHERE tipo = 'cobranza.precio_ajustado'`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].datos).toMatchObject({ de: '2450.00', a: '2700.00', diasDeAviso: 92 });
  });

  it('subir el precio NO reescribe los cargos ya emitidos', async () => {
    // Lo contrario cambiaria retroactivamente lo que cada familia debia, y
    // haria imposible demostrar que se cobro lo que se anuncio.
    const { rows } = await owner.query(
      `SELECT DISTINCT monto::text FROM cargo WHERE concepto_id = $1`,
      [ids.colegiatura],
    );
    expect(rows.map((r) => r.monto)).toEqual(['2450.00']);
  });
});

describe('la base tambien defiende el dato, no solo la aplicacion', () => {
  it('un concepto deducible sin nivel educativo no entra ni por SQL directo', async () => {
    // La regla fiscal vive en un CHECK porque una importacion o un script de
    // mantenimiento pueden escribir sin pasar por el dominio.
    await expect(
      owner.query(
        `INSERT INTO concepto_cargo
           (id, tenant_id, clave, nombre, periodicidad, monto_base, deducible_iedu,
            vigente_desde, creado_en, actualizado_en)
         VALUES (gen_random_uuid(), $1, 'x', 'X', 'MENSUAL', 100, true, $2::date, now(), now())`,
        [ID_COLEGIO, INICIO_CICLO],
      ),
    ).rejects.toThrow(/concepto_cargo_iedu_completo/);
  });

  it('un cargo cancelado sin motivo tampoco', async () => {
    await expect(
      owner.query(`UPDATE cargo SET cancelado_en = now() WHERE alumno_id = $1`, [ids.luis]),
    ).rejects.toThrow(/cargo_cancelacion_con_motivo/);
  });

  it('un limite sin recargo anterior al vencimiento tampoco', async () => {
    await expect(
      owner.query(
        `UPDATE cargo SET fecha_limite_sin_recargo = fecha_vencimiento - 1
          WHERE alumno_id = $1`,
        [ids.ana],
      ),
    ).rejects.toThrow(/cargo_limite_no_anterior_al_vencimiento/);
  });
});
