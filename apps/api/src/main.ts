import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// El entorno se carga ANTES de cualquier import que lea process.env.
const rutaEnv = fileURLToPath(new URL('../../../.env', import.meta.url));
if (existsSync(rutaEnv)) process.loadEnvFile(rutaEnv);

const { NestFactory } = await import('@nestjs/core');
const { Logger } = await import('@nestjs/common');
const { ModuloApp } = await import('./app.module.js');

const app = await NestFactory.create(ModuloApp);

// CORS acotado al origen de la web. Un `origin: true` en produccion permitiria
// que cualquier sitio hiciera peticiones con las credenciales del usuario.
//
// EN PRODUCCION LA VARIABLE ES OBLIGATORIA Y EL ARRANQUE FALLA SIN ELLA (§59).
// La version anterior caia a `http://localhost:3000` en silencio, y el primer
// despliegue real (4-sep-2026) estuvo una hora sirviendo `/salud` en verde
// mientras el navegador tenia el CORS cerrado contra la web de Vercel: el
// blueprint declara la variable con `sync: false` y nadie la habia llenado.
// Un respaldo que no puede funcionar en produccion no es un respaldo, es un
// fallo aplazado hasta que lo encuentra un usuario. Mejor no arrancar.
//
// (De paso, ese respaldo apuntaba al 3000 y el puerto de la web es el 3010 —§35—,
// asi que tampoco servia en desarrollo.)
const origenWeb = process.env.NEXT_PUBLIC_WEB_ORIGIN?.trim();
if (!origenWeb && process.env.NODE_ENV === 'production') {
  throw new Error(
    'Falta NEXT_PUBLIC_WEB_ORIGIN. En produccion el origen de la web se declara ' +
      'explicitamente: sin el, el API arrancaria con el CORS cerrado contra su propia web. ' +
      'Ponla en el panel del proveedor (en Render es una variable con sync:false) con la ' +
      'URL ESTABLE de la web, sin barra final.',
  );
}
const origen = origenWeb || 'http://localhost:3010';
app.enableCors({ origin: origen, credentials: true });

const puerto = Number(process.env.API_PORT ?? 3333);
await app.listen(puerto);
// Por la bitacora de Nest y no por console: el arranque queda en el mismo
// canal que todo lo demas, con marca de tiempo y contexto. En un contenedor
// esa diferencia es la que hace legible un log.
// El origen del CORS se imprime al arrancar: es la unica forma de verlo sin
// provocar un fallo desde el navegador.
new Logger('api').log(`escuchando en http://localhost:${puerto} · CORS para ${origen}`);
