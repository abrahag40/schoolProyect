'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { pedirApi } from '../api';
import { Demo1Layout } from '../components/layouts/demo1/layout';

/**
 * EL MARCO DE TODAS LAS PANTALLAS DEL PANEL (AZ-D2.7).
 *
 * Sustituye a `ArmazonPanel` por el armazon del demo1 de Metronic, por
 * instruccion del CEO del 6-sep-2026: la plantilla es la fuente base del
 * frontend. Queda registrado en ADR-013, que deroga la seccion «NO se adopta su
 * armazon» de ADR-012.
 *
 * ESTE ARCHIVO SOLO GUARDA LA PUERTA. El aspecto lo pone `Demo1Layout`; lo
 * unico que vive aqui es la verificacion de sesion, que es logica de Azahar y
 * no debe mezclarse con codigo que algun dia hay que diffear contra una version
 * nueva de la plantilla.
 *
 * LA VERDAD DE LA SESION LA TIENE EL SERVIDOR. No se lee de una copia en el
 * cliente: se pregunta al API y un 401 devuelve al login. La cookie es
 * httpOnly, asi que JavaScript no puede inspeccionarla — que es justo lo que se
 * quiere (defecto real del Sprint 2).
 */
export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [verificada, setVerificada] = useState(false);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const { estado } = await pedirApi('/mi-escuela');
      if (!vigente) return;
      if (estado === 401) router.replace('/');
      else setVerificada(true);
    })();
    return () => {
      vigente = false;
    };
  }, [router]);

  // Sin esto se pinta el panel completo y despues se salta al login: el usuario
  // sin sesion alcanza a ver el armazon de una escuela que no es suya.
  if (!verificada) return null;

  return <Demo1Layout>{children}</Demo1Layout>;
}
