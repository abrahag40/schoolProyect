/**
 * Frontera de la consola de ZaharDev (C1 / ADR-008), probada por HTTP.
 *
 * Este archivo existe por un incidente real heredado: en Zentor la consola
 * cross-tenant quedo accesible a una cuenta demo compartible cuya contrasena
 * estaba escrita en un runbook. Cualquiera con ese documento veia los datos
 * comerciales de todos los clientes.
 *
 * Las pruebas de abajo son la version ejecutable de "que eso no vuelva a pasar".
 */
import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import pg from 'pg';
import { hash } from '@node-rs/argon2';
import { ModuloApp } from '../src/app.module.js';

const ID_ESCUELA_A = '41111111-1111-4111-8111-111111111111';
const ID_ESCUELA_B = '42222222-2222-4222-8222-222222222222';
const ID_ZAHARDEV = '44444444-4444-4444-8444-444444444444';
const ID_SOCIO = '43333333-3333-4333-8333-333333333333';
const CONTRASENA = 'prueba-plataforma-2026';

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
    'usuario_rol',
    'usuario',
    'sede',
    'tenant',
  ]) {
    await owner.query(`DELETE FROM ${t}`);
  }

  const h = await hash(CONTRASENA, { memoryCost: 19_456, timeCost: 2, parallelism: 1 });

  // Dos escuelas clientes y el espacio propio de ZaharDev.
  await owner.query(
    `INSERT INTO tenant (id, nombre, slug, vertical, activo, "creadoEn") VALUES
       ($1,'Escuela A','escuela-a','COLEGIO',true,now()),
       ($2,'Escuela B','escuela-b','ESCUELA_IDIOMAS',true,now()),
       ($3,'ZaharDev','zahardev-test','TALLER',true,now())`,
    [ID_ESCUELA_A, ID_ESCUELA_B, ID_ZAHARDEV],
  );

  // Cuatro personas: la duena de la escuela A (rol maximo DENTRO de su
  // escuela), el CEO de ZaharDev, un socio, y un empleado sin membresia.
  await owner.query(
    `INSERT INTO usuario (id, tenant_id, email, password_hash, nombre, activo, "creadoEn") VALUES
       (gen_random_uuid(),$1,'duena@escuela-a.mx',$3,'Duena Escuela A',true,now()),
       (gen_random_uuid(),$2,'ceo@zahardev.mx',$3,'CEO ZaharDev',true,now()),
       (gen_random_uuid(),$2,'socio@zahardev.mx',$3,'Socio Bajio',true,now()),
       (gen_random_uuid(),$2,'nadie@zahardev.mx',$3,'Empleado sin consola',true,now())`,
    [ID_ESCUELA_A, ID_ZAHARDEV, h],
  );
  await owner.query(
    `INSERT INTO usuario_rol (id, tenant_id, usuario_id, rol, creado_en)
     SELECT gen_random_uuid(), u.tenant_id, u.id, 'DUENO', now() FROM usuario u`,
  );

  await owner.query(
    `INSERT INTO plataforma.socio (id, nombre, email, porcentaje_comision, activo, creado_en)
     VALUES ($1,'Bajio','socio@zahardev.mx',15.00,true,now())`,
    [ID_SOCIO],
  );
  // La membresia se otorga por CORREO y de forma explicita. Notese que
  // 'duena@escuela-a.mx' NO esta aqui, aunque sea DUENO de su escuela.
  await owner.query(
    `INSERT INTO plataforma.miembro (id, email, nombre, rol, socio_id, activo, creado_en) VALUES
       (gen_random_uuid(),'ceo@zahardev.mx','CEO','CEO',NULL,true,now()),
       (gen_random_uuid(),'socio@zahardev.mx','Socio','SOCIO',$1,true,now())`,
    [ID_SOCIO],
  );

  // Escuela A es cliente directo; Escuela B llego por el socio.
  await owner.query(
    `INSERT INTO plataforma.cliente
       (id, tenant_id, estado, plan, precio_mensual, alumnos_maximos, socio_id, alta_en) VALUES
       (gen_random_uuid(),$1,'ACTIVO','base',3000.00,300,NULL,now()),
       (gen_random_uuid(),$2,'ACTIVO','base',1500.00,100,$3,now())`,
    [ID_ESCUELA_A, ID_ESCUELA_B, ID_SOCIO],
  );

  app = await NestFactory.create(ModuloApp, { logger: false });
  await app.listen(0);
  base = await app.getUrl();
});

afterAll(async () => {
  await app?.close();
  await owner?.end();
});

async function token(escuela: string, email: string) {
  const r = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ escuela, email, contrasena: CONTRASENA }),
  });
  const cuerpo = (await r.json()) as { token: string };
  return cuerpo.token;
}

/**
 * Forma minima de lo que devuelve la consola. Se declara para que el
 * compilador vuelva a proteger despues de la frontera de red — la misma razon
 * por la que el cliente web y el movil tienen su lector tipado.
 *
 * Estos errores llevaban aqui desde el Sprint 1 y nadie los veia: las pruebas
 * no estaban en ningun tsconfig, asi que `pnpm typecheck` ni las miraba. Se
 * descubrio al meterlas al proyecto en el Sprint 5.
 */
