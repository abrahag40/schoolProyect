'use client';

import { Container } from '@/components/common/container';

/**
 * ADAPTADO del footer del demo1 (AZ-D2.7).
 *
 * SE CONSERVA su estructura: una sola linea, centrada en movil y repartida en
 * escritorio, dentro del mismo `Container` que el resto del armazon.
 *
 * SE QUITARON SUS CINCO ENLACES —Docs, Purchase, FAQ, Support, License—, que
 * apuntaban a keenthemes.com. En el footer de Azahar mandaban al usuario a
 * comprar la plantilla que usamos, que ademas de fuera de lugar delata la
 * procedencia del codigo a cualquiera que pase el raton por encima.
 *
 * No se sustituyen por enlaces nuestros todavia: Azahar no tiene documentacion
 * publica ni centro de ayuda. Un enlace que no lleva a nada es peor que la
 * ausencia — es el mismo criterio que se aplico al header (§53 por analogia).
 */
export function Footer() {
  const anio = new Date().getFullYear();

  return (
    <footer className="footer">
      <Container>
        <div className="flex flex-col items-center justify-center gap-3 py-5 md:flex-row md:justify-between">
          <div className="flex gap-2 text-sm font-normal">
            <span className="text-muted-foreground">{anio} &copy;</span>
            <span className="text-secondary-foreground">ZaharDev</span>
          </div>
          <span className="text-muted-foreground text-sm font-normal">
            Azahar — gestión escolar
          </span>
        </div>
      </Container>
    </footer>
  );
}
