import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Une clases de Tailwind resolviendo conflictos.
 *
 * Es la funcion que esperan TODOS los componentes de Metronic; sin ella no
 * compila ninguno. `twMerge` resuelve el caso que `clsx` no puede: si llegan
 * `p-2` y `p-4`, gana la ultima en vez de quedar las dos y depender del orden
 * en que el navegador leyo la hoja.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
