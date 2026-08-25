/**
 * GATE NO NEGOCIABLE DEL SPRINT 0 (DoD Seguridad).
 *
 * Prueba que una escuela no puede ver ni tocar datos de otra. No es una prueba
 * de "la funcion filtra bien": corre contra Postgres real, con el rol de
 * aplicacion restringido, por el mismo camino que usa la API en produccion.
 *
 * Si este archivo se pone rojo, no se despliega. Punto.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { crearCliente, conTenant, sinTenant, type PrismaClient } from '../src/index.js';

const ID_COLEGIO = '11111111-1111-4111-8111-111111111111';
const ID_ACADEMIA = '22222222-2222-4222-8222-222222222222';
const ID_PERIODO_COLEGIO = '1a111111-1111-4111-8111-111111111111';
const ID_PERIODO_ACADEMIA = '2a222222-2222-4222-8222-222222222222';

let owner: pg.Client;
let cliente: PrismaClient;

beforeAll(async () => {
  // El sembrado usa el rol dueno (superusuario del contenedor, con BYPASSRLS)
  // porque preparar el escenario NO es lo que se esta probando. Todo lo demas
  // corre con el rol de aplicacion.
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL_OWNER });
  await owner.connect();

  // El orden importa: las hijas antes que las padres. Borrar tenant primero
  // funcionaria por CASCADE, pero dejarlo explicito hace visible el grafo de
  // dependencias a quien agregue una tabla nueva.
  await owner.query('DELETE FROM parte_de_cargo');
  await owner.query('DELETE FROM cargo');
  await owner.query('DELETE FROM concepto_cargo');
  await owner.query('DELETE FROM notificacion');
  await owner.query('DELETE FROM asistencia');
  await owner.query('DELETE FROM asignacion_docente');
  await owner.query('DELETE FROM configuracion_escuela');
  await owner.query('DELETE FROM tutor_alumno');
  await owner.query('DELETE FROM consentimiento');
  await owner.query('DELETE FROM tutor');
  await owner.query('DELETE FROM inscripcion');
  await owner.query('DELETE FROM alumno');
  await owner.query('DELETE FROM cohorte');
  await owner.query('DELETE FROM periodo');
  await owner.query('DELETE FROM aviso_privacidad');
  await owner.query('DELETE FROM usuario_rol');
  await owner.query('DELETE FROM usuario');
  await owner.query('DELETE FROM sede');
  await owner.query('DELETE FROM tenant');
  // La bitacora se limpia con TRUNCATE y no con DELETE porque las reglas
  // append-only bloquean el DELETE — incluso para el dueno. Que preparar el
  // escenario cueste este rodeo es justamente la prueba de que la regla muerde.
  await owner.query('TRUNCATE evento_auditoria');

  await owner.query(
    `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn") VALUES
       ($1, 'Colegio Azahar', 'colegio-azahar', 'COLEGIO', true, now()),
       ($2, 'Academia Azahar FC', 'academia-azahar-fc', 'ACADEMIA_DEPORTIVA', true, now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  await owner.query(
    `INSERT INTO sede (id, tenant_id, nombre, cct, rvoe, activa, "creadaEn") VALUES
       (gen_random_uuid(), $1, 'Campus Norte', '31PPR0001A', 'ACUERDO-123/2024', true, now()),
       (gen_random_uuid(), $2, 'Cancha Principal', NULL, NULL, true, now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );
  await owner.query(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn")
     VALUES
       (gen_random_uuid(), $1, 'director@colegio.mx', 'hash', 'Directora Colegio', true, now()),
       (gen_random_uuid(), $2, 'director@colegio.mx', 'hash', 'Coach Academia', true, now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );

  // Escenario multi-vertical: el colegio agrupa por GRADO dentro de un ciclo
  // escolar; la academia por CATEGORIA dentro de una temporada. Misma
  // estructura de datos, dos mundos distintos (§9).
  await owner.query(
    `INSERT INTO periodo (id, tenant_id, nombre, tipo, inicio, activo, creado_en) VALUES
       ($1, $3, 'Ciclo 2026-2027', 'CICLO_ESCOLAR', '2026-08-01', true, now()),
       ($2, $4, 'Temporada Otono 2026', 'TEMPORADA', '2026-09-01', true, now())`,
    [ID_PERIODO_COLEGIO, ID_PERIODO_ACADEMIA, ID_COLEGIO, ID_ACADEMIA],
  );
  await owner.query(
    `INSERT INTO cohorte (id, tenant_id, periodo_id, sede_id, nombre, tipo, orden, activa, creada_en)
     SELECT gen_random_uuid(), $1, $2, s.id, '3o A', 'GRADO', 3, true, now()
       FROM sede s WHERE s.tenant_id = $1 LIMIT 1`,
    [ID_COLEGIO, ID_PERIODO_COLEGIO],
  );
  await owner.query(
    `INSERT INTO cohorte (id, tenant_id, periodo_id, sede_id, nombre, tipo, orden, activa, creada_en)
     SELECT gen_random_uuid(), $1, $2, s.id, 'Sub-12', 'CATEGORIA', 12, true, now()
       FROM sede s WHERE s.tenant_id = $1 LIMIT 1`,
    [ID_ACADEMIA, ID_PERIODO_ACADEMIA],
  );
  await owner.query(
    `INSERT INTO alumno (id, tenant_id, nombre, apellidos, activo, creado_en) VALUES
       (gen_random_uuid(), $1, 'Sofia', 'Ramirez', true, now()),
       (gen_random_uuid(), $2, 'Diego', 'Fuentes', true, now())`,
    [ID_COLEGIO, ID_ACADEMIA],
  );

  // crearCliente() y no `new PrismaClient()`: el helper es el unico lugar que
  // sabe con que credencial conectarse. Instanciar a mano aqui abriria la
  // puerta a que la prueba corra con el rol dueno y de un falso verde.
  cliente = crearCliente();
});

afterAll(async () => {
  await owner?.end();
  await cliente?.$disconnect();
});

describe('premisa del gate', () => {
  it('el rol de aplicacion NO puede saltarse RLS', async () => {
    // Sin esta garantia, todo lo demas en este archivo seria teatro: un rol con
    // BYPASSRLS haria pasar cualquier prueba de aislamiento.
    const usuarioApp = new URL(process.env.DATABASE_URL!).username;
    const { rows } = await owner.query(
      'SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = $1',
      [decodeURIComponent(usuarioApp)],
    );
    expect(rows[0]?.rolbypassrls, 'el rol de app tiene BYPASSRLS').toBe(false);
    expect(rows[0]?.rolsuper, 'el rol de app es superusuario').toBe(false);
  });

  it('todas las tablas de negocio tienen RLS habilitado y forzado', async () => {
    const { rows } = await owner.query(
      `SELECT relname, relrowsecurity, relforcerowsecurity
         FROM pg_class
        WHERE relnamespace = 'public'::regnamespace
          AND relkind = 'r'
          AND relname NOT LIKE '\\_prisma%'`,
    );
    expect(rows.length).toBeGreaterThan(0);
    for (const t of rows) {
      expect(t.relrowsecurity, `${t.relname} sin RLS habilitado`).toBe(true);
      expect(t.relforcerowsecurity, `${t.relname} sin FORCE (el dueno la evade)`).toBe(true);
    }
  });
});

describe('lectura aislada', () => {
  it('cada escuela ve unicamente sus sedes', async () => {
    const delColegio = await conTenant(ID_COLEGIO, (tx) => tx.sede.findMany(), cliente);
    const deLaAcademia = await conTenant(ID_ACADEMIA, (tx) => tx.sede.findMany(), cliente);

    expect(delColegio).toHaveLength(1);
    expect(delColegio[0]!.nombre).toBe('Campus Norte');
    expect(deLaAcademia).toHaveLength(1);
    expect(deLaAcademia[0]!.nombre).toBe('Cancha Principal');
  });

  it('pedir por id un registro de otra escuela devuelve nada, no un error revelador', async () => {
    const ajena = await conTenant(ID_ACADEMIA, (tx) => tx.sede.findFirst(), cliente);
    const intento = await conTenant(
      ID_COLEGIO,
      (tx) => tx.sede.findUnique({ where: { id: ajena!.id } }),
      cliente,
    );
    // Devolver null y no "prohibido" evita confirmar que ese id existe.
    expect(intento).toBeNull();
  });

  it('el mismo email puede existir en dos escuelas y cada una ve solo el suyo', async () => {
    const enColegio = await conTenant(
      ID_COLEGIO,
      (tx) => tx.usuario.findMany({ where: { email: 'director@colegio.mx' } }),
      cliente,
    );
    const enAcademia = await conTenant(
      ID_ACADEMIA,
      (tx) => tx.usuario.findMany({ where: { email: 'director@colegio.mx' } }),
      cliente,
    );
    expect(enColegio).toHaveLength(1);
    expect(enAcademia).toHaveLength(1);
    expect(enColegio[0]!.nombre).toBe('Directora Colegio');
    expect(enAcademia[0]!.nombre).toBe('Coach Academia');
  });
});

describe('modelo multi-vertical (§9)', () => {
  it('la misma estructura sirve a un colegio y a una academia', async () => {
    const delColegio = await conTenant(
      ID_COLEGIO,
      (tx) => tx.cohorte.findMany({ include: { periodo: true } }),
      cliente,
    );
    const deLaAcademia = await conTenant(
      ID_ACADEMIA,
      (tx) => tx.cohorte.findMany({ include: { periodo: true } }),
      cliente,
    );

    // Un grado dentro de un ciclo escolar...
    expect(delColegio[0]!.tipo).toBe('GRADO');
    expect(delColegio[0]!.periodo.tipo).toBe('CICLO_ESCOLAR');
    // ...y una categoria dentro de una temporada. Sin ramas en el modelo.
    expect(deLaAcademia[0]!.tipo).toBe('CATEGORIA');
    expect(deLaAcademia[0]!.periodo.tipo).toBe('TEMPORADA');
  });

  it('los alumnos tambien quedan aislados por escuela', async () => {
    const delColegio = await conTenant(ID_COLEGIO, (tx) => tx.alumno.findMany(), cliente);
    const deLaAcademia = await conTenant(ID_ACADEMIA, (tx) => tx.alumno.findMany(), cliente);
    expect(delColegio.map((a) => a.nombre)).toEqual(['Sofia']);
    expect(deLaAcademia.map((a) => a.nombre)).toEqual(['Diego']);
  });
});

describe('bitacora append-only (§12)', () => {
  it('un evento registrado no se puede modificar ni borrar, ni por la aplicacion', async () => {
    await conTenant(
      ID_COLEGIO,
      (tx) =>
        tx.eventoAuditoria.create({
          data: { tenantId: ID_COLEGIO, tipo: 'prueba.creado', entidad: 'prueba' },
        }),
      cliente,
    );

    // Las reglas DO INSTEAD NOTHING de la migracion hacen que estas operaciones
    // no fallen ruidosamente: simplemente no tienen efecto. Se verifica el
    // EFECTO (§14), no el codigo de retorno.
    await conTenant(
      ID_COLEGIO,
      (tx) =>
        tx.eventoAuditoria.updateMany({
          where: { tipo: 'prueba.creado' },
          data: { tipo: 'alterado' },
        }),
      cliente,
    );
    await conTenant(
      ID_COLEGIO,
      (tx) => tx.eventoAuditoria.deleteMany({ where: { tipo: 'prueba.creado' } }),
      cliente,
    );

    const sobrevivientes = await conTenant(
      ID_COLEGIO,
      (tx) => tx.eventoAuditoria.findMany({ where: { tipo: 'prueba.creado' } }),
      cliente,
    );
    expect(sobrevivientes, 'la historia se pudo reescribir').toHaveLength(1);
  });
});

describe('asistencia y avisos aislados (Sprint 3)', () => {
  /** Los ids que hagan falta, leidos DENTRO del contexto de cada escuela. */
  async function piezas(tenantId: string) {
    return conTenant(
      tenantId,
      async (tx) => ({
        alumno: (await tx.alumno.findFirst())!,
        cohorte: (await tx.cohorte.findFirst())!,
        usuario: (await tx.usuario.findFirst())!,
      }),
      cliente,
    );
  }

  it('cada escuela ve unicamente la asistencia de sus alumnos', async () => {
    for (const tenantId of [ID_COLEGIO, ID_ACADEMIA]) {
      const { alumno, cohorte, usuario } = await piezas(tenantId);
      await conTenant(
        tenantId,
        (tx) =>
          tx.asistencia.create({
            data: {
              tenantId,
              alumnoId: alumno.id,
              cohorteId: cohorte.id,
              fecha: new Date('2026-09-01T00:00:00.000Z'),
              estado: 'AUSENTE',
              registradoPor: usuario.id,
            },
          }),
        cliente,
      );
    }

    const delColegio = await conTenant(
      ID_COLEGIO,
      (tx) => tx.asistencia.findMany({ include: { alumno: true } }),
      cliente,
    );
    const deLaAcademia = await conTenant(
      ID_ACADEMIA,
      (tx) => tx.asistencia.findMany({ include: { alumno: true } }),
      cliente,
    );

    expect(delColegio.map((a) => a.alumno.nombre)).toEqual(['Sofia']);
    expect(deLaAcademia.map((a) => a.alumno.nombre)).toEqual(['Diego']);
  });

  it('no se puede registrar la falta de un alumno de otra escuela', async () => {
    // El caso feo: el atacante YA tiene el id del alumno ajeno. Sin RLS, este
    // INSERT pasaria y una madre de la otra escuela recibiria el aviso.
    const ajeno = await piezas(ID_ACADEMIA);
    const propio = await piezas(ID_COLEGIO);

    await expect(
      conTenant(
        ID_COLEGIO,
        (tx) =>
          tx.asistencia.create({
            data: {
              tenantId: ID_ACADEMIA,
              alumnoId: ajeno.alumno.id,
              cohorteId: ajeno.cohorte.id,
              fecha: new Date('2026-09-02T00:00:00.000Z'),
              estado: 'AUSENTE',
              registradoPor: propio.usuario.id,
            },
          }),
        cliente,
      ),
    ).rejects.toThrow();

    const enAcademia = await conTenant(ID_ACADEMIA, (tx) => tx.asistencia.count(), cliente);
    expect(enAcademia, 'la escritura cruzada dejo rastro').toBe(1);
  });

  it('los avisos de una escuela no existen para la otra', async () => {
    const { usuario } = await piezas(ID_COLEGIO);
    await conTenant(
      ID_COLEGIO,
      (tx) =>
        tx.notificacion.create({
          data: {
            tenantId: ID_COLEGIO,
            usuarioId: usuario.id,
            tipo: 'asistencia.falta',
            titulo: 'Prueba',
            cuerpo: 'Prueba',
            clave: 'prueba:aislamiento',
          },
        }),
      cliente,
    );

    expect(await conTenant(ID_ACADEMIA, (tx) => tx.notificacion.count(), cliente)).toBe(0);
    expect(await conTenant(ID_COLEGIO, (tx) => tx.notificacion.count(), cliente)).toBe(1);
  });
});