interface PanelPlataforma {
  /// TODA_LA_CARTERA para el CEO; MI_CARTERA para un socio.
  alcance: string;
  /// Presente solo cuando la consola RECHAZA. El mensaje es opaco a proposito:
  /// distinguir "no existe" de "no puedes" le confirma la consola a quien sondea.
  message?: string;
  mrr: { total: string } & Record<string, unknown>;
  clientes: Array<Record<string, unknown>>;
}

async function panel(tok: string) {
  const r = await fetch(`${base}/plataforma/panel`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  const cuerpo = (await r.json().catch(() => null)) as PanelPlataforma;
  return { estado: r.status, cuerpo };
}

describe('quien NO entra a la consola', () => {
  it('sin sesion, no se entra', async () => {
    const r = await fetch(`${base}/plataforma/panel`);
    expect(r.status).toBe(401);
  });

  it('la DUENA de una escuela no entra: mandar en tu escuela no es mandar en ZaharDev', async () => {
    const { estado } = await panel(await token('escuela-a', 'duena@escuela-a.mx'));
    expect(estado).toBe(403);
  });

  it('una cuenta del espacio de ZaharDev sin membresia tampoco entra', async () => {
    // Estar "del lado de la casa" no basta: la membresia es una fila explicita.
    const { estado } = await panel(await token('zahardev-test', 'nadie@zahardev.mx'));
    expect(estado).toBe(403);
  });

  it('el mensaje de rechazo no confirma que la consola exista', async () => {
    const { cuerpo } = await panel(await token('escuela-a', 'duena@escuela-a.mx'));
    expect(cuerpo.message).not.toMatch(/plataforma|consola|admin/i);
  });

  it('dar de baja a un miembro le corta el acceso de inmediato, sin esperar a que expire su token', async () => {
    const tok = await token('zahardev-test', 'ceo@zahardev.mx');
    expect((await panel(tok)).estado).toBe(200);

    await owner.query(
      `UPDATE plataforma.miembro SET activo = false WHERE email = 'ceo@zahardev.mx'`,
    );
    // El MISMO token, ya emitido y aun vigente, deja de servir: la membresia se
    // consulta en cada peticion y no se confia en lo que el token afirma.
    expect((await panel(tok)).estado).toBe(403);

    await owner.query(
      `UPDATE plataforma.miembro SET activo = true WHERE email = 'ceo@zahardev.mx'`,
    );
  });
});

describe('que ve cada quien', () => {
  it('el CEO ve toda la cartera y el MRR sumado', async () => {
    const { estado, cuerpo } = await panel(await token('zahardev-test', 'ceo@zahardev.mx'));
    expect(estado).toBe(200);
    expect(cuerpo.alcance).toBe('TODA_LA_CARTERA');
    expect(cuerpo.clientes).toHaveLength(2);
    expect(cuerpo.mrr.total).toBe('4500.00'); // 3000 + 1500
    expect(cuerpo.mrr.clientesActivos).toBe(2);
  });

  it('el socio ve SOLO su cartera: la consulta no alcanza clientes ajenos', async () => {
    const { cuerpo } = await panel(await token('zahardev-test', 'socio@zahardev.mx'));
    expect(cuerpo.alcance).toBe('MI_CARTERA');
    expect(cuerpo.clientes).toHaveLength(1);
    expect(cuerpo.clientes[0]!.escuela).toBe('Escuela B');
    // Ni el nombre del cliente ajeno aparece en la respuesta.
    expect(JSON.stringify(cuerpo)).not.toContain('Escuela A');
  });

  it('los importes viajan como cadena para no perder centavos (§4)', async () => {
    const { cuerpo } = await panel(await token('zahardev-test', 'ceo@zahardev.mx'));
    expect(typeof cuerpo.mrr.total).toBe('string');
    expect(typeof cuerpo.clientes[0]!.precioMensual).toBe('string');
  });

  it('la consola no expone datos personales de las escuelas', async () => {
    // Es BI de NEGOCIO, no de personas: la linea que separa el dashboard del
    // CEO de los datos de menores (doctrina aprobada). ZaharDev sabe cuanto
    // paga cada escuela y cuantos alumnos caben en su plan; no sabe como se
    // llaman esos alumnos ni quienes son sus tutores.
    const { cuerpo } = await panel(await token('zahardev-test', 'ceo@zahardev.mx'));
    const texto = JSON.stringify(cuerpo);

    // Campos que jamas deben viajar a la consola.
    for (const prohibido of ['password', 'curp', 'passwordHash', 'fechaNacimiento']) {
      expect(texto.toLowerCase(), `la consola filtro ${prohibido}`).not.toContain(
        prohibido.toLowerCase(),
      );
    }

    // Y ninguna estructura de personas: solo agregados comerciales.
    // (`alumnosMaximos` SI es legitimo: es el cupo contratado del plan, un
    // dato del contrato, no de una persona.)
    expect(cuerpo.clientes[0]!).not.toHaveProperty('alumnos');
    expect(cuerpo.clientes[0]!).not.toHaveProperty('tutores');
    expect(Object.keys(cuerpo.clientes[0]!).sort()).toEqual([
      'alumnosMaximos',
      'cortesiaHasta',
      'escuela',
      'estado',
      'modulosActivos',
      'plan',
      'precioMensual',
      'socio',
      'tenantId',
      'vertical',
    ]);
  });
});
