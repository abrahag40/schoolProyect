import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { ServicioAuth } from './auth.service.js';

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
  async login(@Body() cuerpo: unknown) {
    const datos = EsquemaLogin.parse(cuerpo);
    return this.auth.iniciarSesion(datos.escuela, datos.email, datos.contrasena);
  }
}
