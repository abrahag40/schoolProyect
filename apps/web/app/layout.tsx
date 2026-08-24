import type { Metadata, Viewport } from 'next';
import '@azahar/ui/theme.css';

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // lang="es" no es decorativo: los lectores de pantalla eligen la voz y la
    // pronunciacion a partir de este atributo (WCAG 2.2 SC 3.1.1).
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
