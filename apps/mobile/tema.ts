import tokens from '@azahar/tokens';

/**
 * Puente entre los tokens compartidos y React Native.
 *
 * Esta es la razon tecnica por la que NO se compro el codigo de la plantilla de
 * referencia: es Bootstrap y SCSS, que en React Native no existen. Los tokens,
 * en cambio, son datos — y los datos si cruzan a las dos plataformas. La app
 * movil y la web pintan el mismo azul porque leen el mismo archivo, no porque
 * alguien recordo copiar el hex (D12 / ADR-006).
 */
type Tokens = {
  color: Record<string, Record<string, { value?: string } | string>>;
  [k: string]: unknown;
};

const t = tokens as unknown as Tokens;

/** Los valores de Style Dictionary vienen como { value } o como string plano. */
function leer(grupo: string, nombre: string): string {
  const nodo = t.color?.[grupo]?.[nombre];
  if (typeof nodo === 'string') return nodo;
  return nodo?.value ?? '#000000'; // token-ok: respaldo si falta un token
}

/**
 * React Native no tiene media queries: el tema se elige en tiempo de ejecucion.
 *
 * El parametro acepta 'unspecified' porque es lo que devuelve useColorScheme
 * cuando el sistema no declara preferencia; se trata como claro, igual que la
 * web trata el caso sin data-theme ni prefers-color-scheme.
 */
export function paleta(esquema: 'light' | 'dark' | 'unspecified' | null | undefined) {
  const modo = esquema === 'dark' ? 'dark' : 'light';
  return {
    fondo: leer(modo, 'bg'),
    superficie: leer(modo, 'surface'),
    titulo: leer(modo, 'heading'),
    texto: leer(modo, 'text'),
    tenue: leer(modo, 'muted'),
    borde: leer(modo, 'border'),
    accionFondo: leer(modo, 'action-bg'),
    accionTexto: leer(modo, 'on-action'),
    peligro: leer('semantic', 'danger'),
  };
}

/** Area tactil minima. Mismo valor que la web: sale del mismo token. */
export const AREA_TACTIL = 44;
