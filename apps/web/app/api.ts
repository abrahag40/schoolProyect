/**
 * Cliente del API para la web.
 *
 * POR QUE EXISTE ESTE ARCHIVO: `response.json()` devuelve `any`, y ese `any`
 * se derrama hacia adentro contaminando todo lo que toca — el compilador deja
 * de proteger justo donde entran datos que no controlamos. El gate de analisis
 * estatico del Sprint 4 lo puso en evidencia: cuarenta hallazgos, todos con el
 * mismo origen.
 *
 * La solucion no es callar la regla: es tener UN solo lugar donde el dato sin
 * tipo cruza la frontera, marcado y comentado. A partir de aqui, todo el
 * cliente trabaja con tipos reales.
 *
 * Nota de seguridad: `credentials: 'include'` es lo que hace que el navegador
 * guarde y reenvie la cookie httpOnly de sesion. Sin eso el login responderia
 * 200 y la sesion no existiria (defecto real del Sprint 2).
 */

export const API: string = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

/** Forma de los errores del API: Nest + el filtro de validacion (§13). */
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

export async function pedirApi<T>(ruta: string, opciones: RequestInit = {}): Promise<Respuesta<T>> {
  const respuesta = await fetch(`${API}${ruta}`, { credentials: 'include', ...opciones });

  // 204 no trae cuerpo, y una respuesta de error puede no ser JSON (un proxy
  // caido devuelve HTML). Parsear a ciegas convertiria un fallo de red en un
  // error de sintaxis, que no le dice nada util ni al usuario ni a quien
  // depura.
  const cuerpo: unknown =
    respuesta.status === 204 ? null : await respuesta.json().catch(() => null);

  return {
    ok: respuesta.ok,
    estado: respuesta.status,
    // LA UNICA ASERCION DE TIPO DEL CLIENTE. Es una promesa que le hacemos al
    // compilador sobre un dato que viene de la red: si el contrato del API
    // cambia, aqui es donde hay que mirar.
    datos: respuesta.ok ? (cuerpo as T) : null,
    error: respuesta.ok ? null : (cuerpo as ErrorApi | null),
  };
}

/** POST/PUT con cuerpo JSON. Mismo contrato de respuesta. */
export function enviarJson<T>(
  ruta: string,
  cuerpo: unknown,
  metodo: 'POST' | 'PUT' | 'PATCH' = 'POST',
): Promise<Respuesta<T>> {
  return pedirApi<T>(ruta, {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
}
