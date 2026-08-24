import type { Response } from 'express';

/**
 * Sesion por cookie para la web. PAGA LA DEUDA declarada en el Sprint 0.
 *
 * EL PROBLEMA QUE RESUELVE: hasta ahora la web guardaba el token en
 * sessionStorage, accesible desde JavaScript. Cualquier script inyectado en la
 * pagina (una dependencia comprometida, un XSS) podia leerlo y suplantar a la
 * persona. Una cookie httpOnly no es visible para JavaScript: el navegador la
 * envia sola y ningun script la puede leer.
 *
 * POR QUE LA APP MOVIL SIGUE USANDO EL ENCABEZADO: alli no existe el problema.
 * No hay DOM donde inyectar scripts, y el token vive en el llavero cifrado del
 * sistema (SecureStore). Cada superficie usa el mecanismo seguro de SU
 * plataforma en lugar de imponer uno a las dos.
 */
export const NOMBRE_COOKIE = 'azahar_sesion';

const OCHO_HORAS_MS = 8 * 60 * 60 * 1000;

export function ponerCookieSesion(res: Response, token: string): void {
  res.cookie(NOMBRE_COOKIE, token, {
    // Invisible para document.cookie: es toda la razon de este cambio.
    httpOnly: true,
    // En produccion solo viaja por HTTPS. En desarrollo local no hay TLS, y
    // exigirlo aqui haria que la cookie nunca se guardara.
    secure: process.env.NODE_ENV === 'production',
    // 'lax' bloquea el envio en peticiones cross-site de terceros (defensa
    // CSRF de base) sin romper la navegacion normal del usuario.
    sameSite: 'lax',
    path: '/',
    maxAge: OCHO_HORAS_MS,
  });
}

export function limpiarCookieSesion(res: Response): void {
  // Mismos atributos que al ponerla: el navegador solo borra una cookie si
  // coinciden. Omitir path aqui es el error clasico que deja sesiones vivas.
  res.clearCookie(NOMBRE_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Lee la cookie del encabezado sin dependencias externas.
 *
 * Un parser propio de 10 lineas evita sumar un paquete al arbol de
 * dependencias para partir una cadena. Menos superficie de supply-chain.
 */
export function leerCookie(encabezado: string | undefined, nombre: string): string | undefined {
  if (!encabezado) return undefined;
  for (const parte of encabezado.split(';')) {
    const i = parte.indexOf('=');
    if (i === -1) continue;
    if (parte.slice(0, i).trim() === nombre) {
      return decodeURIComponent(parte.slice(i + 1).trim());
    }
  }
  return undefined;
}
