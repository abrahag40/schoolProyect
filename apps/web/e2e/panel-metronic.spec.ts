import { test, expect, type Page } from '@playwright/test';

/**
 * EL ARMAZON DEL DEMO1 Y EL DASHBOARD (AZ-D2.7, AZ-D2.8).
 *
 * Estas pruebas nacen de DOS DEFECTOS REALES, no de un checklist. Los dos
 * salieron de abrir el navegador durante el Sprint 8; ninguno lo habria visto
 * una revision de codigo.
 *
 *   1. El sidebar solo aparecia tras RECARGAR. El armazon de Metronic decide
 *      con JavaScript si montarlo (`{!isMobile && <Sidebar />}`) y su hook
 *      devuelve `false` antes de hidratar. Es el defecto #2 que ADR-012 ya
 *      habia medido en su codigo; al adoptar el armazon (ADR-013) paso a ser
 *      nuestro. Corregido haciendo que lo decida el CSS.
 *
 *   2. Los importes se CORTABAN contra el borde de la tarjeta. Las tarjetas del
 *      demo1 llevan "9.3k"; las de Azahar, "$49,147.02". Medido: el numero
 *      pedia 149 px y la tarjeta ofrecia 118.
 *
 * Ambas afirman el EFECTO, no la implementacion (§14): que el sidebar se vea, y
 * que el numero quepa. Si mañana se resuelven de otra forma, siguen sirviendo.
 */

const ESCUELA = 'colegio-azahar';
const CORREO = 'directora@colegioazahar.mx';
const CONTRASENA = 'azahar-demo-2026';

async function entrar(page: Page): Promise<void> {
  await page.goto('/');
  await page.getByLabel('Escuela').fill(ESCUELA);
  await page.getByLabel('Correo').fill(CORREO);
  await page.getByLabel('Contraseña').fill(CONTRASENA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

/**
 * Espera a que las tarjetas tengan DINERO, no solo a que exista la ruta.
 *
 * `entrar()` solo garantiza que la URL es `/panel`; el importe llega despues,
 * en una segunda peticion al API. Sin esta espera, las cifras se leen mientras
 * las tarjetas muestran el guion de "todavia no hay dato" — y la prueba
 * afirmaba sobre cero importes en vez de fallar. Ese es el modo de fallo
 * silencioso que §6 prohibe.
 */
async function esperarImportes(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          [...document.querySelectorAll('.azahar-tarjeta-cifra span')].filter((s) =>
            (s.textContent ?? '').trim().startsWith('$'),
          ).length,
      ),
    )
    .toBeGreaterThanOrEqual(3);
}

/** Ancho que el texto PIDE contra el que la caja OFRECE. */
async function cifrasQueSeCortan(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('.azahar-tarjeta-cifra span')]
      .filter((s) => /^[$\d]/.test(s.textContent?.trim() ?? ''))
      .filter((s) => s.scrollWidth > s.clientWidth + 1)
      .map((s) => s.textContent?.trim() ?? ''),
  );
}

test.describe('el armazon del demo1 (AZ-D2.7)', () => {
  test('el sidebar responde al ancho SIN recargar la pagina', async ({ page }) => {
    await entrar(page);

    const sidebar = page.locator('.sidebar');

    // Escritorio: visible y con el ancho de la plantilla.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(sidebar).toBeVisible();
    expect((await sidebar.boundingBox())?.width).toBe(280);

    // Se estrecha SIN recargar: es aqui donde fallaba.
    await page.setViewportSize({ width: 700, height: 900 });
    await expect(sidebar).toBeHidden();

    // Y vuelve. Este era el sintoma exacto: no reaparecia hasta recargar.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(sidebar).toBeVisible();
    expect((await sidebar.boundingBox())?.width).toBe(280);
  });

  test('a 360 px el sidebar se esconde y el menu lo trae de vuelta', async ({ page }) => {
    await entrar(page);
    await page.setViewportSize({ width: 360, height: 800 });

    await expect(page.locator('.sidebar')).toBeHidden();

    const menu = page.getByRole('button', { name: 'Abrir el menú' });
    await expect(menu).toBeVisible();
    await menu.click();

    // El menu de la hoja lleva las secciones de Azahar, no las del demo.
    await expect(page.getByRole('link', { name: 'Cobranza', exact: true })).toBeVisible();
  });

  test('la pagina NO scrollea de lado a 360 px', async ({ page }) => {
    await entrar(page);
    await page.setViewportSize({ width: 360, height: 800 });

    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(desborde, `el panel desborda ${desborde} px a 360`).toBeLessThanOrEqual(0);
  });
});

