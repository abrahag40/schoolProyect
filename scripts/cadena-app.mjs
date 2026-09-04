#!/usr/bin/env node
/**
 * Construye la DATABASE_URL del rol de aplicacion a partir de la cadena de Neon.
 *
 * POR QUE EXISTE ESTE SCRIPT. El runbook pedia editar la cadena de conexion a
 * mano: tomar la que da Neon y sustituir `usuario:contrasena` por
 * `azahar_app:<contrasena nueva>`. Es un paso de tres segundos que sale mal
 * facilmente — el primer despliegue real de Azahar (4-sep-2026) fallo
 * exactamente ahi, con `DATABASE_URL` conteniendo solo un fragmento de
 * contrasena en vez de una URL. El error que produce (`TypeError: Invalid URL`)
 * no dice nada sobre lo que de verdad paso.
 *
 * Editar cadenas de conexion a mano es una tarea para una maquina. Esto es la
 * maquina.
 *
 * SE EJECUTA EN TU TERMINAL Y NADA SALE DE ELLA: la contrasena se genera aqui,
 * se imprime aqui y no se guarda en ningun archivo. Pegas el resultado en
 * Render y listo.
 *
 *   node scripts/cadena-app.mjs
 */
import { createInterface } from 'node:readline/promises';
import { randomBytes } from 'node:crypto';
import { stdin, stdout } from 'node:process';

const rl = createInterface({ input: stdin, output: stdout });

console.log(`
┌──────────────────────────────────────────────────────────────────┐
│  Cadenas de conexion para Render                                 │
└──────────────────────────────────────────────────────────────────┘

En Neon (proyecto azahar) → boton verde "Connect" → copia la cadena
con "Connection pooling" ENCENDIDO, y pegala aqui abajo.
`);

const pegada = (await rl.question('Cadena POOLED de Neon: ')).trim();
rl.close();

let url;
try {
  url = new URL(pegada);
} catch {
  console.error(`
✗ Eso no es una cadena de conexion completa.

  Debe empezar con "postgresql://" y verse asi:
  postgresql://usuario:contrasena@ep-algo-pooler.region.aws.neon.tech/neondb?sslmode=require

  Lo que pegaste tiene ${pegada.length} caracteres y no empieza con postgresql://.
  Vuelve a Neon y usa el boton de COPIAR de la cadena completa, no el de la
  contrasena sola.
`);
  process.exit(1);
}

if (!url.hostname.includes('-pooler')) {
  console.error(`
✗ Esa es la cadena DIRECTA, no la pooled.

  El host no lleva "-pooler". En Neon, enciende el interruptor
  "Connection pooling" antes de copiar.
`);
  process.exit(1);
}

/**
 * Contrasena segura para el rol de aplicacion.
 *
 * Se usa base64url (alfabeto A-Z a-z 0-9 - _) y NO base64 normal: los caracteres
 * `+` y `/` son significativos dentro de una URL y habria que codificarlos.
 * Una contrasena que rompe la cadena donde vive es una contrasena mal elegida.
 */
const password = randomBytes(24).toString('base64url');

url.username = 'azahar_app';
url.password = password;

// El entrypoint ya limpia `channel_binding` (rompe al driver pg) y el sufijo
// `-pooler` donde toca. Aqui no se toca nada mas que el usuario y la clave.
console.log(`
┌──────────────────────────────────────────────────────────────────┐
│  1 · DATABASE_URL   (pegala tal cual en Render)                  │
└──────────────────────────────────────────────────────────────────┘

${url.toString()}

┌──────────────────────────────────────────────────────────────────┐
│  2 · AUTH_SECRET    (pegala tal cual en Render)                  │
└──────────────────────────────────────────────────────────────────┘

${randomBytes(32).toString('base64url')}

┌──────────────────────────────────────────────────────────────────┐
│  3 · DATABASE_URL_OWNER                                          │
└──────────────────────────────────────────────────────────────────┘

Esa NO se toca: es la cadena de Neon tal cual, pero la DIRECTA
(apaga "Connection pooling" en Neon y copia otra vez).

No hace falta que guardes la contrasena de azahar_app en ningun lado:
el contenedor crea ese rol en su primer arranque con la que acabas de
ver, y a partir de ahi vive solo en Render.
`);
