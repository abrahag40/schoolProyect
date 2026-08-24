/**
 * Gate de accesibilidad sobre la paleta (DoD UX / WCAG 2.2 AA).
 *
 * Por que existe: la plantilla de referencia usa su azul de marca (#04A9F5)
 * como texto y como fondo de boton con texto blanco. Ese par alcanza 2.63:1,
 * por debajo del minimo de 4.5:1 (texto) y hasta del 3:1 (componentes no
 * textuales). El defecto es invisible al ojo y evidente al calculo: por eso
 * el contraste se verifica en CI y no se confia ni en el ojo ni en la
 * afirmacion del vendor.
 *
 * Formula: luminancia relativa y razon de contraste de WCAG 2.x.
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const color = JSON.parse(readFileSync(join(here, '..', 'tokens', 'color.json'), 'utf8')).color;

/** Resuelve un token que puede ser un alias {color.x.y}. */
function valor(ref) {
  const raw = ref.$value ?? ref;
  if (typeof raw === 'string' && raw.startsWith('{')) {
    const ruta = raw.slice(1, -1).split('.');
    let nodo = { color };
    for (const parte of ruta) nodo = nodo[parte];
    return valor(nodo);
  }
  return raw;
}

const canalLineal = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

function luminancia(hex) {
  const n = hex.replace('#', '');
  return (
    0.2126 * canalLineal(parseInt(n.slice(0, 2), 16)) +
    0.7152 * canalLineal(parseInt(n.slice(2, 4), 16)) +
    0.0722 * canalLineal(parseInt(n.slice(4, 6), 16))
  );
}

function contraste(hexA, hexB) {
  const a = luminancia(hexA);
  const b = luminancia(hexB);
  const [claro, oscuro] = a > b ? [a, b] : [b, a];
  return (claro + 0.05) / (oscuro + 0.05);
}

const AA_TEXTO = 4.5; // SC 1.4.3 texto normal
const AA_NO_TEXTO = 3.0; // SC 1.4.11 componentes de interfaz y graficos

// --- Tema claro --------------------------------------------------------------

test('AA: texto de cuerpo sobre superficie clara', () => {
  const r = contraste(valor(color.light.text), valor(color.light.surface));
  assert.ok(r >= AA_TEXTO, `texto/superficie = ${r.toFixed(2)}:1`);
});

test('AA: titulos sobre superficie clara', () => {
  const r = contraste(valor(color.light.heading), valor(color.light.surface));
  assert.ok(r >= AA_TEXTO, `heading/superficie = ${r.toFixed(2)}:1`);
});

test('AA: texto secundario (muted) sobre superficie clara', () => {
  const r = contraste(valor(color.light.muted), valor(color.light.surface));
  assert.ok(r >= AA_TEXTO, `muted/superficie = ${r.toFixed(2)}:1`);
});

test('AA: links y texto primario sobre superficie clara', () => {
  const r = contraste(valor(color.light['text-primary']), valor(color.light.surface));
  assert.ok(r >= AA_TEXTO, `text-primary/superficie = ${r.toFixed(2)}:1`);
});

test('AA: boton primario en tema claro (texto sobre fondo de accion)', () => {
  const r = contraste(valor(color.light['on-action']), valor(color.light['action-bg']));
  assert.ok(r >= AA_TEXTO, `on-action/action-bg = ${r.toFixed(2)}:1`);
});

test('AA: borde de control visible sobre la superficie (SC 1.4.11)', () => {
  const r = contraste(valor(color.light['text-primary']), valor(color.light.surface));
  assert.ok(r >= AA_NO_TEXTO, `borde de foco/superficie = ${r.toFixed(2)}:1`);
});

// --- Tema oscuro -------------------------------------------------------------

test('AA: texto de cuerpo sobre superficie oscura', () => {
  const r = contraste(valor(color.dark.text), valor(color.dark.surface));
  assert.ok(r >= AA_TEXTO, `texto/superficie oscura = ${r.toFixed(2)}:1`);
});

test('AA: texto secundario (muted) sobre superficie oscura', () => {
  const r = contraste(valor(color.dark.muted), valor(color.dark.surface));
  assert.ok(r >= AA_TEXTO, `muted/superficie oscura = ${r.toFixed(2)}:1`);
});

test('AA: links y texto primario sobre fondo oscuro', () => {
  const r = contraste(valor(color.dark['text-primary']), valor(color.dark.bg));
  assert.ok(r >= AA_TEXTO, `text-primary/fondo oscuro = ${r.toFixed(2)}:1`);
});

test('AA: boton primario en tema oscuro (texto oscuro sobre azul de marca)', () => {
  const r = contraste(valor(color.dark['on-action']), valor(color.dark['action-bg']));
  assert.ok(r >= AA_TEXTO, `on-action/action-bg oscuro = ${r.toFixed(2)}:1`);
});

// --- Documentacion ejecutable del defecto heredado ---------------------------

test('el azul de marca puro NO es apto como texto sobre blanco (defecto de la plantilla)', () => {
  const r = contraste(valor(color.brand.primary), '#FFFFFF');
  assert.ok(
    r < AA_TEXTO,
    `El primario ya alcanza AA como texto (${r.toFixed(2)}:1). Si esto cambia, ` +
      'primary-strong puede simplificarse: revisar ADR-006 antes de tocar la paleta.',
  );
});
