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
// Antes del periodo que se cobra: quien ya estaba inscrito paga el mes entero.
const ALTA_AL_INICIO_DEL_CICLO = '2026-08-01';
const PERIODO_CICLO = '2026-08';

/** Contratos de lo que responde el API, declarados una vez. */
interface ConceptoRespuesta {
  id: string;
  clave: string;
  monto: string;
  deducibleIedu: boolean;
  nivelEducativo: string | null;
}

interface GeneracionRespuesta {
  periodo: string;
  generados: number;
  omitidos: number;
  importeTotal: string;
  problemas: Array<{ alumno: string; concepto: string; motivo: string }>;
}

interface CargoRespuesta {
  id: string;
  alumno: string;
  concepto: string;
  monto: string;
  vence: string;
  sinRecargoHasta: string;
  estado: string;
  partes: Array<{ tutor: string; porcentaje: string; monto: string }>;
}

interface ErrorRespuesta {
  message?: string;
  detalles?: Array<{ campo: string; mensaje: string }>;
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
    'rvoe',
    'aceptacion_de_cuota',
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

  // El RVOE va POR NIVEL (AZ-A1). Sin el capturado, el catalogo rechaza crear
  // un concepto deducible: el complemento IEDU lo exige y sin el, el SAT
  // rechaza la factura al timbrar.
  for (const s of sedes) {
    await owner.query(
      `INSERT INTO rvoe (id, tenant_id, sede_id, nivel_educativo, acuerdo, creado_en)
       VALUES (gen_random_uuid(), $1, $2, 'PRIMARIA', 'ACUERDO PRUEBA/2024', now())`,
      [s.tenant_id, s.id],
    );
  }
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
      // ALTA CON FECHA FIJA, NUNCA now(). Estos alumnos se inscribieron al
      // empezar el ciclo, que es el caso normal y el que estas pruebas afirman.
      //
      // POR QUE IMPORTA: con `now()` el prorrateo (AZ-M4.1) entraba solo en
      // cuanto la fecha real del dia caia DENTRO de `PERIODO`, y los importes
      // esperados dejaban de cuadrar. La suite pasaba el 1 de septiembre
      // —`alta = inicio del periodo` devuelve el cargo completo— y se ponia
      // roja del 2 en adelante, sin que nadie hubiera tocado el codigo.
      //
      // Una prueba cuyo resultado depende del dia en que se corre no afirma
      // nada sobre el sistema: afirma algo sobre el calendario. El prorrateo
      // se ejercita ADREDE mas abajo, con su propio alumno y su propia fecha.
      `INSERT INTO inscripcion (id, tenant_id, alumno_id, cohorte_id, estado, alta_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'ACTIVA',$4::date)`,
      [tenant, ids[alumno], ids[cohorte], ALTA_AL_INICIO_DEL_CICLO],
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
    const { estado, cuerpo } = await post<ConceptoRespuesta & ErrorRespuesta>(
      token,
      '/catalogo-cargos',
      {
        clave: 'colegiatura-primaria',
        nombre: 'Colegiatura de primaria',
        periodicidad: 'MENSUAL',
        monto: '2450.00',
        diaVencimiento: 5,
        deducibleIedu: true,
        nivelEducativo: 'PRIMARIA',
        vigenteDesde: INICIO_CICLO,
      },
    );

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
    const { estado, cuerpo } = await post<ConceptoRespuesta & ErrorRespuesta>(
      token,
      '/catalogo-cargos',
      {
        clave: 'inscripcion',
        nombre: 'Inscripción del ciclo',
        periodicidad: 'UNICO',
        monto: '4900.00',
        diaVencimiento: 15,
        vigenteDesde: INICIO_CICLO,
      },
    );
    expect(estado).toBe(201);
    ids.inscripcion = cuerpo.id;
  });

  it('un concepto DEDUCIBLE sin nivel educativo se rechaza', async () => {
    // El complemento IEDU lo exige. Sin nivel, el CFDI se rechaza al timbrar y
    // la familia pierde su deduccion — un año despues, cuando ya no hay
    // arreglo. Se detiene aqui.
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado, cuerpo } = await post<ConceptoRespuesta & ErrorRespuesta>(
      token,
      '/catalogo-cargos',
      {
        clave: 'taller-deducible',
        nombre: 'Taller',
        periodicidad: 'MENSUAL',
        monto: '500.00',
        deducibleIedu: true,
        vigenteDesde: INICIO_CICLO,
      },
    );
    expect(estado).toBe(400);
    expect(cuerpo.message).toMatch(/nivel educativo/i);
  });

  it('un importe mal escrito se rechaza con 400 y dice como se escribe', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado, cuerpo } = await post<ConceptoRespuesta & ErrorRespuesta>(
      token,
      '/catalogo-cargos',
      {
        clave: 'malo',
        nombre: 'Concepto con importe raro',
        periodicidad: 'MENSUAL',
        monto: '$2,450',
        vigenteDesde: INICIO_CICLO,
      },
    );
    expect(estado).toBe(400);
    expect(cuerpo.detalles![0]).toMatchObject({ campo: 'monto' });
  });
});

