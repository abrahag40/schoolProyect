/**
 * Acceso a datos de Azahar. Punto unico por el que pasa toda consulta.
 *
 * Contrato del paquete (§3): fuera de este modulo nadie construye un
 * PrismaClient ni abre una conexion. Asi el contexto de tenant no puede
 * "olvidarse" en un rincon del codigo.
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

export { PrismaClient };
export type { Tenant, Sede, Usuario } from '../generated/prisma/client.js';

let instancia: PrismaClient | undefined;

/**
 * Cliente compartido. Se conecta SIEMPRE con el rol de aplicacion
 * (azahar_app, NOBYPASSRLS) leyendo DATABASE_URL — nunca con el rol dueno,
 * que solo existe para migrar (ADR-004).
 */
export function obtenerCliente(): PrismaClient {
  if (!instancia) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Falta DATABASE_URL: no hay a que base conectarse.');
    instancia = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }
  return instancia;
}

/** Crea un cliente propio (pruebas, procesos aislados). */
export function crearCliente(connectionString = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) throw new Error('Falta DATABASE_URL: no hay a que base conectarse.');
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** Un UUID valido y nada mas. Defensa previa a tocar la sesion de Postgres. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class TenantInvalidoError extends Error {
  constructor(valor: string) {
    super(`Identificador de tenant invalido: ${JSON.stringify(valor)}`);
    this.name = 'TenantInvalidoError';
  }
}

/**
 * Ejecuta trabajo dentro del contexto de UN tenant.
 *
 * Como funciona: abre una transaccion y declara el tenant con set_config(...,
 * is_local => true), equivalente a SET LOCAL. Al cerrar la transaccion el valor
 * desaparece solo. Esto importa con pooling de conexiones: si el ajuste fuera
 * de sesion, la siguiente peticion podria heredar el tenant de la anterior —
 * exactamente la fuga que este diseno evita.
 *
 * Se usa set_config y no SET LOCAL porque acepta parametro ligado; interpolar
 * el id en el SQL seria una via de inyeccion.
 */
export async function conTenant<T>(
  tenantId: string,
  trabajo: (tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0]) => Promise<T>,
  cliente: PrismaClient = obtenerCliente(),
): Promise<T> {
  if (!UUID_RE.test(tenantId)) throw new TenantInvalidoError(tenantId);

  return cliente.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_tenant', ${tenantId}, true)`;
    return trabajo(tx);
  });
}

/**
 * Ejecuta trabajo SIN contexto de tenant. Solo para operaciones de plataforma
 * (alta de una escuela nueva, tareas de mantenimiento).
 *
 * No es un atajo: como las politicas son deny-by-default, aqui NO se ven filas
 * de negocio. Existe para hacer explicito en el codigo cuando una operacion es
 * deliberadamente de plataforma, en vez de que parezca un olvido.
 */
export async function sinTenant<T>(
  trabajo: (cliente: PrismaClient) => Promise<T>,
  cliente: PrismaClient = obtenerCliente(),
): Promise<T> {
  return trabajo(cliente);
}