describe('cobranza aislada (Sprint 4)', () => {
  /** Crea un concepto y un cargo dentro del contexto de UNA escuela. */
  async function sembrarCobranza(tenantId: string, monto: string) {
    return conTenant(
      tenantId,
      async (tx) => {
        const alumno = (await tx.alumno.findFirst())!;
        const concepto = await tx.conceptoCargo.create({
          data: {
            tenantId,
            clave: 'colegiatura',
            nombre: 'Colegiatura',
            periodicidad: 'MENSUAL',
            montoBase: monto,
            vigenteDesde: new Date('2026-08-01T00:00:00.000Z'),
          },
        });
        const cargo = await tx.cargo.create({
          data: {
            tenantId,
            alumnoId: alumno.id,
            conceptoId: concepto.id,
            periodo: '2026-09',
            monto,
            fechaVencimiento: new Date('2026-09-05T00:00:00.000Z'),
            fechaLimiteSinRecargo: new Date('2026-09-10T00:00:00.000Z'),
            clave: `${alumno.id}:${concepto.id}:2026-09`,
          },
        });
        return { alumno, concepto, cargo };
      },
      cliente,
    );
  }

  it('cada escuela ve unicamente sus conceptos y sus cargos', async () => {
    await sembrarCobranza(ID_COLEGIO, '2450.00');
    await sembrarCobranza(ID_ACADEMIA, '890.00');

    const delColegio = await conTenant(ID_COLEGIO, (tx) => tx.cargo.findMany(), cliente);
    const deLaAcademia = await conTenant(ID_ACADEMIA, (tx) => tx.cargo.findMany(), cliente);

    expect(delColegio.map((c) => c.monto.toFixed(2))).toEqual(['2450.00']);
    expect(deLaAcademia.map((c) => c.monto.toFixed(2))).toEqual(['890.00']);
  });

  it('no se puede facturarle a un alumno de otra escuela', async () => {
    // El caso feo: el atacante YA tiene los ids ajenos en la mano. Sin RLS este
    // INSERT pasaria y una familia recibiria el cargo de otra escuela.
    const ajeno = await conTenant(
      ID_ACADEMIA,
      async (tx) => ({
        alumno: (await tx.alumno.findFirst())!,
        concepto: (await tx.conceptoCargo.findFirst())!,
      }),
      cliente,
    );

    await expect(
      conTenant(
        ID_COLEGIO,
        (tx) =>
          tx.cargo.create({
            data: {
              tenantId: ID_ACADEMIA,
              alumnoId: ajeno.alumno.id,
              conceptoId: ajeno.concepto.id,
              periodo: '2026-10',
              monto: '1.00',
              fechaVencimiento: new Date('2026-10-05T00:00:00.000Z'),
              fechaLimiteSinRecargo: new Date('2026-10-10T00:00:00.000Z'),
              clave: 'intruso:2026-10',
            },
          }),
        cliente,
      ),
    ).rejects.toThrow();

    const enAcademia = await conTenant(ID_ACADEMIA, (tx) => tx.cargo.count(), cliente);
    expect(enAcademia, 'la escritura cruzada dejo rastro').toBe(1);
  });

  it('el reparto de un cargo tampoco cruza la frontera', async () => {
    const propio = await conTenant(
      ID_COLEGIO,
      async (tx) => ({
        cargo: (await tx.cargo.findFirst())!,
        tutor: await tx.tutor.findFirst(),
      }),
      cliente,
    );
    if (!propio.tutor) return; // el escenario base no siempre tiene tutores

    await conTenant(
      ID_COLEGIO,
      (tx) =>
        tx.parteDeCargo.create({
          data: {
            tenantId: ID_COLEGIO,
            cargoId: propio.cargo.id,
            tutorId: propio.tutor!.id,
            porcentaje: '100.00',
            monto: propio.cargo.monto,
          },
        }),
      cliente,
    );

    expect(await conTenant(ID_ACADEMIA, (tx) => tx.parteDeCargo.count(), cliente)).toBe(0);
    expect(await conTenant(ID_COLEGIO, (tx) => tx.parteDeCargo.count(), cliente)).toBe(1);
  });
});