describe('generacion de cargos (AZ-M4.2)', () => {
  it('genera un cargo por alumno y concepto, y suma el importe correcto', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado, cuerpo } = await post<GeneracionRespuesta>(token, '/cargos/generar', {
      periodo: PERIODO,
    });

    expect(estado).toBe(200);
    // 3 alumnos x 2 conceptos.
    expect(cuerpo.generados).toBe(6);
    expect(cuerpo.omitidos).toBe(0);
    // 3 x 2450 + 3 x 4900 = 22,050.00, sin un centavo de diferencia.
    expect(cuerpo.importeTotal).toBe('22050.00');
  });

  it('quien se inscribe a mitad del mes paga solo los dias que le tocan (AZ-M4.1)', async () => {
    // LA TERCERA PATA DE §13, que faltaba. El prorrateo tenia prueba pura y de
    // NO-camino en `descuentos.test.ts`, pero ninguna que lo viera cruzar la
    // base de datos. Se ejercitaba solo por accidente —porque la siembra usaba
    // `now()`— y ese accidente se disfrazaba de fallo cuando el calendario
    // entraba en el periodo de la prueba. Un camino que solo se recorre por
    // casualidad no esta cubierto: esta sin cubrir y con suerte.
    const {
      rows: [sofia],
    } = await owner.query(
      `INSERT INTO alumno (id, tenant_id, nombre, apellidos, activo, creado_en)
       VALUES (gen_random_uuid(),$1,'Sofia','Tarde',true,now()) RETURNING id`,
      [ID_COLEGIO],
    );
    await owner.query(
      `INSERT INTO inscripcion (id, tenant_id, alumno_id, cohorte_id, estado, alta_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'ACTIVA','2026-09-11'::date)`,
      [ID_COLEGIO, sofia.id, ids.primeroA],
    );
    // Con pagadora, para que la invariante de mas abajo tambien la cubra: lo
    // que se reparte tiene que ser el NETO, no el precio de lista.
    const {
      rows: [tutora],
    } = await owner.query(
      `INSERT INTO tutor (id, tenant_id, nombre, apellidos, creado_en)
       VALUES (gen_random_uuid(),$1,'Marta','Tarde',now()) RETURNING id`,
      [ID_COLEGIO],
    );
    await owner.query(
      `INSERT INTO tutor_alumno
         (id, tenant_id, tutor_id, alumno_id, parentesco, es_pagador, porcentaje_pago,
          es_contacto_emergencia, puede_recoger, creado_en)
       VALUES (gen_random_uuid(),$1,$2,$3,'TUTOR',true,100,false,true,now())`,
      [ID_COLEGIO, tutora.id, sofia.id],
    );

    const token = await entrar('colegio-c', 'admin@t.mx');
    const { estado } = await post<GeneracionRespuesta>(token, '/cargos/generar', {
      periodo: PERIODO,
    });
    expect(estado).toBe(200);

    // Septiembre dura 30 dias; entra el 11 y le quedan 20 (los dos extremos
    // cuentan, §57). Colegiatura 2,450 x 20/30 = 1,633.33, luego el descuento
    // son 816.67. Los numeros van escritos y no calculados: una prueba que
    // repite la formula del codigo no prueba la formula, la copia.
    const { rows: prorrateos } = await owner.query(
      `SELECT c.monto::text AS lista, d.monto::text AS descuento, d.concepto
         FROM cargo c
         JOIN descuento_de_cargo d ON d.cargo_id = c.id
        WHERE c.alumno_id = $1 AND d.categoria = 'PRORRATEO'`,
      [sofia.id],
    );
    expect(prorrateos).toHaveLength(1);
    expect(prorrateos[0]).toMatchObject({ lista: '2450.00', descuento: '816.67' });
    expect(prorrateos[0].concepto).toContain('20 de 30 días');

    // Y el reparto se hace sobre el neto, no sobre el precio de lista.
    const { rows: partes } = await owner.query(
      `SELECT p.monto::text FROM parte_de_cargo p
         JOIN cargo c ON c.id = p.cargo_id
        WHERE c.alumno_id = $1 AND c.monto = 2450`,
      [sofia.id],
    );
    expect(partes.map((r) => r.monto)).toEqual(['1633.33']);

    // ------------------------------------------------------------------
    // Y LA ESCUELA TIENE QUE VER LO MISMO QUE LA FAMILIA.
    //
    // DEFECTO REAL visto en staging el 4-sep-2026: el estado de cuenta restaba
    // el prorrateo y pedia lo correcto, pero el panel de morosidad sumaba
    // `cargo.monto` —el precio de LISTA (§43)— y le decia a la escuela que
    // cobrara de mas. Dos pantallas hablando del mismo dinero sin coincidir, y
    // la equivocada era la que dice a quien perseguir.
    // ------------------------------------------------------------------
    const rMor = await fetch(`${base}/morosidad`, { headers: conToken(token) });
    const mor = (await rMor.json()) as {
      familias: Array<{ alumno: string; saldo: string }>;
    };
    const deSofia = mor.familias.find((f) => f.alumno === 'Tarde, Sofia');
    // 1,633.33 de colegiatura prorrateada + 4,900 del concepto UNICO, que no
    // se prorratea. El numero va escrito: derivarlo aqui repetiria la formula.
    expect(deSofia?.saldo).toBe('6533.33');

    // NO-camino: el concepto UNICO del mismo alumno NO se prorratea. Entrar
    // tarde no abarata una inscripcion (§57).
    const { rows: unicos } = await owner.query(
      `SELECT c.monto::text AS lista, count(d.id)::int AS descuentos
         FROM cargo c
         LEFT JOIN descuento_de_cargo d ON d.cargo_id = c.id
        WHERE c.alumno_id = $1 AND c.monto = 4900
        GROUP BY c.id, c.monto`,
      [sofia.id],
    );
    expect(unicos).toEqual([{ lista: '4900.00', descuentos: 0 }]);
  });

  it('el concepto UNICO se ancla al CICLO y lleva su propia clave', async () => {
    // Anclar la inscripcion al periodo pedido la cobraria doce veces al año.
    //
    // CAMBIO DELIBERADO DEL SPRINT 6 (AZ-M4.1c): antes la clave era `2026-08`,
    // el MES en que arrancaba el ciclo — un mes disfrazado de ciclo, que
    // funcionaba de casualidad porque nada mas usaba esa forma. Ahora un cobro
    // de una sola vez tiene su propia clave, `2026-A1`, y es indistinguible de
    // los demas periodos ciclicos. Sin esto, un semestre y el mes de arranque
    // del ciclo competirian por el mismo identificador.
    const { rows } = await owner.query(
      `SELECT DISTINCT periodo FROM cargo WHERE concepto_id = $1`,
      [ids.inscripcion!],
    );
    expect(rows.map((r) => r.periodo)).toEqual([`${PERIODO_CICLO.slice(0, 4)}-A1`]);
  });

  it('un concepto que entra en vigor A MEDIADOS del mes SI se cobra ese mes', async () => {
    // DEFECTO REAL cazado en la demo: el ciclo escolar arranca el 17 de agosto,
    // asi que la colegiatura entra en vigor ese dia. Comparando la vigencia
    // contra el dia 1 del periodo, la generacion de agosto devolvia CERO cargos
    // en silencio: la escuela no habria cobrado su primer mes.
    const token = await entrar('colegio-c', 'admin@t.mx');
    await post<ConceptoRespuesta & ErrorRespuesta>(token, '/catalogo-cargos', {
      clave: 'taller-vespertino',
      nombre: 'Taller vespertino',
      periodicidad: 'MENSUAL',
      monto: '300.00',
      diaVencimiento: 5,
      vigenteDesde: '2026-09-17',
    });

    const { cuerpo } = await post<GeneracionRespuesta>(token, '/cargos/generar', {
      periodo: PERIODO,
    });
    // UN cargo por cada alumno inscrito, y el numero se CUENTA en la base en
    // vez de escribirse aqui. Lo que esta prueba defiende es que no salgan
    // CERO en silencio; atarla ademas a "tres" la volvia roja cada vez que la
    // siembra crecia, que es ruido disfrazado de cobertura.
    const { rows: inscritos } = await owner.query(
      `SELECT count(*)::int AS n FROM inscripcion
        WHERE tenant_id = $1 AND estado = 'ACTIVA'`,
      [ID_COLEGIO],
    );
    expect(cuerpo.generados).toBe(inscritos[0].n);
    // El importe NO se recalcula con la formula del codigo —copiarla no la
    // prueba—: se afirma que cada cargo nuevo existe y ninguno salio en cero.
    const { rows: nuevos } = await owner.query(
      `SELECT c.monto::text AS monto FROM cargo c
         JOIN concepto_cargo cc ON cc.id = c.concepto_id
        WHERE cc.clave = 'taller-vespertino'`,
    );
    expect(nuevos).toHaveLength(inscritos[0].n);
    expect(nuevos.every((r: { monto: string }) => Number(r.monto) > 0)).toBe(true);
  });

  it('pero uno que entra en vigor el mes SIGUIENTE no se cobra todavia', async () => {
    // La otra mitad de la regla: un aumento que entra en octubre no puede
    // colarse en los cargos de septiembre.
    const token = await entrar('colegio-c', 'admin@t.mx');
    await post<ConceptoRespuesta & ErrorRespuesta>(token, '/catalogo-cargos', {
      clave: 'excursion-octubre',
      nombre: 'Excursión de octubre',
      periodicidad: 'MENSUAL',
      monto: '450.00',
      diaVencimiento: 5,
      vigenteDesde: '2026-10-01',
    });

    const { cuerpo } = await post<GeneracionRespuesta>(token, '/cargos/generar', {
      periodo: PERIODO,
    });
    expect(cuerpo.generados).toBe(0);
  });

  it('el alumno SIN pagadores se reporta, no se esconde', async () => {
    // Un cargo que nadie debe es un dato incompleto. Ocultarlo en un log lo
    // convierte en un faltante que aparece en la auditoria.
    const token = await entrar('colegio-c', 'admin@t.mx');
    const { cuerpo } = await post<GeneracionRespuesta>(token, '/cargos/generar', {
      periodo: PERIODO,
    });
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
      [ids.rosa!],
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
      [ids.ana!, ids.colegiatura!],
    );
    expect(rows.map((r) => r.monto)).toEqual(['1470.00', '980.00']);
  });

  it('INVARIANTE contra la base: precio de lista − descuentos = suma de las partes', async () => {
    // La condicion no se puede expresar como CHECK —es entre filas— asi que se
    // verifica aqui, contra los datos reales, para todos los cargos repartidos.
    //
    // La invariante crecio en el Sprint 6: el cargo guarda su PRECIO DE LISTA y
    // los descuentos de emision (prorrateo, becas) viven como asientos, asi que
    // lo que se reparte entre los pagadores es el neto. Si esto no cierra, hay
    // un renglon del estado de cuenta que nadie puede justificar.
    //
    // Solo cuentan los descuentos SIN parte: los de emision. Un pronto pago se
    // ata a la parte de quien pago temprano y salda su saldo, no rebaja el
    // reparto — por eso se excluye aqui y se verifica en `saldos`.
    const { rows } = await owner.query(
      `SELECT c.id, c.monto::text AS monto, sum(p.monto)::text AS partes
         FROM cargo c
         JOIN parte_de_cargo p ON p.cargo_id = c.id
        GROUP BY c.id, c.monto
       HAVING c.monto - coalesce((
                SELECT sum(d.monto) FROM descuento_de_cargo d
                 WHERE d.cargo_id = c.id AND d.parte_de_cargo_id IS NULL), 0)
              <> sum(p.monto)`,
    );
    expect(rows, 'hay cargos cuyo reparto no cuadra con sus descuentos').toHaveLength(0);
  });

  it('un pagador unico se queda con el total', async () => {
    const { rows } = await owner.query(
      `SELECT p.monto::text FROM parte_de_cargo p
         JOIN cargo c ON c.id = p.cargo_id
        WHERE c.alumno_id = $1 AND c.concepto_id = $2`,
      [ids.luis!, ids.colegiatura!],
    );
    expect(rows.map((r) => r.monto)).toEqual(['2450.00']);
  });
});

