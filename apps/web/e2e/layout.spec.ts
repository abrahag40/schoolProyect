import { test, expect, type Page } from '@playwright/test';

/**
 * El ancho, medido en un navegador de verdad.
 *
 * POR QUE EXISTE ESTA PRUEBA. El 4-sep-2026 se midió que el panel desperdiciaba
 * entre el 33 % y el 50 % del ancho en escritorio: cada pantalla fijaba el suyo
 * a mano —720, 820, 820, 880, 960— porque no existía un marco del que heredar.
 * **Siete sprints de revisión no lo vieron**, y no lo vieron porque no había
 * nada que se pusiera rojo.
 *
 * Esta es esa cosa. El trinquete (`scripts/trinquete-estilos.mjs`) impide que
 * vuelvan a aparecer anchos escritos a mano; esto comprueba el EFECTO (§14):
 * que la pantalla, ya dibujada, use el espacio que tiene.
 *
 * Nota de método: una prueba que solo mirara el CSS podría pasar con el layout
 * roto. Se mide el resultado en píxeles reales.
 */

const ESCUELA = 'colegio-azahar';
const ADMIN = 'admin@colegioazahar.mx';
const CONTRASENA = 'azahar-demo-2026';

/// Las pantallas del panel. Si se agrega una y no se agrega aquí, la prueba no
/// la cubre — por eso la lista vive junto a la prueba y no en otro archivo.
const PANTALLAS = [
  '/panel',
  '/panel/catalogo',
  '/panel/morosidad',
  '/panel/becas',
  '/panel/escuela',
  '/panel/pase-lista',
] as const;

/**
 * El umbral. 90 % y no 100 %: el armazón es `sidebar + contenido` sin margen
 * muerto, pero una barra de scroll vertical se come unos píxeles y un redondeo
 * del navegador algunos más. Por debajo de 90 % ya no es redondeo: es un
 * contenedor poniéndose un tope.
 *
 * Antes de este sprint el panel marcaba **61 %**.
 */
const MINIMO_APROVECHADO = 0.9;

