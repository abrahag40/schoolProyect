import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import { ServicioAuth } from './auth.service.js';
import { limpiarCookieSesion, ponerCookieSesion } from '../comun/cookie-sesion.js';

/**
 * Validacion en el borde (DoD Seguridad): nada entra al dominio sin pasar por
 * un esquema. Zod se usa aqui y no dentro del servicio para que el limite entre
 * "lo que llego de fuera" y "lo que ya es confiable" sea visible.
 */
const EsquemaLogin = z.object({
  escuela: z.string().min(1, 'Indica la escuela.').max(64),
  email: z.string().email('El correo no tiene un formato valido.').max(254),
  contrasena: z.string().min(8, 'La contrasena tiene al menos 8 caracteres.').max(200),
});

@Controller('auth')
export class ControladorAuth {
  constructor(private readonly auth: ServicioAuth) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() cuerpo: unknown, @Res({ passthrough: true }) res: Response) {
    const datos = EsquemaLogin.parse(cuerpo);
    const resultado = await this.auth.iniciarSesion(datos.escuela, datos.email, datos.contrasena);

    // La cookie es para la web. El token sigue viajando en el cuerpo porque la
    // app movil lo necesita: no puede usar cookies del navegador y lo guarda
    // en el llavero cifrado del sistema.
    ponerCookieSesion(res, resultado.token);
    return resultado;
  }

  /**
   * Cerrar sesion de verdad.
   *
   * Con el token en almacenamiento del navegador bastaba con borrarlo del
   * lado del cliente; con cookie httpOnly el cliente NO puede tocarla, asi que
   * el servidor tiene que retirarla. Sin este endpoint, "salir" en la web
   * dejaria la sesion viva hasta que expirara sola.
   */
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    limpiarCookieSesion(res);
  }
}
