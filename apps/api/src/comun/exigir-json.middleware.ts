import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * TODO POST DEBE DECLARAR `application/json`. Es la defensa CSRF del sistema.
 *
 * POR QUE EXISTE (defecto del 4-sep-2026, primer despliegue real): la cookie de
 * sesion viaja con `SameSite=None` en produccion —ver `cookie-sesion.ts` para
 * el porque—, asi que el navegador SI la manda en peticiones nacidas en otro
 * sitio. Lo unico que separa entonces a una pagina maliciosa del API es el
 * CORS... y el CORS solo interviene si hay preflight.
 *
 * Los tres tipos de cuerpo que NO provocan preflight son
 * `application/x-www-form-urlencoded`, `multipart/form-data` y `text/plain`.
 * Con cualquiera de ellos, cualquier sitio puede enviar un POST con las
 * credenciales de la persona y el navegador lo permite. SE COMPROBO CONTRA EL
 * API DESPLEGADO: un POST con formulario desde un origen ajeno devolvia 200.
 *
 * Exigir `application/json` convierte todo POST en peticion "no simple", lo que
 * obliga al preflight, donde el CORS lo rechaza por origen.
 *
 * NO SE CUBREN PUT/PATCH/DELETE a proposito: esos metodos ya provocan preflight
 * siempre, asi que anadirlos seria ruido sin proteccion nueva.
 *
 * Y NO BASTA CON "solo parseamos JSON": hay endpoints que mutan SIN cuerpo
 * (`/becas/:id/retirar`, `/mis-avisos/:id/leido`). A esos les bastaria un POST
 * vacio de un tercero. Por eso la regla mira el ENCABEZADO, no el contenido.
 */
@Injectable()
export class ExigirJsonEnPost implements NestMiddleware {
  use(req: IncomingMessage, res: ServerResponse, next: () => void): void {
    if (req.method !== 'POST') return next();

    // Se corta en el `;` porque `application/json; charset=utf-8` es valido y
    // comparar la cadena entera lo rechazaria.
    // El `?? ''` no es decorativo: con `noUncheckedIndexedAccess` el indice de
    // un split es `string | undefined`, y sin el la defensa no compila.
    const tipo = (String(req.headers['content-type'] ?? '').split(';')[0] ?? '')
      .trim()
      .toLowerCase();
    if (tipo === 'application/json') return next();

    res.statusCode = 415;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        statusCode: 415,
        error: 'Unsupported Media Type',
        message: 'Las peticiones POST deben enviarse con Content-Type: application/json.',
      }),
    );
  }
}