async function entrar(page: Page) {
  await page.goto('/');
  await page.getByLabel('Escuela').fill(ESCUELA);
  await page.getByLabel('Correo').fill(ADMIN);
  await page.getByLabel('Contrasena').fill(CONTRASENA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

/** Lo que el navegador ve, no lo que el CSS dice. */
async function medir(page: Page) {
  return page.evaluate(() => {
    const ancho = (sel: string) => {
      const el = document.querySelector(sel);
      return el ? el.getBoundingClientRect().width : 0;
    };
    const contenido = document.querySelector('.az-contenido');
    // El <main> de la PANTALLA, no el armazon. Es la diferencia que hizo que la
    // primera version de esta prueba no mordiera: el armazon seguia fluido
    // mientras la pantalla se ponia su propio tope por dentro, y la prueba
    // pasaba igual. Se mide lo que el usuario ve, que es el contenido.
    const principal = document.querySelector('.az-contenido main');
    const vp = document.documentElement.clientWidth;
    return {
      vp,
      sidebar: ancho('.az-sidebar'),
      contenido: ancho('.az-contenido'),
      // El area REAL disponible: la caja interior, sin el canal. Comparar
      // contra la exterior contaba el canal como desperdicio y daba 94 % con el
      // layout correcto — un umbral que castiga al espaciado no mide el ancho.
      contenidoInterior: contenido
        ? contenido.getBoundingClientRect().width -
          parseFloat(getComputedStyle(contenido).paddingLeft) -
          parseFloat(getComputedStyle(contenido).paddingRight)
        : 0,
      principal: ancho('.az-contenido main'),
      // El sidebar sale del flujo al colapsar: solo cuenta si ocupa columna.
      sidebarEnFlujo: getComputedStyle(document.querySelector('.az-sidebar')!).position !== 'fixed',
      topeDelContenido: contenido ? getComputedStyle(contenido).maxWidth : 'none',
      topeDelPrincipal: principal ? getComputedStyle(principal).maxWidth : 'none',
      desborde: document.documentElement.scrollWidth - vp,
    };
  });
}

test.describe('el ancho en escritorio (AZ-D1.5)', () => {
  // 1440 px y no el viewport del proyecto: la promesa se verifica en la medida
  // en que se hizo, no en una aproximación.
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  for (const ruta of PANTALLAS) {
    test(`${ruta} usa el ancho de la pantalla`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('.az-contenido')).toBeVisible();
      const m = await medir(page);

      // El contenido es FLUIDO (§66): un tope aquí es exactamente el defecto
      // que originó el sprint. Se comprueba en las DOS capas —armazón y
      // pantalla— porque poner el tope en cualquiera de ellas lo reintroduce.
      expect(m.topeDelContenido, `${ruta}: el armazón se puso un tope`).toBe('none');
      expect(m.topeDelPrincipal, `${ruta}: la pantalla se puso su propio tope`).toBe('none');

      // Y el <main> tiene que LLENAR el área que le dieron. Un tope expresado
      // de otra forma —un ancho fijo, un `margin: 0 auto` con ancho— no declara
      // `max-width` y se colaría por la comprobación de arriba; esta lo caza
      // igual, porque mide el resultado.
      const proporcionInterna = m.principal / m.contenidoInterior;
      expect(
        proporcionInterna,
        `${ruta}: el contenido ocupa ${Math.round(proporcionInterna * 100)} % de su área ` +
          `(${Math.round(m.principal)} de ${Math.round(m.contenidoInterior)} px disponibles)`,
      ).toBeGreaterThanOrEqual(0.98);

      const usado = (m.sidebarEnFlujo ? m.sidebar : 0) + m.contenido;
      const proporcion = usado / m.vp;
      expect(
        proporcion,
        `${ruta}: solo aprovecha el ${Math.round(proporcion * 100)} % del ancho ` +
          `(${Math.round(usado)} de ${m.vp} px). Antes del Sprint 7 era 61 %.`,
      ).toBeGreaterThanOrEqual(MINIMO_APROVECHADO);
    });
  }

  test('la navegación es directa: se cambia de sección sin volver al panel', async ({ page }) => {
    // El sidebar no es decoración: hasta el Sprint 7 ir de Cobranza a Catálogo
    // obligaba a volver al Panel (centro-y-radios). Esto prueba que ya no.
    await page.goto('/panel/morosidad');
    await page.getByRole('navigation').getByRole('link', { name: 'Becas' }).click();
    await expect(page).toHaveURL(/\/panel\/becas$/);
    // Y la sección activa se anuncia, no solo se colorea (WCAG 2.2 SC 1.3.1).
    await expect(page.getByRole('link', { name: 'Becas' })).toHaveAttribute('aria-current', 'page');
  });
});

test.describe('el ancho en móvil sigue intacto', () => {
  test.use({ viewport: { width: 360, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await entrar(page);
  });

  for (const ruta of PANTALLAS) {
    test(`${ruta} no desborda a 360 px`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.locator('.az-contenido')).toBeVisible();
      const m = await medir(page);
      // La contraparte obligatoria de ensanchar: arreglar el escritorio a costa
      // del teléfono no es arreglarlo.
      expect(m.desborde, `${ruta}: desborda ${m.desborde} px a 360`).toBeLessThanOrEqual(0);
    });
  }

  test('el sidebar se esconde y el menú lo trae de vuelta', async ({ page }) => {
    await page.goto('/panel');
    const nav = page.getByRole('navigation');
    await expect(nav).not.toBeInViewport();

    await page.getByRole('button', { name: 'Menú' }).click();
    await expect(nav).toBeInViewport();

    // Escape cierra: sin esto, quien navega con teclado queda atrapado.
    await page.keyboard.press('Escape');
    await expect(nav).not.toBeInViewport();
  });
});
