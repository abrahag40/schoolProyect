#!/usr/bin/env node
/**
 * Cobertura de estandares: cuantas decisiones § tienen un gate que las detenga.
 *
 * POR QUE EXISTE. El 4-sep-2026, al probar staging en escritorio, aparecio que
 * el panel desperdiciaba hasta la mitad del ancho: cinco anchos distintos
 * escritos a mano, 163 estilos en linea y cero tokens de layout. Siete sprints
 * de revision no lo vieron.
 *
 * La causa no fue falta de estandares —hay mas de sesenta— ni falta de cuidado.
 * Fue que solo se sostuvieron los que alguien convirtio en un gate. El color
 * tiene `check-tokens.mjs` y sigue impecable; el layout nunca tuvo gate y se
 * degrado. Mismo equipo, resultados opuestos.
 *
 * Lo dice mejor el comentario que ya vivia en `eslint.config.mjs`:
 *   "Hasta hoy §28 vivia en un documento. Un documento no detiene un merge."
 *
 * ESTE SCRIPT NO JUZGA CODIGO. Mide una sola cosa, y a proposito: de las
 * decisiones registradas, cuales pueden detener un merge y cuales solo estan
 * escritas. La lista de descubiertas es el trabajo pendiente del auditor.
 *
 * NO se pone rojo por si mismo: sube el porcentaje o baja, y quien lea decide.
 * Un gate sobre el numero de gates seria ceremonia, no ingenieria.
 *
 *   node scripts/auditoria.mjs
 *   node scripts/auditoria.mjs --sin-gate   # solo las descubiertas
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const RAIZ = new URL('..', import.meta.url).pathname;
const IGNORA = new Set(['node_modules', '.next', 'dist', '.git', '.turbo', 'coverage']);

/** Todos los archivos de codigo y configuracion del repo. */
function archivos(dir, acc = []) {
  for (const e of readdirSync(dir)) {
    if (IGNORA.has(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) archivos(p, acc);
    else if (['.ts', '.tsx', '.mjs', '.js', '.yml', '.yaml', '.css', '.sql'].includes(extname(p)))
      acc.push(p);
  }
  return acc;
}

/**
 * Un gate es lo que puede DETENER un merge. Se reconoce por donde vive, no por
 * lo que dice: una § citada en un comentario explica; una § citada dentro de
 * una prueba, del linter o de una migracion, defiende.
 */
const ES_GATE = (ruta) =>
  /[\\/]test[\\/]|\.test\.|eslint\.config|[\\/]scripts[\\/]check-|[\\/]migrations[\\/]|\.github[\\/]workflows/.test(
    ruta,
  );

const decisiones = readFileSync(join(RAIZ, 'docs/decisiones.md'), 'utf8');
const registradas = [...decisiones.matchAll(/^- \*\*§(\d+)\*\* — (.+)$/gm)].map((m) => ({
  n: Number(m[1]),
  titulo: m[2].replace(/\*\*/g, '').slice(0, 68),
}));

const citas = new Map(); // § -> {explica:Set, defiende:Set}
for (const ruta of archivos(RAIZ)) {
  const rel = ruta.slice(RAIZ.length);
  let texto;
  try {
    texto = readFileSync(ruta, 'utf8');
  } catch {
    continue;
  }
  for (const m of texto.matchAll(/§(\d+)/g)) {
    const n = Number(m[1]);
    if (!citas.has(n)) citas.set(n, { explica: new Set(), defiende: new Set() });
    citas.get(n)[ES_GATE(rel) ? 'defiende' : 'explica'].add(rel);
  }
}

const soloSinGate = process.argv.includes('--sin-gate');
const conGate = [];
const soloCitadas = [];
const soloEscritas = [];

for (const d of registradas) {
  const c = citas.get(d.n);
  if (c?.defiende.size) conGate.push({ ...d, donde: [...c.defiende][0] });
  else if (c?.explica.size) soloCitadas.push(d);
  else soloEscritas.push(d);
}

const total = registradas.length;
const pct = (n) => `${((n / total) * 100).toFixed(0)}%`.padStart(4);

console.log(`
===================================================================
 AUDITORIA DE ESTANDARES — ${new Date().toISOString().slice(0, 10)}
===================================================================

  ${String(total).padStart(3)} decisiones registradas en docs/decisiones.md

  ${String(conGate.length).padStart(3)}  ${pct(conGate.length)}  con GATE       — algo se pone rojo si se rompen
  ${String(soloCitadas.length).padStart(3)}  ${pct(soloCitadas.length)}  solo citadas   — el codigo las explica, nada las defiende
  ${String(soloEscritas.length).padStart(3)}  ${pct(soloEscritas.length)}  solo escritas  — viven unicamente en el documento
`);

if (!soloSinGate) {
  console.log('--- Con gate (se sostienen solas) ---');
  for (const d of conGate)
    console.log(`  §${String(d.n).padEnd(3)} ${d.titulo}\n        ↳ ${d.donde}`);
  console.log();
}

console.log('--- SIN GATE: aqui es donde el proyecto se degrada en silencio ---');
console.log('    (una decision de producto o de negocio no siempre puede tener gate;');
console.log('     una regla de codigo que no lo tiene es deuda, no doctrina)\n');
for (const d of [...soloCitadas, ...soloEscritas]) {
  console.log(`  §${String(d.n).padEnd(3)} ${d.titulo}`);
}
console.log(`
-------------------------------------------------------------------
Lo que hay que preguntarse de cada una: ¿esto puede detener un merge?
Si SI y no lo hace, es deuda. Si NO puede, dilo aqui y deja de contarla.
-------------------------------------------------------------------
`);
