import type { Metadata } from 'next';
import { Button } from '../../components/ui/button';

/**
 * BANCO DE PRUEBAS DEL PUENTE DE TOKENS (AZ-D2.1, §68).
 *
 * No es una pantalla de producto: es el blanco fijo que necesita el gate del
 * puente. `e2e/puente-tokens.spec.ts` entra aqui, lee el color REAL que el
 * navegador computo para cada boton y calcula el contraste.
 *
 * POR QUE HACE FALTA UNA PAGINA Y NO BASTA LEER EL CSS. El puente es una
 * cadena de `var()` de cuatro eslabones:
 *
 *   bg-primary -> --color-primary -> --primary -> --accion-fondo -> el valor
 *
 * Resolverla a mano en un script seria reimplementar la cascada del navegador
 * —incluidos el tema oscuro y `@theme inline`— y equivocarse en silencio. El
 * navegador ya sabe hacerlo. Se le pregunta a el.
 *
 * POR QUE EL GATE VIEJO NO SERVIA (§68). `contraste.test.mjs` lee unicamente
 * `tokens/color.json`: valida que nuestros pares de color sean accesibles, y lo
 * hace bien, pero **nunca abre `tailwind.css`**. Y `check-tokens.mjs` prohibe
 * literales hex/rgb, que el puente no tiene: esta hecho de `var()`. Los dos
 * pasarian en verde con `--primary` apuntado al azul de marca (2.63:1).
 *
 * ESCRITA CON UTILIDADES, NO CON ESTILOS EN LINEA. El trinquete la freno en el
 * primer intento, y tenia razon: si los componentes adoptados son de utilidades
 * de punta a punta, una pagina que los exhibe con estilos en linea vuelve a
 * abrir la deuda que el S7 cerro (§64).
 *
 * Se listan TODAS las variantes con texto visible, no una muestra. Una variante
 * sin probar es una variante que puede pintar mal y nadie se entera.
 */
export const metadata: Metadata = {
  title: 'Banco de estilo — Azahar',
  // Es una herramienta interna; que no compita en buscadores con el producto.
  robots: { index: false, follow: false },
};

/** Las variantes que pintan texto. `foreground` e `inverse` no traen clases. */
const VARIANTES = [
  'primary',
  'mono',
  'destructive',
  'secondary',
  'outline',
  'dashed',
  'ghost',
  'dim',
] as const;

export default function BancoDeEstilo() {
  return (
    <main className="grid gap-8 p-6">
      <h1 className="text-2xl font-bold">Banco de estilo</h1>

      <section aria-labelledby="botones" className="grid gap-3">
        <h2 id="botones" className="text-lg font-semibold">
          Button — adoptado de Metronic (AZ-D2.1)
        </h2>
        <div data-prueba="botones" className="flex flex-wrap items-center gap-3">
          {VARIANTES.map((v) => (
            // `data-variante` es lo que el gate usa para nombrar el fallo: sin
            // el, un rojo dice "un boton" y hay que adivinar cual.
            <Button key={v} variant={v} data-variante={v}>
              Registrar pago
            </Button>
          ))}
        </div>
      </section>
    </main>
  );
}
