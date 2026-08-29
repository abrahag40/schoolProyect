/**
 * Preparación de las pruebas de extremo a extremo.
 *
 * POR QUE EXISTE: una prueba que exige "acuérdate de sembrar la base y de
 * generar los cargos antes de correrla" se rompe el día que alguien no se
 * acuerda, y entonces se culpa a la prueba en vez de al defecto. Aquí el
 * escenario se construye solo.
 *
 * Se generan los cargos del mes ANTERIOR y del actual. El anterior garantiza
 * que siempre haya algo vencido —que es lo que ejercita el Artículo 7 y el
 * recargo— sin depender del día en que se corra la suite. Leccion del Sprint 4:
 * los datos de prueba cómodos esconden defectos.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const ejecutar = promisify(execFile);
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

function periodo(mesesAtras: number): string {
  const hoy = new Date();
  return new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - mesesAtras, 1))
    .toISOString()
    .slice(0, 7);
}

async function esperarAlApi(): Promise<void> {
  for (let intento = 0; intento < 40; intento++) {
    try {
      const r = await fetch(`${API}/salud`);
      if (r.ok) return;
    } catch {
      // Todavía no levanta: se reintenta.
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`El API no respondió en ${API}. ¿Está corriendo?`);
}

export default async function preparar(): Promise<void> {
  await ejecutar('pnpm', ['db:seed'], { cwd: '../..' });
  await esperarAlApi();

  const login = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      escuela: 'colegio-azahar',
      email: 'admin@colegioazahar.mx',
      contrasena: 'azahar-demo-2026',
    }),
  });
  const { token } = (await login.json()) as { token: string };

  for (const mes of [periodo(1), periodo(0)]) {
    await fetch(`${API}/cargos/generar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ periodo: mes }),
    });
  }
}
