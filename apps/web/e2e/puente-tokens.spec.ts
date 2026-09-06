import { test, expect } from '@playwright/test';

/**
 * EL GATE DEL PUENTE DE TOKENS (AZ-D2.1, §68).
 *
 * Mide el contraste sobre el componente RENDERIZADO, que es la unica capa donde
 * el puente existe de verdad.
 *
 * POR QUE ESTE ARCHIVO TUVO QUE ESCRIBIRSE. Al abrir el Sprint 8 se midio que
 * los dos gates de color existentes son CIEGOS al puente:
 *
 *   · `packages/tokens/test/contraste.test.mjs` lee unicamente
 *     `tokens/color.json`. Valida nuestros pares de color, y lo hace bien, pero
 *     nunca abre `apps/web/app/tailwind.css`.
 *   · `scripts/check-tokens.mjs` prohibe literales hex/rgb. El puente no tiene
 *     literales: esta hecho de `var()`. Pasa trivialmente.
 *
 * Con los dos en verde, mapear `--primary: var(--color-brand-primary)` daria un
 * boton a **2.63:1** —el defecto exacto que ADR-006 corrigio en la plantilla de
 * referencia y que §30 prohibe— sin que nada se pusiera rojo.
 *
 * Es §65 otra vez: un estandar sin gate es una intencion. Y es la leccion #2 de
 * la retrospectiva del S7 —«un gate que mide la capa equivocada es una garantia
 * falsa, peor que ninguna»— aplicada ANTES de que el defecto ocurra.
 *
 * MORDIDA VERIFICADA (obligatoria, §65). Con `--primary: var(--color-brand-primary)`
 * en el puente, la prueba falla con:
 *   «boton "primary": 2.63:1 entre texto y fondo; AA exige 4.5:1»
 * Sin ese cambio, pasa. Un gate que nadie vio morder no es un gate.
 */

/** WCAG 2.2 SC 1.4.3 — texto normal. */
const AA_TEXTO = 4.5;
/** WCAG 2.2 SC 1.4.11 — componentes de interfaz y graficos. */
const AA_NO_TEXTO = 3.0;

/**
 * Lo que se mide en el navegador. Se hace TODO dentro de `evaluate` y se
 * devuelven numeros ya calculados: pasar cadenas de color y parsearlas en Node
 * obligaria a reimplementar `rgb()`, `rgba()` y `color(srgb ...)`, que es
 * justamente el trabajo que el navegador ya hizo.
 */
interface MedidaBoton {
  variante: string;
  contrasteTexto: number;
  /** Contraste del borde contra lo que tiene detras. `null` si no tiene borde. */
  contrasteBorde: number | null;
}

