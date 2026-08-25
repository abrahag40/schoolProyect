/**
 * Cliente del API para la app de familias.
 *
 * Gemelo del de la web (apps/web/app/api.ts) y por la misma razon:
 * `response.json()` devuelve `any` y ese `any` se derrama hacia adentro, de
 * modo que el compilador deja de proteger justo donde entran datos que no
 * controlamos. Aqui esta la UNICA asercion de tipo de la app.
 *
 * La diferencia con la web es deliberada: alla la sesion viaja en una cookie
 * httpOnly que el navegador manda sola; aqui viaja en el encabezado
 * Authorization, con el token guardado en el llavero cifrado del sistema.
 * Cada superficie usa el mecanismo seguro de SU plataforma.
 */
import { leerToken } from './sesion';

// El entorno de Expo llega sin tipar. Se estrecha aqui en vez de anotarlo y
// confiar: una variable ausente produciria `undefined` interpolado en cada URL
// y un 404 sin explicacion.
const desdeEntorno: unknown = process.env.EXPO_PUBLIC_API_URL;
export const API: string =
  typeof desdeEntorno === 'string' && desdeEntorno.length > 0
    ? desdeEntorno
    : 'http://localhost:3333';

export interface ErrorApi {
  message?: string;
  detalles?: Array<{ campo: string; mensaje: string }>;
}

export interface Respuesta<T> {
  ok: boolean;
  estado: number;
  datos: T | null;
  error: ErrorApi | null;
}

interface Opciones extends RequestInit {
  /// Token explicito. Si se omite, se lee del llavero. Se permite pasarlo para
  /// el arranque, donde ya se tiene en la mano y una segunda lectura del
  /// Keychain es un viaje que no hace falta.
  token?: string | null;
  /// Peticiones sin sesion (el login). Explicito para que ninguna llamada
  /// autenticada se quede sin token por olvido.
  publica?: boolean;
}

export async function pedirApi<T>(ruta: string, opciones: Opciones = {}): Promise<Respuesta<T>> {
  const { token, publica, headers, ...resto } = opciones;

  const credencial = publica ? null : (token ?? (await leerToken()));

  const respuesta = await fetch(`${API}${ruta}`, {
    ...resto,
    headers: {
      'Content-Type': 'application/json',
      ...(credencial ? { Authorization: `Bearer ${credencial}` } : {}),
      ...headers,
    },
  });

  // 204 no trae cuerpo, y un error puede no ser JSON (un portal cautivo de wifi
  // devuelve HTML). Parsear a ciegas convertiria un problema de red en un error
  // de sintaxis, que no le dice nada a la familia ni a quien depura.
  const cuerpo: unknown =
    respuesta.status === 204 ? null : await respuesta.json().catch(() => null);

  return {
    ok: respuesta.ok,
    estado: respuesta.status,
    // LA UNICA ASERCION DE TIPO DE LA APP: una promesa al compilador sobre un
    // dato que viene de la red. Si el contrato del API cambia, aqui se mira.
    datos: respuesta.ok ? (cuerpo as T) : null,
    error: respuesta.ok ? null : (cuerpo as ErrorApi | null),
  };
}

export function enviarJson<T>(
  ruta: string,
  cuerpo: unknown,
  opciones: Opciones = {},
): Promise<Respuesta<T>> {
  return pedirApi<T>(ruta, { ...opciones, method: 'POST', body: JSON.stringify(cuerpo) });
}
