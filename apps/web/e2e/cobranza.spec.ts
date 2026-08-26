import { test, expect, type Page } from '@playwright/test';

/**
 * El camino del dinero, en un navegador de verdad.
 *
 * QUE PRUEBA ESTO Y NO OTRA CAPA: las 154 pruebas del API ya verifican que el
 * reparto cuadre y que la ventana del Artículo 4 se respete. Aquí se comprueba
 * lo único que un navegador puede comprobar:
 *
 *   1. Que la **cookie httpOnly** viaje sola y sostenga la sesión — el mecanismo
 *      que reemplazó a `sessionStorage` en el Sprint 2 y que hasta hoy solo se
 *      había verificado a mano.
 *   2. Que la pantalla se **arme con datos reales**, no con un mock.
 *   3. Que sea **operable a 360 px**, que es la promesa mobile-first.
 *
 * Requisitos: base sembrada (`pnpm db:seed`) y el API arriba en el 3333.
 */

const ESCUELA = 'colegio-azahar';
const ADMIN = 'admin@colegioazahar.mx';
const CONTRASENA = 'azahar-demo-2026';

async function entrar(page: Page, email = ADMIN) {
  await page.goto('/');
  await page.getByLabel('Escuela').fill(ESCUELA);
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contrasena').fill(CONTRASENA);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

test.describe('la sesión de la web', () => {
  test('el login deja una cookie que JavaScript NO puede leer', async ({ page, context }) => {
    await entrar(page);

    const cookie = (await context.cookies()).find((c) => c.name === 'azahar_sesion');
    expect(cookie, 'no se emitió la cookie de sesión').toBeDefined();
    // Esto es TODA la razón del cambio del Sprint 2: sin httpOnly, un script
    // inyectado podría robar la sesión como pasaba con sessionStorage.
    expect(cookie!.httpOnly).toBe(true);
    expect(cookie!.sameSite).toBe('Lax');

    // Y desde la página, el token es invisible: se comprueba el EFECTO (§14).
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain('azahar_sesion');
  });

  test('sin sesión, el panel devuelve al login en vez de mostrar datos', async ({ page }) => {
    await page.goto('/panel');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  });
});

test.describe('panel de cobranza a 360 px', () => {
  test('los tres números están arriba y la página NO scrollea de lado', async ({ page }) => {
    await entrar(page);
    await page.getByRole('button', { name: 'Ver cobranza' }).click();
    await expect(page).toHaveURL(/\/panel\/morosidad$/);

    for (const etiqueta of ['Cobrado', 'Por cobrar', 'Vencido']) {
      await expect(page.getByText(etiqueta, { exact: true })).toBeVisible();
    }

    // El defecto real que la revisión visual cazó en este sprint: los importes
    // se desbordaban y la página scrolleaba de lado. Aquí queda como gate.
    const desbordado = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desbordado, 'la página scrollea horizontalmente a 360 px').toBe(false);
  });

  test('la lectura legal del Artículo 7 se muestra, no se deja al director', async ({ page }) => {
    await entrar(page);
    await page.goto('/panel/morosidad');

    // La escuela no debería tener que recordar cuántas colegiaturas impagas
    // permiten suspender el servicio: el panel se lo dice.
    await expect(
      page.getByText(/La ley permite suspender el servicio a partir de 3/).first(),
    ).toBeVisible();
  });

  test('una familia sin pagadores lo DICE, en vez de dejar un hueco', async ({ page }) => {
    // Vacío ≠ error (regla 6 de la matriz D10). Los compañeros de grupo del
    // sembrado no tienen familia dada de alta: es el estado real de una escuela
    // recién migrada.
    await entrar(page);
    await page.goto('/panel/morosidad');
    await expect(page.getByText(/Sin pagador registrado/).first()).toBeVisible();
  });
});

test.describe('quién entra a dónde', () => {
  test('una docente no ve la cobranza, y el panel no se la ofrece', async ({ page }) => {
    await entrar(page, 'maestra@colegioazahar.mx');

    // Ni el acceso en el panel...
    await expect(page.getByRole('button', { name: 'Ver cobranza' })).toHaveCount(0);

    // ...ni la pantalla si la escribe a mano.
    await page.goto('/panel/morosidad');
    await expect(page.getByText('Esta sección es para administración y cobranza.')).toBeVisible();
  });
});
