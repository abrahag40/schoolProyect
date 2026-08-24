#!/usr/bin/env node
/**
 * Gate de lint: prohibe colores literales fuera del sistema de tokens.
 *
 * Origen de la practica (Zentor): una clase de color escrita a mano en varios
 * archivos no pintaba nada y nadie se entero hasta ver un panel transparente.
 * Tailwind y CSS no avisan de un color inventado. El gate prohibe la FORMA
 * (literales hex/rgb en codigo de UI), no persigue instancias.
 *
 * Excepciones legitimas: el propio paquete de tokens y los archivos de tema.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const RAIZ = process.cwd();
const DIRS = ['apps/web', 'apps/mobile', 'packages/ui'];
const EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
const EXCLUIDOS = [
  'node_modules',
  'dist',
  '.next',
  '.expo',
  'build',
  // El tema es el UNICO lugar donde se materializan los valores.
  'theme.css',
  'tokens.css',
  'tokens.js',
];

// Hex de 3/4/6/8 digitos, rgb()/rgba()/hsl() con numeros.
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d+|\bhsla?\(\s*\d+/;

function* archivos(dir) {
  let entradas;
  try {
    entradas = readdirSync(dir);
  } catch {
    return; // el directorio aun no existe (sprint temprano)
  }
  for (const e of entradas) {
    if (EXCLUIDOS.includes(e)) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) yield* archivos(p);
    else if (EXT.has(extname(p))) yield p;
  }
}

const hallazgos = [];
for (const dir of DIRS) {
  for (const archivo of archivos(join(RAIZ, dir))) {
    const lineas = readFileSync(archivo, 'utf8').split('\n');
    lineas.forEach((linea, i) => {
      if (linea.includes('token-ok')) return; // escape explicito y visible
      const m = linea.match(LITERAL);
      if (m) hallazgos.push(`${relative(RAIZ, archivo)}:${i + 1}  ${m[0]}  ->  ${linea.trim()}`);
    });
  }
}

if (hallazgos.length > 0) {
  console.error('\n[check-tokens] Colores literales fuera del sistema de tokens:\n');
  for (const h of hallazgos) console.error('  ' + h);
  console.error(
    `\n${hallazgos.length} hallazgo(s). Usa una variable de @azahar/tokens.\n` +
      'Si el literal es inevitable, agrega el comentario token-ok en la linea y explica por que.\n',
  );
  process.exit(1);
}

console.log('[check-tokens] ok: sin colores literales fuera del sistema.');