describe('Articulo 4: la ventana legal queda ESCRITA en el cargo', () => {
  it('aunque la colegiatura venza el dia 5, no hay recargo antes del dia 10', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const r = await fetch(`${base}/cargos?periodo=${PERIODO}`, { headers: conToken(token) });
    const cargos = (await r.json()) as CargoRespuesta[];

    const deAna = cargos.find(
      (c) => c.alumno.includes('Ana') && c.concepto.includes('Colegiatura'),
    )!;
    expect(deAna.vence).toBe('2026-09-05');
    // El dato queda congelado en la fila: si mañana la escuela cambia su
    // configuracion, la prueba de que respeto la ventana sigue siendo esta.
    expect(deAna.sinRecargoHasta).toBe('2026-09-10');
  });

  it('si el concepto vence DESPUES del dia 10, manda su fecha', async () => {
    const { rows } = await owner.query(
      `SELECT fecha_vencimiento::text AS vence, fecha_limite_sin_recargo::text AS limite
         FROM cargo WHERE concepto_id = $1 LIMIT 1`,
      [ids.inscripcion!],
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
    await post<GeneracionRespuesta>(token, '/cargos/generar', { periodo: PERIODO });
    const { cuerpo } = await post<GeneracionRespuesta>(token, '/cargos/generar', {
      periodo: PERIODO,
    });

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
    await post<ConceptoRespuesta & ErrorRespuesta>(token, '/catalogo-cargos', {
      clave: 'mensualidad',
      nombre: 'Mensualidad Sub-12',
      periodicidad: 'MENSUAL',
      monto: '890.00',
      diaVencimiento: 10,
      vigenteDesde: INICIO_CICLO,
    });
    const { cuerpo } = await post<GeneracionRespuesta>(token, '/cargos/generar', {
      periodo: PERIODO,
    });

    // Un alumno, un concepto.
    expect(cuerpo.generados).toBe(1);
    expect(cuerpo.importeTotal).toBe('890.00');

    const r = await fetch(`${base}/cargos?periodo=${PERIODO}`, { headers: conToken(token) });
    const cargos = (await r.json()) as CargoRespuesta[];
    expect(cargos).toHaveLength(1);
    expect(JSON.stringify(cargos)).not.toContain('Perez');
  });

  it('y el colegio sigue viendo solo lo suyo', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const r = await fetch(`${base}/cargos?periodo=${PERIODO}`, { headers: conToken(token) });
    const cargos = (await r.json()) as CargoRespuesta[];
    // Un alumno x cada concepto MENSUAL vigente en septiembre. Se cuenta contra
    // la base por lo mismo que arriba: lo que se afirma es el aislamiento entre
    // escuelas, no cuantos alumnos trae hoy la siembra.
    const { rows: esperados } = await owner.query(
      `SELECT count(*)::int AS n FROM cargo WHERE tenant_id = $1 AND periodo = $2`,
      [ID_COLEGIO, PERIODO],
    );
    expect(cargos).toHaveLength(esperados[0].n);
    expect(esperados[0].n).toBeGreaterThan(0);
    // LO QUE DE VERDAD SE PRUEBA: ni un solo cargo de la academia se cuela.
    expect(JSON.stringify(cargos)).not.toContain('Sub-12');
  });
});

