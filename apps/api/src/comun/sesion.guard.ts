import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { verificarToken, type Sesion } from './sesion.js';
import { leerCookie, NOMBRE_COOKIE } from './cookie-sesion.js';

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

    // Dos formas de presentar la sesion, una por superficie:
    //   - Cookie httpOnly  -> la web (invisible para JavaScript, anti-XSS).
    //   - Bearer            -> la app movil (token en el llavero del sistema).
    // Se busca primero la cookie porque es la unica que el navegador manda
    // sola; si un cliente envia ambas, gana la cookie.
    const deCookie = leerCookie(peticion.headers['cookie'], NOMBRE_COOKIE);
    const encabezado = peticion.headers['authorization'];
    const token = deCookie ?? (encabezado?.startsWith('Bearer ') ? encabezado.slice(7) : undefined);

    if (!token) {
      throw new UnauthorizedException('Inicia sesion para continuar.');
    }

    try {
      peticion.sesion = await verificarToken(token);
      return true;
    } catch {
      // Mensaje generico a proposito: distinguir "token invalido" de "token
      // expirado" o "usuario inexistente" le da informacion util a quien sondea.
      throw new UnauthorizedException('Tu sesion no es valida. Vuelve a entrar.');
    }
  }
}
