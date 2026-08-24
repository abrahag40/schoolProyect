import { SignJWT, jwtVerify } from 'jose';

/**
 * Emision y verificacion del token de sesion.
 *
 * El token lleva el tenantId: es la unica fuente de la escuela a la que
 * pertenece la peticion. NUNCA se acepta un tenantId enviado por el cliente en
 * el cuerpo o en un encabezado — seria pedirle al atacante que declare a que
 * escuela quiere entrar.
 */
export interface Sesion {
  usuarioId: string;
  tenantId: string;
  rol: string;
}

function clave(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error('AUTH_SECRET ausente o menor a 32 caracteres.');
  }
  return new TextEncoder().encode(secreto);
}

export async function emitirToken(sesion: Sesion): Promise<string> {
  return new SignJWT({ tenantId: sesion.tenantId, rol: sesion.rol })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sesion.usuarioId)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(clave());
}

export async function verificarToken(token: string): Promise<Sesion> {
  const { payload } = await jwtVerify(token, clave());
  if (!payload.sub || typeof payload.tenantId !== 'string') {
    throw new Error('Token sin identidad o sin escuela.');
  }
  return {
    usuarioId: payload.sub,
    tenantId: payload.tenantId,
    rol: typeof payload.rol === 'string' ? payload.rol : 'STAFF',
  };
}