test.describe('el puente de tokens pinta con los colores de Azahar (AZ-D2.1, §68)', () => {
  test('ninguna variante de Button baja de AA', async ({ page }) => {
    await page.goto('/estilo');
    await expect(page.locator('[data-prueba="botones"]')).toBeVisible();

    const medidas: MedidaBoton[] = await page.evaluate(() => {
      // --- Aritmetica de WCAG 2.x, identica a la de contraste.test.mjs -------
      const canalLineal = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      const luminancia = ([r, g, b]: number[]): number =>
        0.2126 * canalLineal(r!) + 0.7152 * canalLineal(g!) + 0.0722 * canalLineal(b!);
      const contraste = (a: number[], b: number[]): number => {
        const la = luminancia(a);
        const lb = luminancia(b);
        const [claro, oscuro] = la > lb ? [la, lb] : [lb, la];
        return (claro + 0.05) / (oscuro + 0.05);
      };

      /** Convierte lo que devuelve el navegador —`rgb(...)` o `rgba(...)`— a [r,g,b,a]. */
      const aRgba = (css: string): number[] => {
        const n = css.match(/[\d.]+/g)?.map(Number) ?? [];
        return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0, n[3] ?? 1];
      };

      /**
       * El fondo EFECTIVO: si el elemento es transparente —`ghost`, `dim` y
       * `link` lo son— el color que el ojo ve es el del ancestro que si pinta.
       * Comparar contra un fondo totalmente transparente daria un contraste inventado.
       */
      const fondoEfectivo = (el: Element): number[] => {
        let nodo: Element | null = el;
        while (nodo) {
          const c = aRgba(getComputedStyle(nodo).backgroundColor);
          if ((c[3] ?? 0) > 0) return c.slice(0, 3);
          nodo = nodo.parentElement;
        }
        return [255, 255, 255];
      };

      return [...document.querySelectorAll('[data-variante]')].map((el) => {
        const estilo = getComputedStyle(el);
        const texto = aRgba(estilo.color).slice(0, 3);
        const fondo = fondoEfectivo(el);

        // El borde solo cuenta si de verdad se dibuja: `border-width: 0` con un
        // color declarado no es un borde, y exigirle contraste seria un falso
        // rojo. `outline` y `dashed` si lo tienen.
        const anchoBorde = parseFloat(estilo.borderTopWidth) || 0;
        const colorBorde = aRgba(estilo.borderTopColor);
        const detrasDelBorde = el.parentElement ? fondoEfectivo(el.parentElement) : [255, 255, 255];

        return {
          variante: el.getAttribute('data-variante') ?? '(sin nombre)',
          contrasteTexto: contraste(texto, fondo),
          contrasteBorde:
            anchoBorde > 0 && (colorBorde[3] ?? 0) > 0
              ? contraste(colorBorde.slice(0, 3), detrasDelBorde)
              : null,
        };
      });
    });

    // Si el selector deja de encontrar botones, la prueba pasaria vacia y diria
    // "todo bien" sobre cero elementos. Ese es el modo de fallo silencioso que
    // §6 prohibe, asi que se afirma el numero esperado.
    expect(medidas.length, 'el banco de estilo no renderizo botones').toBe(8);

    for (const m of medidas) {
      expect(
        m.contrasteTexto,
        `boton "${m.variante}": ${m.contrasteTexto.toFixed(2)}:1 entre texto y fondo; AA exige ${AA_TEXTO}:1`,
      ).toBeGreaterThanOrEqual(AA_TEXTO);

      if (m.contrasteBorde !== null) {
        expect(
          m.contrasteBorde,
          `boton "${m.variante}": borde a ${m.contrasteBorde.toFixed(2)}:1; SC 1.4.11 exige ${AA_NO_TEXTO}:1`,
        ).toBeGreaterThanOrEqual(AA_NO_TEXTO);
      }
    }
  });

  test('el foco sigue siendo visible tras adoptar el componente', async ({ page }) => {
    // POR QUE ESTA PRUEBA EXISTE. El boton de Metronic trae
    // `focus-visible:outline-hidden`, que APAGA el anillo de foco global que
    // define `theme.css`. Lo repone con `focus-visible:ring-*`, que lee `--ring`
    // —y el puente apunta `--ring` a `--texto-primario`—, pero eso hay que
    // verificarlo: ADR-006 corrigio que la plantilla de referencia incumpliera
    // WCAG 2.2 SC 2.4.7, y ADR-012 se comprometio a conservar la correccion.
    // Adoptar un componente que apaga el foco y confiar en que lo repone es
    // exactamente la clase de supuesto que este sprint existe para probar.
    await page.goto('/estilo');

    const boton = page.locator('[data-variante="primary"]');
    await boton.focus();

    const indicador = await boton.evaluate((el) => {
      const e = getComputedStyle(el);
      return {
        outline: parseFloat(e.outlineWidth) || 0,
        sombra: e.boxShadow,
      };
    });

    // Vale cualquiera de los dos mecanismos: `outline` real, o el anillo que
    // Tailwind implementa como `box-shadow`. Lo que no vale es ninguno.
    const hayIndicador =
      indicador.outline > 0 || (indicador.sombra !== 'none' && indicador.sombra !== '');
    expect(
      hayIndicador,
      'el boton enfocado no dibuja ningun indicador visible (WCAG 2.2 SC 2.4.7)',
    ).toBe(true);
  });
});