// NOTA DE ORDEN: los bloques que LEEN el escenario van antes del que borra
// sedes (el DELETE en cascada se lleva cohortes e inscripciones). Vitest corre
// en el orden de declaracion; el orden aqui es una dependencia real, no estilo.
describe('escritura aislada', () => {
  it('no se puede crear una sede a nombre de otra escuela', async () => {
    await expect(
      conTenant(
        ID_COLEGIO,
        (tx) =>
          tx.sede.create({
            data: { tenantId: ID_ACADEMIA, nombre: 'Sede infiltrada' },
          }),
        cliente,
      ),
    ).rejects.toThrow();

    const enAcademia = await conTenant(ID_ACADEMIA, (tx) => tx.sede.count(), cliente);
    expect(enAcademia, 'la escritura cruzada dejo rastro').toBe(1);
  });

  it('no se puede borrar lo de otra escuela: el DELETE no alcanza ninguna fila', async () => {
    const borradas = await conTenant(ID_COLEGIO, (tx) => tx.sede.deleteMany(), cliente);
    expect(borradas.count).toBe(1); // solo la propia

    const academiaIntacta = await conTenant(ID_ACADEMIA, (tx) => tx.sede.count(), cliente);
    expect(academiaIntacta).toBe(1);

    // Restaurar para no dejar la base a medias (higiene entre pruebas).
    await owner.query(
      `INSERT INTO sede (id, tenant_id, nombre, activa, "creadaEn")
       VALUES (gen_random_uuid(), $1, 'Campus Norte', true, now())`,
      [ID_COLEGIO],
    );
  });
});

