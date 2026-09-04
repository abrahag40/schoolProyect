#!/usr/bin/env node
/**
 * Construye las TRES variables de entorno que Render necesita, a partir de las
 * dos cadenas que da Neon.
 *
 * POR QUE EXISTE ESTE SCRIPT. El runbook pedia editar cadenas de conexion a
 * mano. El primer despliegue real de Azahar (4-sep-2026) fallo dos veces
 * seguidas ahi, y las dos veces el mensaje de error no decia nada util:
 *
 *   1er intento · `TypeError: Invalid URL` con input `npg_...`
 *      -> DATABASE_URL tenia solo un fragmento de contrasena.
 *   2do intento · `getaddrinfo ENOTFOUND base`
 *      -> DATABASE_URL_OWNER tenia `base` como nombre de servidor.
 *
 * La primera version de este script cubria dos de los tres valores y dejaba el
 * tercero a mano. El fallo se mudo exactamente ahi. La leccion, escrita para
 * que no se repita: **si un paso manual es lo bastante fragil como para
 * automatizar la mitad, hay que automatizarlo entero.** Una automatizacion
 * parcial solo cambia de sitio el error.
 *
 * SE EJECUTA EN TU TERMINAL Y NADA SALE DE ELLA: la contrasena se genera aqui,
 * se imprime aqui y no se escribe en ningun archivo.
 *
 *   node scripts/cadena-app.mjs
 */
import { createInterface } from 'node:readline';
import { randomBytes } from 'node:crypto';
import { stdin, stdout } from 'node:process';

const rl = createInterface({ input: stdin, output: stdout, terminal: false });

/**
 * Lineas de la entrada, una a una.
 *
 * Se usa un iterador y no `readline/promises` porque con `question()` el script
 * se queda COLGADO EN SILENCIO cuando la entrada se acaba —por ejemplo si
 * alguien lo alimenta con una tuberia o pega una sola linea de las dos—. Un
 * script que se cuelga sin decir nada es peor que uno que falla.
 */
const lineas = rl[Symbol.asyncIterator]();

const caja = (t) => `
┌──────────────────────────────────────────────────────────────────┐
│  ${t.padEnd(64)}│
└──────────────────────────────────────────────────────────────────┘`;

/**
 * Lee una cadena de conexion y falla con un mensaje que dice QUE hacer.
 *
 * Los mensajes explican el sintoma en terminos de lo que se ve en Neon, no en
 * terminos de la excepcion: quien esta pegando cadenas a las 12 de la noche no
 * necesita saber que `new URL()` lanzo, necesita saber que boton apretar.
 */
async function pedirCadena({ etiqueta, debeSerPooled }) {
  stdout.write(etiqueta);
  const { value, done } = await lineas.next();

  if (done) {
    throw new Error('Se acabo la entrada antes de recibir las dos cadenas.');
  }
  const texto = String(value).trim();
  if (!texto) {
    throw new Error('No pegaste nada.');
  }
  let url;
  try {
    url = new URL(texto);
  } catch {
    throw new Error(
      `Eso no es una cadena de conexion completa.\n\n` +
        `  Pegaste ${texto.length} caracteres y deben empezar con "postgresql://".\n` +
        `  En Neon usa el boton "Copy snippet" DEBAJO del recuadro grande, que\n` +
        `  copia la cadena entera. No copies solo la contrasena ni el host.`,
    );
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(
      `La cadena empieza con "${url.protocol}" y deberia empezar con "postgresql://".`,
    );
  }
  if (!url.hostname.endsWith('.neon.tech')) {
    throw new Error(
      `El servidor dice "${url.hostname}" y deberia terminar en ".neon.tech".\n\n` +
        `  Suele pasar por copiar a medias o por pegar texto que no era la cadena.`,
    );
  }

  const esPooled = url.hostname.includes('-pooler');
  if (debeSerPooled && !esPooled) {
    throw new Error(
      `Esa es la cadena DIRECTA, y aqui va la POOLED.\n\n` +
        `  En Neon, ENCIENDE el interruptor "Connection pooling" y copia otra vez.`,
    );
  }
  if (!debeSerPooled && esPooled) {
    throw new Error(
      `Esa es la cadena POOLED, y aqui va la DIRECTA.\n\n` +
        `  En Neon, APAGA el interruptor "Connection pooling" y copia otra vez.`,
    );
  }
  return url;
}

try {
  console.log(caja('Variables de Render, a partir de las cadenas de Neon'));
  console.log(`
Abre Neon → proyecto **azahar** → boton verde "Connect".
Vas a copiar la misma cadena dos veces: una con "Connection pooling"
encendido y otra con el apagado.
`);

  const pooled = await pedirCadena({
    etiqueta: '1/2 · Cadena POOLED (interruptor ENCENDIDO): ',
    debeSerPooled: true,
  });
  const directa = await pedirCadena({
    etiqueta: '2/2 · Cadena DIRECTA (interruptor APAGADO): ',
    debeSerPooled: false,
  });

  // Las dos cadenas tienen que ser del MISMO proyecto: la unica diferencia
  // legitima entre sus servidores es el sufijo `-pooler`. Sin esta comprobacion,
  // mezclar la cadena de otro proyecto de Neon crearia las tablas de Azahar
  // dentro de la base de datos de otro producto — y no fallaria: funcionaria,
  // que es peor.
  if (pooled.hostname.replace('-pooler', '') !== directa.hostname) {
    throw new Error(
      `Las dos cadenas son de proyectos distintos.\n\n` +
        `  Pooled:  ${pooled.hostname}\n` +
        `  Directa: ${directa.hostname}\n\n` +
        `  Quitandole "-pooler" a la primera deberian ser identicas. Revisa que\n` +
        `  en Neon estes en el proyecto "azahar" y no en otro.`,
    );
  }

  /**
   * Contrasena del rol de aplicacion.
   *
   * base64url (A-Z a-z 0-9 - _) y no base64: `+` y `/` son significativos
   * dentro de una URL. Una contrasena que rompe la cadena donde vive es una
   * contrasena mal elegida.
   */
  const app = new URL(pooled.toString());
  app.username = 'azahar_app';
  app.password = randomBytes(24).toString('base64url');

  console.log(`
${caja('Copia estos tres valores a Render, uno por uno')}

── DATABASE_URL ───────────────────────────────────────────────────

${app.toString()}

── DATABASE_URL_OWNER ─────────────────────────────────────────────

${directa.toString()}

── AUTH_SECRET ────────────────────────────────────────────────────

${randomBytes(32).toString('base64url')}

───────────────────────────────────────────────────────────────────

Las dos cadenas apuntan al mismo servidor (${directa.hostname}),
asi que estan bien emparejadas.

No guardes la contrasena de azahar_app en ningun lado: el contenedor
crea ese rol en su primer arranque con la que acabas de ver.
`);
} catch (error) {
  console.error(`\n✗ ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
} finally {
  rl.close();
}
