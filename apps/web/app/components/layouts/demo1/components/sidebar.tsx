'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSettings } from '@/providers/settings-provider';
import { SidebarHeader } from './sidebar-header';
import { SidebarMenu } from './sidebar-menu';

export function Sidebar() {
  const { settings } = useSettings();
  const pathname = usePathname();

  return (
    <div
      className={cn(
        // `hidden lg:flex` es la correccion 2 del armazon (ver `layout.tsx`).
        // El original no traia `hidden` y dependia de que JavaScript decidiera
        // NO renderizar el componente en movil; sin ese guard, el sidebar se
        // colaba incrustado en la pagina. Con `hidden` la decision es del CSS:
        // sin parpadeo al hidratar y reacciona al instante al cambiar el ancho.
        'sidebar hidden bg-background lg:border-e lg:border-border lg:fixed lg:top-0 lg:bottom-0 lg:z-20 lg:flex flex-col items-stretch shrink-0',
        (settings.layouts.demo1.sidebarTheme === 'dark' || pathname.includes('dark-sidebar')) &&
          'dark',
      )}
    >
      <SidebarHeader />
      <div className="overflow-hidden">
        <div className="w-(--sidebar-default-width)">
          <SidebarMenu />
        </div>
      </div>
    </div>
  );
}
