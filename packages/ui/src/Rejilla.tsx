import type { CSSProperties, ReactNode } from 'react';

export interface PropsRejilla {
  children: ReactNode;
  style?: CSSProperties;
}

/**
 * Rejilla que se acomoda sola: tantas columnas como quepan, sin un punto de
 * quiebre por cada arreglo posible.
 *
 * Es lo que hace que el contenido use el ancho de verdad. Con `auto-fit` una
 * fila de tres tarjetas en escritorio se vuelve una columna en el telefono sin
 * que nadie escriba una media query, y a 1920px caben cuatro sin cambiar nada.
 */
export function Rejilla({ children, style }: PropsRejilla) {
  return (
    <div className="az-rejilla" style={style}>
      {children}
    </div>
  );
}

export interface PropsLectura {
  children: ReactNode;
  style?: CSSProperties;
}

/**
 * Acota un bloque a la medida de lectura (65ch).
 *
 * Es de COMPONENTE, no de pagina (§66): la pantalla es fluida y quien lleva el
 * limite es el parrafo o el formulario. Un renglon de 1600px no se lee, pero
 * una tabla de 1600px si.
 */
export function Lectura({ children, style }: PropsLectura) {
  return (
    <div className="az-lectura" style={style}>
      {children}
    </div>
  );
}
