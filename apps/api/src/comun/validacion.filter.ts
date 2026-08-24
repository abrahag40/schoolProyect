import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { ZodError } from 'zod';

/**
 * Traduce errores de validacion a 400, con el mensaje que la persona necesita.
 *
 * EL DEFECTO QUE CORRIGE (encontrado en el Sprint 2 al probar la tuberia de
 * notificaciones): sin este filtro, un dato mal formado del cliente terminaba
 * como 500 Internal Server Error. Tres consecuencias, todas malas:
 *   1. Miente sobre de quien es la culpa: el servidor esta bien, el dato no.
 *   2. Ensucia el monitoreo — los 500 deben significar "algo se rompio", y si
 *      la mitad son datos mal escritos nadie vuelve a mirar esas alertas.
 *   3. El cliente no recibe pista de que corregir.
 *
 * Se devuelven los mensajes de los esquemas, que estan redactados para una
 * persona ("El correo no tiene un formato valido"), no los codigos internos.
 */
@Catch(ZodError)
export class FiltroValidacion implements ExceptionFilter {
  catch(error: ZodError, host: ArgumentsHost): void {
    const respuesta = host.switchToHttp().getResponse<Response>();

    respuesta.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: 'Revisa los datos enviados.',
      // Campo por campo, para que la interfaz pueda señalar el input exacto en
      // lugar de mostrar un mensaje general arriba del formulario.
      detalles: error.issues.map((i) => ({
        campo: i.path.join('.') || '(cuerpo)',
        mensaje: i.message,
      })),
    });
  }
}
