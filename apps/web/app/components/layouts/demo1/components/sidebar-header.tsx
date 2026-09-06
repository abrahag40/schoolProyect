'use client';

import Link from 'next/link';
import { ChevronFirst } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettings } from '@/providers/settings-provider';
import { Button } from '@/components/ui/button';

/**
 * ADAPTADO del `SidebarHeader` del demo1 (AZ-D2.7).
 *
 * SE CONSERVA su estructura y el boton de plegar, que es el que convierte el
 * sidebar en un riel de 80 px.
 *
 * SE SUSTITUYE su marca. El original pinta cuatro `<img>` a
 * `/media/app/*.svg` —logo claro, logo oscuro, y sus dos versiones mini— que
 * son archivos de KeenThemes. No se copiaron: publicar su arte en un repo
 * publico seria redistribuirlo, que es justo lo que la licencia no permite
 * (ADR-012). Mientras Azahar no tenga logotipo, la marca va como texto.
 *
 * LAS DOS CLASES SON LOAD-BEARING, no decorativas: `default-logo` y
 * `small-logo` las conmuta el CSS del armazon (`demo1.css`) al plegar el
 * sidebar. Si se renombran, plegar deja de funcionar.
 */
export function SidebarHeader() {
  const { settings, storeOption } = useSettings();

  const plegado = settings.layouts.demo1.sidebarCollapse;

  return (
    <div className="sidebar-header relative hidden shrink-0 items-center justify-between px-3 lg:flex lg:px-6">
      <Link href="/panel" className="flex items-center">
        <span className="default-logo text-mono text-xl font-bold tracking-tight">Azahar</span>
        <span className="small-logo text-mono text-xl font-bold tracking-tight">A</span>
      </Link>
      <Button
        onClick={() => {
          storeOption('layouts.demo1.sidebarCollapse', !plegado);
        }}
        size="sm"
        mode="icon"
        variant="outline"
        // Sin esto el boton es un icono mudo para un lector de pantalla, y el
        // estado (plegado o no) tampoco se anuncia (WCAG 2.2 SC 4.1.2).
        aria-label={plegado ? 'Expandir la navegación' : 'Plegar la navegación'}
        aria-pressed={plegado}
        className={cn(
          'absolute start-full top-2/4 size-7 -translate-x-2/4 -translate-y-2/4 rtl:translate-x-2/4',
          plegado ? 'ltr:rotate-180' : 'rtl:rotate-180',
        )}
      >
        <ChevronFirst className="size-4!" aria-hidden="true" />
      </Button>
    </div>
  );
}
