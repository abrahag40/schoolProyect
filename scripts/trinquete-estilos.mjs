#!/usr/bin/env node
/**
 * TRINQUETE: los estilos en linea pueden bajar, nunca subir.
 *
 * POR QUE UN TRINQUETE Y NO UNA PROHIBICION. La regla correcta —§64: el ancho y
 * la rejilla viven en el sistema de diseno, no en cada pantalla— no se puede
 * exigir hoy: hay 163 estilos en linea y el repo entero se pondria rojo. Un
 * gate que nadie puede pasar se desactiva en una semana, y entonces no queda
 * gate ni regla.
 *
 * El trinquete si se puede exigir hoy: no obliga a arreglar lo que existe, pero
 * IMPIDE QUE CREZCA. La deuda deja de acumularse el dia que se pone, y el
 * Sprint 7 la baja. Cada vez que baja, el listón baja con ella y no se puede
 * volver a subir.
 *
 * DE DONDE SALE. El 4-sep-2026 el panel desperdiciaba hasta la mitad del ancho
 * en escritorio y siete sprints de revision no lo vieron. La causa no fue falta
 * de estandares —hay mas de sesenta— sino que solo se sostienen los que alguien
 * convirtio en gate: el color tiene `check-tokens.mjs` y sigue impecable; el
 * layout no tenia nada. Esto es el "algo" que le faltaba.
 *
 *   node scripts/trinquete-estilos.mjs            # verifica
 *   node scripts/trinquete-estilos.mjs --fijar    # baja el liston tras mejorar
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const BASE = join(RAIZ, 'scripts/trinquete-estilos.json');
const IGNORA = new Set(['node_modules', '.next', 'dist', '.turbo', 'coverage']);

function tsx(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir)) {
    if (IGNORA.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) tsx(p, acc);
    else if (extname(p) === '.tsx') acc.push(p);
  }
  return acc;
}

/**
 * Se cuentan dos cosas distintas a proposito:
 *   · `enLinea`  — todo `style={{`, que es deuda de sistema de diseno.
 *   · `anchos`   — los que fijan un ANCHO, que son los que rompen §64 y los que
 *                  produjeron el defecto que origino este script.
 * Separarlos permite que el Sprint 7 baje `anchos` a cero sin tener que
 * eliminar de golpe los 163 estilos.
 */
const superficies = ['apps/web/app', 'apps/mobile/app', 'packages/ui/src'];
const cuenta = { enLinea: 0, anchos: 0 };
const culpables = [];

for (const s of superficies) {
  for (const ruta of tsx(join(RAIZ, s))) {
    const texto = readFileSync(ruta, 'utf8');
    const rel = ruta.slice(RAIZ.length);
    cuenta.enLinea += (texto.match(/style={{/g) ?? []).length;
    const anchos = (texto.match(/\b(maxWidth|minWidth|width)\s*:\s*['"]?\d/g) ?? []).length;
    cuenta.anchos += anchos;
    if (anchos) culpables.push(`${rel} (${anchos})`);
  }
}

const liston = existsSync(BASE) ? JSON.parse(readFileSync(BASE, 'utf8')) : null;

if (process.argv.includes('--fijar') || !liston) {
  writeFileSync(
    BASE,
    JSON.stringify(
      {
        _porque:
          'Liston del trinquete. Baja cuando el codigo mejora; nunca sube. Ver scripts/trinquete-estilos.mjs.',
        _fijado: new Date().toISOString().slice(0, 10),
        ...cuenta,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `[trinquete] liston fijado: ${cuenta.enLinea} estilos en linea, ${cuenta.anchos} con ancho.`,
  );
  process.exit(0);
}

let malo = false;
for (const [clave, etiqueta] of [
  ['enLinea', 'estilos en linea'],
  ['anchos', 'anchos escritos a mano (§64)'],
]) {
  const antes = liston[clave];
  const ahora = cuenta[clave];
  if (ahora > antes) {
    console.error(
      `[trinquete] ✗ ${etiqueta}: ${antes} → ${ahora} (+${ahora - antes}).\n` +
        `            El liston solo baja. Usa los tokens y componentes de packages/ui;\n` +
        `            si de verdad hace falta uno nuevo, se agrega AL SISTEMA (§64).`,
    );
    if (clave === 'anchos' && culpables.length) {
      console.error(`            Archivos con anchos: ${culpables.join(', ')}`);
    }
    malo = true;
  } else if (ahora < antes) {
    console.log(
      `[trinquete] ✓ ${etiqueta}: ${antes} → ${ahora}. Corre --fijar para bajar el liston.`,
    );
  } else {
    console.log(`[trinquete] ok: ${etiqueta} en ${ahora}.`);
  }
}
process.exit(malo ? 1 : 0);