describe('Articulo 5-I: un ajuste de precio se avisa con 60 dias', () => {
  it('con un mes de anticipacion se rechaza, y se dice cuantos dias faltan', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const r = await fetch(`${base}/catalogo-cargos/${ids.colegiatura!}/precio`, {
      method: 'PATCH',
      headers: conToken(token),
      body: JSON.stringify({
        monto: '2700.00',
        avisadoEn: '2026-07-01',
        vigenteDesde: '2026-08-01',
      }),
    });
    expect(r.status).toBe(400);
    const cuerpo = (await r.json()) as ErrorRespuesta;
    expect(cuerpo.message).toMatch(/31 día\(s\)/);
    expect(cuerpo.message).toMatch(/60/);
  });

  it('con tres meses se acepta y queda en la bitacora inmutable', async () => {
    const token = await entrar('colegio-c', 'admin@t.mx');
    const r = await fetch(`${base}/catalogo-cargos/${ids.colegiatura!}/precio`, {
      method: 'PATCH',
      headers: conToken(token),
      body: JSON.stringify({
        monto: '2700.00',
        avisadoEn: '2026-05-01',
        vigenteDesde: '2026-08-01',
      }),
    });
    expect(r.status).toBe(200);
    expect(((await r.json()) as { monto: string }).monto).toBe('2700.00');

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
      [ids.colegiatura!],
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
      owner.query(`UPDATE cargo SET cancelado_en = now() WHERE alumno_id = $1`, [ids.luis!]),
    ).rejects.toThrow(/cargo_cancelacion_con_motivo/);
  });

  it('un limite sin recargo anterior al vencimiento tampoco', async () => {
    await expect(
      owner.query(
        `UPDATE cargo SET fecha_limite_sin_recargo = fecha_vencimiento - 1
          WHERE alumno_id = $1`,
        [ids.ana!],
      ),
    ).rejects.toThrow(/cargo_limite_no_anterior_al_vencimiento/);
  });
});
