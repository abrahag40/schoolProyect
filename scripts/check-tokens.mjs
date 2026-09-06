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
  // --- EL ARBOL ADOPTADO DE METRONIC (AZ-D2.9, Sprint 8) -------------------
  //
  // Mismo criterio que ESLint: es codigo que no escribimos. Al copiarlo, este
  // gate encontro 57 literales de color dentro de sus componentes.
  //
  // NO SE "PERDONAN": SE MIDEN Y SE VIGILAN EN OTRA CAPA. Esos 57 son un
  // riesgo real —un componente suyo puede pintar un gris que no sale de
  // nuestros tokens— pero perseguirlos archivo por archivo convertiria cada
  // uno en un fork imposible de diffear contra Metronic 9.6.
  //
  // Lo que si se vigila es lo que IMPORTA y donde IMPORTA:
  // `apps/web/e2e/puente-tokens.spec.ts` mide el contraste sobre el componente
  // YA RENDERIZADO (§68). Un literal en un componente que nadie monta no hace
  // daño; uno en un boton que si se usa pone el gate en rojo. Es la diferencia
  // entre prohibir la forma y comprobar el efecto (§14).
  //
  // El conteo vive en el inventario del sprint. Si sube, es que entro codigo
  // nuevo sin revisar.
  'apps/web/components/ui',
  'apps/web/components/common',
  'apps/web/components/keenicons',
  'apps/web/css',
  'apps/web/hooks',
  'apps/web/providers',
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
    const p = join(dir, e);
    // Se excluye por NOMBRE (`node_modules`, `theme.css`) o por RUTA
    // (`apps/web/components/ui`). Las dos formas hacen falta: `ui` como nombre
    // suelto excluiria cualquier carpeta llamada asi en todo el repo, incluida
    // una nuestra. La ruta dice exactamente cual.
    const rel = relative(RAIZ, p);
    if (EXCLUIDOS.some((x) => x === e || rel === x || rel.startsWith(`${x}/`))) continue;
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