test.describe('el dashboard (AZ-D2.6)', () => {
  test('las cuatro cifras salen del API, no de la plantilla', async ({ page }) => {
    await entrar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await esperarImportes(page);

    // Las leyendas son las de Azahar. Si alguien reintrodujera las tarjetas del
    // demo1 —"Amazing mates", "Lessons Views"— esto se pone rojo.
    for (const leyenda of ['Cobrado', 'Por cobrar', 'Vencido (parte de lo por cobrar)']) {
      await expect(page.getByText(leyenda, { exact: true })).toBeVisible();
    }

    // Y el valor es dinero de verdad, con formato de pesos y centavos.
    //
    // Se leen del DOM y no con `locator().filter({hasText})`: el filtro por
    // texto de Playwright no acoto a los importes —devolvia cero— porque busca
    // dentro de los descendientes y las tarjetas anidan la leyenda junto a la
    // cifra. Preguntarle al DOM por el texto exacto de cada span es directo y
    // no depende de como se anide el marcado de Metronic.
    const importes: string[] = await page.evaluate(() =>
      [...document.querySelectorAll('.azahar-tarjeta-cifra span')]
        .map((s) => s.textContent?.trim() ?? '')
        .filter((t) => t.startsWith('$')),
    );
    expect(importes.length, 'no se pintaron importes').toBeGreaterThanOrEqual(3);
    for (const i of importes) {
      expect(i, `"${i}" no tiene forma de importe`).toMatch(/^\$[\d,]+\.\d{2}$/);
    }
  });

  test('ningun importe se corta contra el borde de su tarjeta', async ({ page }) => {
    await entrar(page);
    await esperarImportes(page);

    // Se comprueba en los tres anchos donde la tarjeta cambia de tamaño. El
    // defecto original SOLO aparecia en escritorio: en movil las tarjetas son
    // mas anchas porque la rejilla se apila.
    for (const width of [360, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const cortadas = await cifrasQueSeCortan(page);
      expect(cortadas, `a ${width} px se cortan: ${cortadas.join(', ')}`).toEqual([]);
    }
  });

  test('la lectura legal del Articulo 7 llega al dashboard', async ({ page }) => {
    await entrar(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // §52: el contador cuenta COLEGIATURAS vencidas, no adeudos. El texto sale
    // del dominio (el API), no de la pantalla — por eso se afirma aqui: es la
    // prueba de que el dato cruza hasta donde el director lo lee.
    await expect(page.getByText(/colegiatura\(s\) vencida\(s\)/).first()).toBeVisible();
  });
});

/**
 * LAS SEIS PANTALLAS, A LOS DOS ANCHOS QUE IMPORTAN (AZ-D2.7).
 *
 * Sustituye a las 14 pruebas de `layout.spec.ts`, que median `.az-contenido`
 * —la clase del armazon que se sustituyo— y por eso quedaron obsoletas al
 * adoptar el demo1 (D20).
 *
 * Afirman DOS cosas por ruta, que son las que se rompen al migrar marcado:
 *   · que la pantalla carga de verdad, y no un error de compilacion; y
 *   · que no scrollea de lado a 360 px, que es el ancho del telefono con el
 *     que una directora entra desde la escuela.
 */
const RUTAS = [
  '/panel',
  '/panel/morosidad',
  '/panel/catalogo',
  '/panel/becas',
  '/panel/pase-lista',
  '/panel/escuela',
];

test.describe('las pantallas del panel sobre el armazon nuevo (AZ-D2.7)', () => {
  for (const ruta of RUTAS) {
    test(`${ruta} carga y no desborda a 360 px`, async ({ page }) => {
      await entrar(page);
      await page.setViewportSize({ width: 360, height: 800 });
      await page.goto(ruta);

      // Que exista el armazon prueba que la pagina se monto: un error de
      // compilacion en Next devuelve una pantalla de error sin sidebar.
      await expect(page.locator('.wrapper')).toBeVisible();

      const desborde = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(desborde, `${ruta} desborda ${desborde} px a 360`).toBeLessThanOrEqual(0);
    });
  }

  test('el 404 tiene salida, no solo un codigo', async ({ page }) => {
    await page.goto('/una-ruta-que-no-existe');
    await expect(page.getByText('Esta página no existe')).toBeVisible();
    // Lo que hace util a un 404 no es el numero: es el camino de vuelta.
    await expect(page.getByRole('link', { name: 'Ir al panel' })).toBeVisible();
  });
});

/**
 * EL RIEL PLEGABLE DE 80 px (AZ-D2.11).
 *
 * Es la unica pieza del armazon de Metronic que se adopta TAL CUAL: el CSS del
 * colapso ya venia en `demo1.css` y funciona sin adaptarlo.
 *
 * --- EL DETALLE QUE COSTO ENCONTRAR, Y QUE HAY QUE SABER PARA PROBARLO ---
 *
 * El boton de plegar vive DENTRO del sidebar. Al pulsarlo, el puntero se queda
 * encima, y la regla `.demo1.sidebar-collapse .sidebar:hover` lo devuelve a
 * 280 px. Resultado: **se pliega, pero no se ve hasta que el raton se aparta**.
 * Diagnosticado el 6-sep-2026 con `hoverSobreSidebar: true` justo despues del
 * clic; sin ese dato la conclusion facil era «el colapso no funciona».
 *
 * Por eso las pruebas mueven el raton antes de medir. No es un truco para que
 * pasen: es reproducir lo que hace una persona, que suelta el boton y lleva la
 * vista —y el cursor— al contenido.
 *
 * NOTA DE INSTRUMENTO. Esto NO se puede medir ejecutando JavaScript desde el
 * navegador: durante la evaluacion de un script el compositor no avanza, la
 * transicion de 0.3 s nunca progresa y el ancho se lee siempre un paso por
 * detras. Cuando una medicion y una captura de pantalla se contradicen, la
 * captura tiene razon.
 */
test.describe('el riel plegable (AZ-D2.11)', () => {
  test('el sidebar se pliega a 80 px y recuerda la decision', async ({ page }) => {
    await entrar(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveCSS('width', '280px');

    await page.getByRole('button', { name: 'Plegar la navegación' }).click();
    // El raton se aparta: mientras siga sobre el sidebar, la regla de hover lo
    // mantiene abierto (ver la cabecera).
    await page.mouse.move(900, 500);
    // `toHaveCSS` reintenta hasta que la transicion termina; leer un
    // boundingBox una sola vez cazaria el fotograma intermedio.
    await expect(sidebar).toHaveCSS('width', '80px');

    // Las etiquetas se esconden: en 80 px no caben, y recortarlas seria peor
    // que quitarlas. Se busca DENTRO del sidebar: «Catálogo de cargos» tambien
    // es un boton del dashboard, y sin acotar el modo estricto falla por
    // ambiguedad en vez de por el defecto real.
    await expect(sidebar.getByRole('link', { name: 'Catálogo de cargos' })).toBeHidden();

    // La decision sobrevive a la recarga — vive en localStorage, no en memoria.
    await page.reload();
    await page.mouse.move(900, 500);
    await expect(page.locator('.sidebar')).toHaveCSS('width', '80px');

    // Y se puede volver. El boton cambia de nombre, que es como un lector de
    // pantalla sabe en que estado esta.
    await page.getByRole('button', { name: 'Expandir la navegación' }).click();
    await page.mouse.move(900, 500);
    await expect(page.locator('.sidebar')).toHaveCSS('width', '280px');
  });

  test('plegado, el sidebar se expande al pasar el raton por encima', async ({ page }) => {
    await entrar(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.locator('.sidebar')).toBeVisible();

    await page.getByRole('button', { name: 'Plegar la navegación' }).click();
    await page.mouse.move(900, 500);

    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toHaveCSS('width', '80px');

    // Es lo que hace util a un riel: se consulta el menu sin desplegarlo.
    await sidebar.hover();
    await expect(sidebar).toHaveCSS('width', '280px');
    await expect(sidebar.getByRole('link', { name: 'Catálogo de cargos' })).toBeVisible();
  });
});
