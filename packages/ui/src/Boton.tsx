import type { ButtonHTMLAttributes, ReactNode } from 'react';

export interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: 'primario' | 'secundario' | 'texto';
  cargando?: boolean;
  children: ReactNode;
}

/**
 * Boton del sistema.
 *
 * Detalles que no son cosmeticos:
 * - Altura minima = area tactil de 44px (Apple HIG / Material). Un boton de
 *   32px se ve elegante y falla en el telefono de un padre con prisa.
 * - `cargando` deshabilita e informa por aria-busy: el estado se comunica al
 *   lector de pantalla, no solo con un spinner.
 * - El color nunca viaja solo: el estado deshabilitado baja opacidad Y quita
 *   el cursor de accion.
 */
export function Boton({
  variante = 'primario',
  cargando = false,
  disabled,
  children,
  style,
  ...resto
}: PropsBoton) {
  const base = {
    minHeight: 'var(--size-touch-target)',
    padding: '0 var(--space-4)',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'var(--font-family-sans)',
    fontSize: 'var(--font-size-base)',
    fontWeight: 'var(--font-weight-medium)',
    cursor: disabled || cargando ? 'not-allowed' : 'pointer',
    opacity: disabled || cargando ? 0.6 : 1,
    transition: 'filter 120ms ease',
  } as const;

  const porVariante = {
    primario: {
      background: 'var(--accion-fondo)',
      color: 'var(--accion-texto)',
      border: '1px solid var(--accion-fondo)',
    },
    secundario: {
      background: 'var(--superficie)',
      color: 'var(--texto)',
      border: '1px solid var(--borde)',
    },
    texto: {
      background: 'transparent',
      color: 'var(--texto-primario)',
      border: '1px solid transparent',
    },
  }[variante];

  return (
    <button
      {...resto}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      style={{ ...base, ...porVariante, ...style }}
    >
      {cargando ? 'Un momento…' : children}
    </button>
  );
}
