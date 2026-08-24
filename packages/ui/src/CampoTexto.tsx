import { useId, type InputHTMLAttributes } from 'react';

export interface PropsCampoTexto extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  etiqueta: string;
  /** Mensaje de error. Explica que paso Y como corregirlo, nunca solo "invalido". */
  error?: string;
  ayuda?: string;
}

/**
 * Campo de texto del sistema.
 *
 * Decisiones de accesibilidad que la plantilla de referencia no toma:
 * - La etiqueta es obligatoria en el tipo: no se puede construir un campo sin
 *   ella (un placeholder no es etiqueta; desaparece al escribir).
 * - El error se anuncia con role="alert" y se enlaza por aria-describedby.
 * - El estado de error no se comunica solo con color rojo: lleva texto.
 */
export function CampoTexto({ etiqueta, error, ayuda, style, ...resto }: PropsCampoTexto) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;
  const idError = `${id}-error`;
  const descritoPor = [ayuda ? idAyuda : null, error ? idError : null].filter(Boolean).join(' ');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      <label
        htmlFor={id}
        style={{
          fontSize: 'var(--font-size-sm)',
          fontWeight: 'var(--font-weight-medium)',
          color: 'var(--titulo)',
        }}
      >
        {etiqueta}
      </label>
      <input
        {...resto}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={descritoPor || undefined}
        style={{
          minHeight: 'var(--size-touch-target)',
          padding: '0 var(--space-3)',
          borderRadius: 'var(--radius-md)',
          border: `1px solid ${error ? 'var(--color-semantic-danger)' : 'var(--borde)'}`,
          background: 'var(--superficie)',
          color: 'var(--texto)',
          fontFamily: 'var(--font-family-sans)',
          fontSize: 'var(--font-size-base)',
          ...style,
        }}
      />
      {ayuda && (
        <span id={idAyuda} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--texto-tenue)' }}>
          {ayuda}
        </span>
      )}
      {error && (
        <span
          id={idError}
          role="alert"
          style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-semantic-danger)' }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
