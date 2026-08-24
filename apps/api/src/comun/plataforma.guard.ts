import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { obtenerCliente } from '@azahar/db';
import type { Sesion } from './sesion.js';

/**
 * Frontera de la consola de ZaharDev (C1 / ADR-008).
 *
 * REGLA QUE ORIGINA ESTE GUARD (precedente de Zentor, jul-2026): la consola
 * cross-tenant estuvo abierta a una cuenta demo compartible, con la contrasena
 * escrita en un runbook. Cualquiera con ese documento veia los datos
 * comerciales de todos los clientes.
 *
 * De ahi las tres condiciones, todas del lado del servidor:
 *   1. La membresia se resuelve por CORREO contra plataforma.miembro. NUNCA se
 *      deduce de un rol dentro de una escuela (ser DUENO de un colegio no da
 *      acceso a la cartera de ZaharDev).
 *   2. Se consulta en cada peticion, no se confia en lo que trae el token: dar
 *      de baja a alguien debe cortarle el acceso al instante, no en 8 horas.
 *   3. Deny-by-default: sin fila activa, no hay consola.
 */
@Injectable()
export class GuardPlataforma implements CanActivate {
  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto.switchToHttp().getRequest<{
      sesion?: Sesion;
      miembroPlataforma?: { id: string; email: string; rol: string; socioId: string | null };
    }>();

    const email = peticion.sesion?.email;
    if (!email) throw new ForbiddenException('Esta seccion no esta disponible para tu cuenta.');

    const miembro = await obtenerCliente().miembroPlataforma.findFirst({
      where: { email, activo: true },
    });
    // Mensaje deliberadamente opaco: confirmar "no eres de plataforma" revela
    // que la consola existe y a quien buscar.
    if (!miembro) throw new ForbiddenException('Esta seccion no esta disponible para tu cuenta.');

    peticion.miembroPlataforma = {
      id: miembro.id,
      email: miembro.email,
      rol: miembro.rol as string,
      socioId: miembro.socioId,
    };
    return true;
  }
}
