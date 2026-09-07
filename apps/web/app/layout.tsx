import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import { cn } from '@/lib/utils';
import { SettingsProvider } from '@/providers/settings-provider';
import { ThemeProvider } from '@/providers/theme-provider';
import { TooltipsProvider } from '@/providers/tooltips-provider';
import { Toaster } from '@/components/ui/sonner';
// `tailwind.css` carga, en este orden: Tailwind, el CSS de Metronic y del
// armazon demo1, nuestro tema, y el puente que reapunta sus variables a
// nuestros tokens (§67). El orden es lo que decide de que color pinta la web.
import './tailwind.css';

export const metadata: Metadata = {
  title: 'Azahar',
  description: 'Gestion escolar: cobranza, comunicacion y expediente en un solo lugar.',
};

/**
 * Sin esta declaracion el navegador movil asume un lienzo de escritorio y
 * escala la pagina: el diseno "responsive" se ve reducido y los controles
 * quedan por debajo del area tactil minima. Es el requisito base del principio
 * mobile-first, no un detalle de metadatos.
 *
 * No se fija maximumScale ni userScalable: impedir el zoom rompe WCAG 2.2
 * SC 1.4.4, y quien mas lo necesita es justamente el usuario con baja vision.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

/**
 * PROVEEDORES QUE ENTRAN Y CUALES NO (AZ-D2.7).
 *
 * El demo1 anida siete. Azahar monta tres:
 *
 *   · `SettingsProvider` — guarda si el sidebar esta plegado. Lo EXIGE el
 *     armazon del demo1: sin el, `useSettings()` revienta.
 *   · `ThemeProvider`    — claro/oscuro. Nuestros tokens ya tienen los dos.
 *   · `TooltipsProvider` — contexto de Radix que varios componentes esperan.
 *
 * Los otros cuatro se quedaron fuera con motivo:
 *   · `AuthProvider`    -> es `next-auth`. Azahar usa cookie httpOnly contra
 *                          nuestro API; dos sistemas de sesion es un defecto.
 *   · `I18nProvider`    -> el producto es en español por requisito del CEO.
 *   · `QueryProvider`   -> `react-query` no lo usa ningun componente adoptado,
 *                          solo sus pantallas de demostracion.
 *   · `ModulesProvider` -> depende de su tienda de ejemplo.
 *
 * `suppressHydrationWarning` es del `ThemeProvider`: el tema se lee del cliente
 * y el servidor no puede saberlo, asi que la primera pintura difiere a
 * proposito. Es la unica diferencia que se acepta.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang="es" no es decorativo: los lectores de pantalla eligen la voz y la
    // pronunciacion a partir de este atributo (WCAG 2.2 SC 3.1.1).
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body className={cn('antialiased flex h-full text-base text-foreground bg-background')}>
        <SettingsProvider>
          <ThemeProvider>
            <TooltipsProvider>
              <Suspense>{children}</Suspense>
              <Toaster />
            </TooltipsProvider>
          </ThemeProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
