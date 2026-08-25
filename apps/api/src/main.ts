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
app.enableCors({
  origin: process.env.NEXT_PUBLIC_WEB_ORIGIN ?? 'http://localhost:3000',
  credentials: true,
});

const puerto = Number(process.env.API_PORT ?? 3333);
await app.listen(puerto);
// Por la bitacora de Nest y no por console: el arranque queda en el mismo
// canal que todo lo demas, con marca de tiempo y contexto. En un contenedor
// esa diferencia es la que hace legible un log.
new Logger('api').log(`escuchando en http://localhost:${puerto}`);
