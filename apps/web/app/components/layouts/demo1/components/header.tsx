'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useScrollPosition } from '@/hooks/use-scroll-position';
import { Button } from '@/components/ui/button';
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTrigger } from '@/components/ui/sheet';
import { Container } from '@/components/common/container';
import { MenuUsuario } from './menu-usuario';
import { SidebarMenu } from './sidebar-menu';

/**
 * ADAPTADO del header del demo1 de Metronic (AZ-D2.7).
 *
 * QUE SE CONSERVA: la estructura, el pegado al hacer scroll, el `Container`,
 * y la hoja lateral que trae el menu en movil. Se ve igual que el demo1.
 *
 * QUE SE QUITO, Y POR QUE. El original traia cinco piezas de su demo que en
 * Azahar serian botones que no llevan a ningun lado:
 *
 *   · Mega-menu      -> Azahar tiene seis secciones, todas en el sidebar.
 *                       Un mega-menu para seis enlaces es decorado.
 *   · Buscador       -> no hay busqueda global todavia. Un buscador que no
 *                       busca es peor que ninguno.
 *   · Chat           -> no existe el modulo (llega en Comunicacion, S9+).
 *   · Notificaciones -> SI existe el modelo en el API (bandeja de avisos del
 *                       S3), pero cablearlo es alcance del sprint siguiente;
 *                       poner la campana con datos falsos mentiria en la demo.
 *   · Rejilla de apps-> Azahar es una aplicacion, no un portafolio.
 *
 * Se retiran en vez de dejarse apagadas: §53 —lo que no se puede cumplir no se
 * construye ni desactivado— es una regla legal, pero el criterio se aplica
 * igual a lo cosmetico. Un boton muerto en la barra le enseña al usuario que
 * la barra miente.
 */
export function Header() {
  const [hojaAbierta, setHojaAbierta] = useState(false);

  const pathname = usePathname();
  const esMovil = useIsMobile();

  const posicion = useScrollPosition();
  const pegado: boolean = posicion > 0;

  return (
    <header
      className={cn(
        'header fixed top-0 z-10 start-0 flex items-stretch shrink-0 border-b border-transparent bg-background end-0 pe-[var(--removed-body-scroll-bar-size,0px)]',
        pegado && 'border-b border-border',
      )}
    >
      <Container className="flex justify-between items-stretch lg:gap-4">
        {/* Marca y menu, solo en movil: en escritorio el logo vive en el sidebar. */}
        <div className="flex items-center gap-2.5 lg:hidden">
          <Link href="/panel" className="shrink-0 font-bold text-lg">
            Azahar
          </Link>
          {esMovil && (
            // `key={pathname}` cierra la hoja al navegar: al cambiar la clave,
            // React remonta el componente y el estado vuelve a "cerrada".
            //
            // La version del demo1 lo hacia con un `useEffect` que llamaba a
            // `setHojaAbierta(false)` en cada cambio de ruta, y nuestro ESLint
            // lo rechaza con razon: un `setState` sincrono dentro de un efecto
            // provoca un segundo render en cascada. Remontar expresa la misma
            // intencion —"esta hoja pertenece a esta ruta"— sin ese render.
            <Sheet key={pathname} open={hojaAbierta} onOpenChange={setHojaAbierta}>
              <SheetTrigger asChild>
                {/* `aria-label` porque el boton es solo icono: sin el, un lector
                    de pantalla anuncia "boton" y ya (WCAG 2.2 SC 4.1.2). */}
                <Button variant="ghost" mode="icon" aria-label="Abrir el menú">
                  <Menu className="text-muted-foreground/70" />
                </Button>
              </SheetTrigger>
              <SheetContent className="p-0 gap-0 w-[275px]" side="left" close={false}>
                <SheetHeader className="p-0 space-y-0" />
                <SheetBody className="p-0 overflow-y-auto">
                  <SidebarMenu />
                </SheetBody>
              </SheetContent>
            </Sheet>
          )}
        </div>

        {/* El hueco que en el demo1 ocupa el mega-menu. Empuja el menu de
            usuario a la derecha sin necesidad de un margen a mano. */}
        <div className="grow" />

        <div className="flex items-center gap-3">
          <MenuUsuario />
        </div>
      </Container>
    </header>
  );
}
