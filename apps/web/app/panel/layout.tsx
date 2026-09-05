'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArmazonPanel, Boton } from '@azahar/ui';
import type { ElementoNavegacion } from '@azahar/ui';
import { pedirApi } from '../api';

/**
 * La forma REAL de `/mi-escuela`, no la del login.
 *
 * DEFECTO PROPIO, cazado al abrir el navegador (4-sep-2026): asumi que este
 * endpoint devolvia `{ escuela, usuario: { roles } }` —que es la respuesta de
 * `/auth/login`— y la pantalla reventaba con "Cannot read properties of
 * undefined (reading 'roles')". El compilador NO lo detecta: `pedirApi` hace
 * una asercion de tipo sobre un JSON que nadie valida, y ese es exactamente el
 * punto donde el tipado deja de proteger (ver `api.ts`).
 *
 * `escuela` es nullable de verdad: el API la devuelve null mientras no hay sede
 * dada de alta.
 */
interface Resumen {
  escuela: { nombre: string; vertical: string } | null;
  misRoles: string[];
}

/// Quien ve el pase de lista. Misma lista que el API: si divergen, la interfaz
/// ofrece un enlace que termina en 403 — peor que no ofrecerlo.
const ROLES_PASE_LISTA = ['DOCENTE', 'DIRECTOR', 'ADMIN', 'DUENO'];
/// Quien administra el dinero. DOCENTE no entra: un maestro pasa lista, no
/// define cuanto cuesta la colegiatura.
const ROLES_COBRANZA = ['DUENO', 'DIRECTOR', 'ADMIN', 'COBRANZA'];

/**
 * Marco comun de todas las pantallas del panel.
 *
 * POR QUE NO EXISTIA Y POR QUE IMPORTA (§66). Hasta el 4-sep-2026 cada pantalla
 * se dibujaba sola. Sin un marco del que heredar, cada una invento su ancho
 * —720, 820, 820, 880, 960— y en escritorio se desperdiciaba hasta la mitad de
 * la pantalla. El ancho no se arregla pantalla por pantalla: se arregla aqui.
 */
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rutaActual = usePathname();
  const [sesion, setSesion] = useState<Resumen | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const { estado, datos } = await pedirApi<Resumen>('/mi-escuela');
      if (!vigente) return;
      // La verdad de la sesion la tiene el servidor, no una copia en el cliente.
      if (estado === 401) router.replace('/');
      else if (datos) setSesion(datos);
    })();
    return () => {
      vigente = false;
    };
  }, [router]);

  async function salir() {
    // El Content-Type no es decorativo: el API rechaza con 415 los POST que no
    // lo declaran, porque es lo que fuerza el preflight y con el la defensa CSRF.
    await pedirApi('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null);
    router.replace('/');
  }

  const roles = sesion?.misRoles ?? [];
  const puede = (permitidos: string[]) => roles.some((r) => permitidos.includes(r));

  // La navegacion se filtra por rol por la misma razon que el panel: un enlace
  // que lleva a un 403 es peor que un enlace que no esta.
  //
  // Sin iconos a proposito: solo texto. Es el `restraint` de Linear/Stripe que
  // fija nuestra guia de UX, y un icono mal elegido comunica menos que la
  // palabra. La prop `icono` existe en el componente para cuando haya un juego
  // decidido, no para llenar el hueco hoy.
  const elementos: ElementoNavegacion[] = [
    ...(puede(ROLES_PASE_LISTA) ? [{ href: '/panel/pase-lista', etiqueta: 'Pase de lista' }] : []),
    ...(puede(ROLES_COBRANZA)
      ? [
          { href: '/panel/catalogo', etiqueta: 'Catálogo de cargos' },
          { href: '/panel/morosidad', etiqueta: 'Cobranza' },
          { href: '/panel/becas', etiqueta: 'Becas' },
          { href: '/panel/escuela', etiqueta: 'Datos fiscales' },
        ]
      : []),
  ];

  return (
    <ArmazonPanel
      Enlace={Link}
      rutaActual={rutaActual}
      elementos={elementos}
      marca={
        <Link href="/panel" className="az-nav-item">
          <strong style={{ fontSize: 'var(--font-size-lg)' }}>
            {sesion?.escuela?.nombre ?? 'Azahar'}
          </strong>
        </Link>
      }
      pie={
        <Boton
          variante="secundario"
          // `void` explicito y no `onClick={salir}`: una promesa sin manejar en
          // un manejador de evento se pierde en silencio si falla. Es el mismo
          // patron que ya usaba el panel.
          onClick={() => {
            void salir();
          }}
        >
          Salir
        </Boton>
      }
    >
      {children}
    </ArmazonPanel>
  );
}