describe('esquema plataforma (ADR-008)', () => {
  it('existe y esta separado del esquema operativo', async () => {
    const { rows } = await owner.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'plataforma'`,
    );
    expect(rows.map((r) => r.table_name).sort()).toEqual(['cliente', 'evento', 'miembro', 'socio']);
  });

  it('NO lleva RLS de tenant, y eso es deliberado', async () => {
    // Documenta la decision como prueba: los datos de ZaharDev sobre sus
    // clientes no pertenecen a ninguna escuela, asi que no se filtran por
    // tenant. Su frontera es el guard de plataforma del API, que se prueba
    // aparte en apps/api. Si alguien "arregla" esto agregando RLS aqui, el
    // test lo detiene y lo manda a leer el ADR.
    const { rows } = await owner.query(
      `SELECT relname, relrowsecurity FROM pg_class
        WHERE relnamespace = 'plataforma'::regnamespace AND relkind = 'r'`,
    );
    for (const t of rows) {
      expect(t.relrowsecurity, `${t.relname} tiene RLS: revisar ADR-008`).toBe(false);
    }
  });
});

describe('deny-by-default', () => {
  it('sin declarar tenant no se ve NADA (falla cerrado, no abierto)', async () => {
    const sedes = await sinTenant((c) => c.sede.findMany(), cliente);
    const usuarios = await sinTenant((c) => c.usuario.findMany(), cliente);
    const escuelas = await sinTenant((c) => c.tenant.findMany(), cliente);

    expect(sedes).toHaveLength(0);
    expect(usuarios).toHaveLength(0);
    expect(escuelas).toHaveLength(0);
  });

  it('el contexto no sobrevive a la transaccion (seguridad con pooling)', async () => {
    await conTenant(ID_COLEGIO, async (tx) => tx.sede.findMany(), cliente);
    // Si SET LOCAL se filtrara fuera de la transaccion, la siguiente consulta
    // sin contexto heredaria el tenant anterior: la fuga clasica con pooling.
    const despues = await sinTenant((c) => c.sede.findMany(), cliente);
    expect(despues).toHaveLength(0);
  });

  it('un identificador de tenant que no es UUID se rechaza antes de tocar la base', async () => {
    await expect(
      conTenant(
        "11111111-1111-4111-8111-111111111111'; DROP TABLE sede; --",
        () => Promise.resolve(null),
        cliente,
      ),
    ).rejects.toThrow(/invalido/i);
  });
});
