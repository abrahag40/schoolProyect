'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { List, X } from '@phosphor-icons/react';

export interface ElementoNavegacion {
  href: string;
  etiqueta: string;
  icono?: ReactNode;
}

export interface PropsArmazonPanel {
  /** Lo que va arriba del sidebar: nombre de la escuela, logo. */
  marca: ReactNode;
  elementos: ElementoNavegacion[];
  /** Ruta actual, para marcar el elemento activo. */
  rutaActual: string;
  /** Pie del sidebar: cuenta, cerrar sesion. */
  pie?: ReactNode;
  /**
   * Componente de enlace del framework anfitrion (en Next, `Link`).
   *
   * POR QUE ES UNA PROP Y NO UN IMPORT: `packages/ui` no depende de Next y no
   * debe hacerlo — es la regla que mantiene al sistema reusable en la app
   * movil y en cualquier otra superficie. Por omision usa `<a>`, que funciona
   * siempre aunque recargue la pagina entera.
   */
  Enlace?: ComponentType<{ href: string; className?: string; children: ReactNode }>;
  children: ReactNode;
}

const EnlacePlano = ({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) => (
  <a href={href} className={className}>
    {children}
  </a>
);

/**
 * Armazon del panel: navegacion persistente + area de contenido FLUIDA.
 *
 * POR QUE EXISTE (§66). Hasta el 4-sep-2026 cada pantalla del panel se dibujaba
 * sola, sin marco del que heredar, y por eso cada una invento su propio ancho:
 * 720, 820, 820, 880, 960. En un monitor de 1440px se desperdiciaba hasta la
 * mitad del espacio.
 *
 * El error de diagnostico fue creer que el problema era el tamano del tope.
 * Al medir la plantilla de referencia se vio que NO tiene un solo `max-width`:
 * su contenido es fluido y el ancho lo recupera un sidebar de 280px. **Los
 * pixeles que alli son navegacion, aqui no eran nada.**
 *
 * De paso arregla la navegacion: hasta hoy ir de Cobranza a Catalogo obligaba a
 * volver al Panel — un patron de centro-y-radios que el sidebar vuelve directo.
 */
export function ArmazonPanel({
  marca,
  elementos,
  rutaActual,
  pie,
  Enlace = EnlacePlano,
  children,
}: PropsArmazonPanel) {
  const [abierto, setAbierto] = useState(false);
  const idNav = useId();
  const botonMenu = useRef<HTMLButtonElement>(null);

  // Escape cierra, y el foco VUELVE al boton que abrio. Sin esa vuelta, quien
  // navega con teclado queda al principio del documento y tiene que recorrerlo
  // entero otra vez (WCAG 2.2 SC 2.4.3, orden del foco).
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        botonMenu.current?.focus();
      }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto]);

  return (
    <div className="az-app">
      {abierto && (
        <button
          type="button"
          className="az-velo"
          aria-label="Cerrar el menú"
          onClick={() => setAbierto(false)}
        />
      )}

      <nav
        id={idNav}
        className="az-sidebar"
        data-abierto={abierto}
        aria-label="Secciones de la escuela"
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-3)',
          }}
        >
          {marca}
          <button
            type="button"
            className="az-abrir-menu"
            aria-label="Cerrar el menú"
            onClick={() => setAbierto(false)}
            style={{ background: 'none', border: 0, cursor: 'pointer', color: 'var(--texto)' }}
          >
            <X size={20} />
          </button>
        </div>

        {elementos.map((el) => {
          const activo = rutaActual === el.href;
          return (
            <Enlace key={el.href} href={el.href} className="az-nav-item">
              <span
                data-activo={activo}
                // `aria-current` y no solo el color: quien usa lector de
                // pantalla no ve el resaltado (WCAG 2.2 SC 1.3.1).
                aria-current={activo ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius-md)',
                  // Area tactil minima de 44px (WCAG 2.2 SC 2.5.5 / Apple HIG).
                  minHeight: 'var(--size-touch-target)',
                  color: activo ? 'var(--texto-primario)' : 'var(--texto)',
                  background: activo ? 'var(--superficie-alt)' : 'transparent',
                  fontWeight: activo ? 'var(--font-weight-semibold)' : 'var(--font-weight-normal)',
                }}
              >
                {el.icono}
                {el.etiqueta}
              </span>
            </Enlace>
          );
        })}

        {pie && <div style={{ marginTop: 'auto', paddingTop: 'var(--space-4)' }}>{pie}</div>}
      </nav>

      <div className="az-contenido">
        <button
          ref={botonMenu}
          type="button"
          className="az-abrir-menu"
          aria-expanded={abierto}
          aria-controls={idNav}
          onClick={() => setAbierto(true)}
          style={{
            alignItems: 'center',
            gap: 'var(--space-2)',
            minHeight: 'var(--size-touch-target)',
            marginBottom: 'var(--space-3)',
            background: 'none',
            border: 0,
            cursor: 'pointer',
            color: 'var(--texto)',
          }}
        >
          <List size={22} />
          Menú
        </button>
        {children}
      </div>
    </div>
  );
}
