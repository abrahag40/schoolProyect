#!/usr/bin/env node
/**
 * Espera a que Postgres acepte conexiones antes de continuar.
 * Evita la carrera clasica: `docker compose up -d` retorna cuando el contenedor
 * arranco, no cuando la base esta lista, y la migracion siguiente falla.
 */
import { execSync } from 'node:child_process';

const INTENTOS = 30;
const ESPERA_MS = 1000;

for (let i = 1; i <= INTENTOS; i++) {
  try {
    execSync('docker exec azahar-db-dev pg_isready -U azahar_owner -d azahar', {
      stdio: 'pipe',
    });
    console.log(`[db] lista (intento ${i})`);
    process.exit(0);
  } catch {
    if (i === INTENTOS) {
      console.error('[db] no respondio tras ' + INTENTOS + ' intentos. Revisa `docker ps`.');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, ESPERA_MS));
  }
}
