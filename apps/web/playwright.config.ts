import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de extremo a extremo de la web.
 *
 * DEUDA DEL SPRINT 0, PAGADA EN EL SPRINT 5. Durante cinco sprints el script de
 * `test` de este paquete fue un `echo` que decia "e2e en S1 (Playwright)" y
 * salia con codigo 0, asi que `pnpm test` reportaba el paquete como exitoso sin
 * una sola prueba. En el Sprint 4 se retiro el disfraz; aqui se paga la deuda.
 *
 * QUE PRUEBAN Y QUE NO: no repiten lo que ya cubren las 154 pruebas del API —
 * eso seria cobertura duplicada y lenta. Prueban lo unico que solo se puede
 * comprobar con un navegador de verdad: que la cookie httpOnly viaje, que la
 * pantalla se arme con datos reales y que sea operable a 360 px.
 */
export default defineConfig({
  testDir: './e2e',
  // Sin paralelismo: las pruebas comparten la base de datos de desarrollo, y
  // en paralelo se pisarian — la misma leccion que turbo aprendio en el S3.
  workers: 1,
  fullyParallel: false,
  // En CI un reintento distingue una carrera de red de un defecto real; en
  // local, cero: un fallo tiene que doler donde se escribe el codigo.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  // El escenario se construye solo: siembra la base y genera los cargos.
  // Una prueba que exige recordar dos comandos previos se rompe el dia que
  // alguien no los recuerda, y entonces se culpa a la prueba.
  globalSetup: './e2e/preparar.ts',
  timeout: 30_000,

  use: {
    baseURL: process.env.NEXT_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3010',
    // El rastro solo del primer reintento: guardarlo siempre llena el disco
    // sin que nadie lo mire.
    trace: 'on-first-retry',
  },

  projects: [
    {
      // 360 px de ancho, no el escritorio por omision: el objetivo mobile-first
      // se verifica en la medida que se prometio, no en una aproximacion.
      name: 'movil-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 } },
    },
  ],

  // Levanta AMBOS servidores solo: la web no tiene nada que mostrar sin el
  // API. `reuseExistingServer` en local para no reiniciarlos en cada corrida;
  // en CI siempre arrancan limpios.
  webServer: [
    {
      command: 'node apps/api/dist/main.js',
      url: `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333'}/salud`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter @azahar/web dev',
      url: process.env.NEXT_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3010',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      cwd: '../..',
    },
  ],
});
