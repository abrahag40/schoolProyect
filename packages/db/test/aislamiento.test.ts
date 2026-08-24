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

let owner: pg.Client;
let cliente: PrismaClient;

beforeAll(async () => {
  // El sembrado usa el rol dueno (superusuario del contenedor, con BYPASSRLS)
  // porque preparar el escenario NO es lo que se esta probando. Todo lo demas
  // corre con el rol de aplicacion.
  owner = new pg.Client({ connectionString: process.env.DATABASE_URL_OWNER });
  await owner.connect();

  await owner.query('DELETE FROM usuario');
  await owner.query('DELETE FROM sede');
  await owner.query('DELETE FROM tenant');

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
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, rol, activo, "creadoEn")
     VALUES
       (gen_random_uuid(), $1, 'director@colegio.mx', 'hash', 'Directora Colegio', 'DIRECTOR', true, now()),
       (gen_random_uuid(), $2, 'director@colegio.mx', 'hash', 'Coach Academia', 'DIRECTOR', true, now())`,
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
        async () => null,
        cliente,
      ),
    ).rejects.toThrow(/invalido/i);
  });
});
