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
    // ---------------------------------------------------------------------
    // 'lax' en local, 'none' en produccion. NO es una relajacion gratuita.
    //
    // EL DEFECTO QUE ARREGLA (4-sep-2026, primer despliegue real): en local la
    // web (3010) y el API (3333) son el MISMO sitio —los dos son `localhost`—
    // asi que una cookie `Lax` viaja sin problema y todo funciona. En la nube
    // son `vercel.app` y `onrender.com`: sitios distintos. El navegador GUARDA
    // la cookie y luego NO la reenvia en las peticiones cross-site, asi que el
    // login respondia 200 y la peticion siguiente 401. Entrabas y te expulsaba.
    //
    // LO QUE SE PIERDE Y COMO SE COMPENSA: `Lax` era una defensa CSRF de base.
    // Con `None` la cookie SI viaja en peticiones de terceros, asi que la
    // defensa se traslada al preflight: `main.ts` exige `application/json` en
    // todo POST, y eso obliga al navegador a preguntar antes (preflight), donde
    // el CORS —acotado a un unico origen— rechaza cualquier sitio ajeno. Sin
    // esa regla, esta linea seria un agujero: un POST con formulario NO lleva
    // preflight, y se comprobo contra el API desplegado que respondia 200.
    //
    // LA SOLUCION BUENA es un dominio propio (`app.azahar.mx` + `api.azahar.mx`)
    // que devuelva a los dos al mismo sitio registrable y permita volver a
    // `Lax`. Es compra del CEO; hasta entonces, esto.
    // ---------------------------------------------------------------------
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
    // Identico al de `ponerCookieSesion`, incluida la parte condicional: si
    // aqui dijera 'lax' y alli 'none', el navegador no borraria nada y la
    // sesion sobreviviria al cierre. Es el mismo error clasico que el `path`.
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
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
