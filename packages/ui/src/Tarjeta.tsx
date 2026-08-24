import type { ReactNode, CSSProperties } from 'react';

export interface PropsTarjeta {
  titulo?: string;
  children: ReactNode;
  style?: CSSProperties;
}

/**
 * Contenedor de contenido. Radio 12px y sombra suave: los valores exactos que
 * se midieron en la plantilla de referencia (ADR-006).
 */
export function Tarjeta({ titulo, children, style }: PropsTarjeta) {
  return (
    <section
      style={{
        background: 'var(--superficie)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-card)',
        padding: 'var(--space-5)',
        ...style,
      }}
    >
      {titulo && (
        <h2 style={{ fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-semibold)' }}>
          {titulo}
        </h2>
      )}
      {children}
    </section>
  );
}
