import type { ReactNode } from 'react';

export interface PropsInsignia {
  tono?: 'neutro' | 'exito' | 'alerta' | 'peligro' | 'info';
  children: ReactNode;
}

/**
 * Etiqueta de estado.
 *
 * Regla del sistema (WCAG 2.2 SC 1.4.1): el color no puede ser el unico
 * portador del significado. Por eso la insignia SIEMPRE lleva texto; no existe
 * una variante que sea solo un punto de color.
 *
 * Los tonos claros de la paleta (exito, alerta) se usan como relleno con texto
 * oscuro encima — nunca como texto sobre blanco, donde no alcanzarian
 * contraste.
 */
export function Insignia({ tono = 'neutro', children }: PropsInsignia) {
  const fondo = {
    neutro: 'var(--superficie-alt)',
    exito: 'var(--color-semantic-success)',
    alerta: 'var(--color-semantic-warning)',
    peligro: 'var(--color-semantic-danger)',
    info: 'var(--color-semantic-info)',
  }[tono];

  // Sobre los rellenos claros el texto va oscuro; sobre el rojo, claro.
  const color = tono === 'peligro' ? 'var(--color-light-surface)' : 'var(--color-light-heading)';

  return (
    <span
      style={{
        display: 'inline-block',
        background: tono === 'neutro' ? fondo : fondo,
        color: tono === 'neutro' ? 'var(--texto)' : color,
        borderRadius: 'var(--radius-pill)',
        padding: '2px var(--space-2)',
        fontSize: 'var(--font-size-xs)',
        fontWeight: 'var(--font-weight-semibold)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}
