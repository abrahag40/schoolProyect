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
  /// Roles del usuario en ESTA escuela. Plural desde el diseno (AZ-M1.3): en
  /// una escuela chica la misma persona administra, da clase y cobra.
  roles: string[];
  /// Correo, necesario para resolver la membresia de plataforma (C1). No es
  /// una credencial: la identidad ya la establecio el token.
  email: string;
}

function clave(): Uint8Array {
  const secreto = process.env.AUTH_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error('AUTH_SECRET ausente o menor a 32 caracteres.');
  }
  return new TextEncoder().encode(secreto);
}

export async function emitirToken(sesion: Sesion): Promise<string> {
  return new SignJWT({ tenantId: sesion.tenantId, roles: sesion.roles, email: sesion.email })
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
    // Sin roles el usuario no puede nada: deny-by-default tambien aqui. Un
    // token viejo (emitido antes de los roles multiples) queda sin permisos en
    // vez de heredar uno por omision.
    roles: Array.isArray(payload.roles) ? (payload.roles as string[]) : [],
    email: typeof payload.email === 'string' ? payload.email : '',
  };
}
