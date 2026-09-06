'use client';

import { ReactNode, useEffect } from 'react';
import { useSettings } from '@/providers/settings-provider';
import { Footer } from './components/footer';
import { Header } from './components/header';
import { Sidebar } from './components/sidebar';

/**
 * ADAPTADO del armazon del demo1 de Metronic (AZ-D2.3, ADR-013).
 *
 * ADR-012 habia decidido NO adoptar su armazon, con cinco defectos medidos. El
 * CEO decidio lo contrario el 6-sep-2026 —«que todo se vea exactamente como el
 * demo 1»— y esa decision manda. Lo que NO se hace es heredar los defectos:
 * tres de los cinco se corrigen aqui, y los otros dos viven en su CSS.
 *
 * --- LAS TRES CORRECCIONES -------------------------------------------------
 *
 * 1. `role="content"` NO EXISTE. El original marcaba `<main role="content">`.
 *    La lista de roles ARIA no incluye `content`, asi que un lector de pantalla
 *    lo descarta y `<main>` pierde su rol implicito `main` — la marca que
 *    permite saltarse la navegacion (WCAG 2.2 SC 1.3.6). Se quita el atributo:
 *    `<main>` ya anuncia lo correcto sin ayuda.
 *
 * 2. EL SIDEBAR LO DECIDE EL CSS, NO JAVASCRIPT. El original hacia
 *    `{!isMobile && <Sidebar />}` con un hook que devuelve `false` antes de
 *    hidratar: en un telefono el sidebar se montaba y se desmontaba, con
 *    parpadeo. Y verificado en vivo el 6-sep-2026: al ensanchar la ventana el
 *    sidebar NO reaparecia hasta recargar.
 *    Ahora se renderiza siempre y lo esconde `hidden lg:flex` (ver
 *    `sidebar.tsx`). El servidor y el cliente pintan lo mismo, no hay parpadeo,
 *    responde al instante al cambiar el tamaño, y funciona sin JavaScript.
 *
 * 3. UN FRAME, NO UN SEGUNDO. `layout-initialized` solo habilita las
 *    transiciones del armazon; el original lo agregaba tras un `setTimeout` de
 *    1000 ms fijo. Durante ese segundo, plegar el sidebar no animaba. Dos
 *    `requestAnimationFrame` esperan exactamente lo necesario —que el navegador
 *    haya pintado una vez— sin adivinar un numero.
 */
export function Demo1Layout({ children }: { children: ReactNode }) {
  const { settings } = useSettings();

  useEffect(() => {
    const clases = document.body.classList;
    clases.toggle('sidebar-collapse', settings.layouts.demo1.sidebarCollapse);
  }, [settings]);

  useEffect(() => {
    const clases = document.body.classList;
    clases.add('demo1', 'sidebar-fixed', 'header-fixed');

    // Correccion 3: se espera un frame pintado, no un segundo inventado.
    // El primer rAF corre ANTES de la pintura; el segundo, despues.
    let interior = 0;
    const exterior = requestAnimationFrame(() => {
      interior = requestAnimationFrame(() => clases.add('layout-initialized'));
    });

    return () => {
      cancelAnimationFrame(exterior);
      cancelAnimationFrame(interior);
      clases.remove(
        'demo1',
        'sidebar-fixed',
        'sidebar-collapse',
        'header-fixed',
        'layout-initialized',
      );
    };
  }, []);

  return (
    <>
      {/* Correccion 2: se renderiza siempre; el CSS decide si se ve. */}
      <Sidebar />

      <div className="wrapper flex grow flex-col">
        <Header />

        {/* Correccion 1: sin `role="content"`, que no es un rol valido. */}
        <main className="grow pt-5">{children}</main>

        <Footer />
      </div>
    </>
  );
}

export default Demo1Layout;
