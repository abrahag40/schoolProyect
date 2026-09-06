import { AlertTriangle, Banknote, Clock, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

/**
 * LAS CUATRO CIFRAS DEL DASHBOARD (AZ-D2.6).
 *
 * Ocupa el lugar de `ChannelStats` del demo1 —misma rejilla de 2x2, mismo
 * fondo, misma tipografia— pero con dinero de verdad en vez de seguidores de
 * redes sociales inventados.
 *
 * TRES DE LAS CUATRO SALEN DEL MISMO ENDPOINT y no son intercambiables:
 *
 *   · Cobrado    — lo que ya entro. Es el unico numero que da tranquilidad.
 *   · Por cobrar — lo emitido que sigue abierto, este vencido o no.
 *   · Vencido    — lo que YA paso su fecha limite sin recargo (Art. 4).
 *
 * `Vencido` es un SUBCONJUNTO de `Por cobrar`, no una cuarta categoria: por eso
 * lleva su propia leyenda. Sumarlas daria un total que no existe.
 *
 * ICONOS EN VEZ DE LOGOS. El demo1 pinta el logo de LinkedIn, YouTube,
 * Instagram y TikTok. Aqui va un icono que dice que ES la cifra. Se usa
 * `lucide`, que es la familia que traen los componentes adoptados (ADR-013).
 */

export interface CifrasCobranza {
  cobrado: string;
  porCobrar: string;
  vencido: string;
  familiasConAdeudo: number;
}

/** "41000.00" -> "41,000.00". Se formatea la CADENA, nunca un `number`: pasar
 *  el importe por punto flotante es justo lo que §43 prohibe. */
function conSeparadores(monto: string): string {
  const [entero = '0', decimales = '00'] = monto.split('.');
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
}

interface Cifra {
  icono: typeof Banknote;
  valor: string;
  leyenda: string;
  /** Solo el vencido se pinta en rojo: si todo grita, nada grita. */
  alarma?: boolean;
}

export function TarjetasCobranza({ cifras }: { cifras: CifrasCobranza | null }) {
  const items: Cifra[] = [
    {
      icono: Banknote,
      valor: cifras ? `$${conSeparadores(cifras.cobrado)}` : '—',
      leyenda: 'Cobrado',
    },
    {
      icono: Clock,
      valor: cifras ? `$${conSeparadores(cifras.porCobrar)}` : '—',
      leyenda: 'Por cobrar',
    },
    {
      icono: AlertTriangle,
      valor: cifras ? `$${conSeparadores(cifras.vencido)}` : '—',
      leyenda: 'Vencido (parte de lo por cobrar)',
      alarma: true,
    },
    {
      icono: Users,
      valor: cifras ? String(cifras.familiasConAdeudo) : '—',
      leyenda: cifras?.familiasConAdeudo === 1 ? 'Familia con adeudo' : 'Familias con adeudo',
    },
  ];

  return (
    <>
      <style>{`
        .azahar-tarjeta-cifra { background-image: url('/media/images/2600x1600/bg-3.png'); }
        [data-theme='dark'] .azahar-tarjeta-cifra,
        .dark .azahar-tarjeta-cifra { background-image: url('/media/images/2600x1600/bg-3-dark.png'); }
      `}</style>

      {items.map((item) => {
        const Icono = item.icono;
        return (
          <Card key={item.leyenda}>
            <CardContent className="azahar-tarjeta-cifra flex h-full flex-col justify-between gap-6 bg-[right_top_-1.7rem] bg-cover bg-no-repeat p-0 rtl:bg-[left_top_-1.7rem]">
              <Icono
                className={`mt-4 ms-4 size-7 ${item.alarma ? 'text-destructive' : 'text-primary'}`}
                aria-hidden="true"
              />
              <div className="flex flex-col gap-1 px-4 pb-4">
                {/* `tabular-nums` alinea los digitos: sin el, cuatro cifras
                    apiladas bailan y comparar de un vistazo cuesta mas.
                    El tamaño CRECE con la pantalla en vez de fijarse en el 3xl
                    del demo1: sus tarjetas llevan "9.3k" y las nuestras
                    "$49,147.02". MEDIDO a 1440 px: la tarjeta deja ~153 px
                    utiles y el importe a 30 px (3xl) pide ~170 — se cortaba
                    contra el borde. El tope es 2xl, que cabe con holgura.
                    Visto en el navegador, no deducido. */}
                <span className="text-mono text-lg font-semibold tabular-nums 2xl:text-xl">
                  {item.valor}
                </span>
                <span className="text-muted-foreground text-sm font-normal">{item.leyenda}</span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </>
  );
}
