import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verificarToken, type Sesion } from './sesion.js';

export interface PeticionConSesion extends Request {
  sesion?: Sesion;
}

/**
 * Guard de sesion: deny-by-default.
 *
 * Todo endpoint nace protegido. Abrir uno al publico exige ponerlo
 * explicitamente fuera del guard, y esa decision queda visible en el codigo.
 * Al reves — proteger endpoint por endpoint — el dia que alguien olvida un
 * decorador queda un agujero silencioso.
 */
@Injectable()
export class GuardSesion implements CanActivate {
  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const peticion = contexto.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      sesion?: Sesion;
    }>();

    const encabezado = peticion.headers['authorization'];
    if (!encabezado?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Inicia sesion para continuar.');
    }

    try {
      peticion.sesion = await verificarToken(encabezado.slice('Bearer '.length));
      return true;
    } catch {
      // Mensaje generico a proposito: distinguir "token invalido" de "token
      // expirado" o "usuario inexistente" le da informacion util a quien sondea.
      throw new UnauthorizedException('Tu sesion no es valida. Vuelve a entrar.');
    }
  }
}
