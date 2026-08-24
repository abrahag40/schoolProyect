import { Body, Controller, Delete, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { conTenant } from '@azahar/db';
import { GuardSesion } from '../comun/sesion.guard.js';
import type { Sesion } from '../comun/sesion.js';
import { Mensajero } from './mensajero.js';

const EsquemaRegistro = z.object({
  // El formato lo emite el servicio de notificaciones; validarlo aqui evita
  // guardar basura que solo fallaria al momento de enviar, lejos de su causa.
  token: z.string().regex(/^ExponentPushToken\[.+\]$/, 'El token del dispositivo no es valido.'),
  plataforma: z.enum(['IOS', 'ANDROID', 'WEB']),
});

@Controller('notificaciones')
@UseGuards(GuardSesion)
export class ControladorNotificaciones {
  constructor(private readonly mensajero: Mensajero) {}

  /**
   * Registra el dispositivo de quien inicia sesion.
   *
   * Se llama en CADA arranque de la app, no una sola vez: el sistema operativo
   * rota estos tokens y un registro viejo deja a la familia sin avisos sin que
   * nadie se entere.
   */
  @Post('dispositivo')
  @HttpCode(200)
  async registrar(@Body() cuerpo: unknown, @Req() peticion: { sesion: Sesion }) {
    const datos = EsquemaRegistro.parse(cuerpo);
    const { tenantId, usuarioId } = peticion.sesion;

    await conTenant(tenantId, async (tx) => {
      // upsert y no create: reinstalar la app o reabrirla devuelve el mismo
      // token, y un create fallaria por unicidad en el uso mas comun.
      await tx.dispositivoPush.upsert({
        where: { token: datos.token },
        create: { tenantId, usuarioId, token: datos.token, plataforma: datos.plataforma },
        update: { usuarioId, vistoEn: new Date() },
      });
    });

    return { registrado: true };
  }

  @Delete('dispositivo')
  @HttpCode(204)
  async olvidar(@Body() cuerpo: unknown, @Req() peticion: { sesion: Sesion }): Promise<void> {
    const datos = EsquemaRegistro.pick({ token: true }).parse(cuerpo);
    const { tenantId } = peticion.sesion;
    await conTenant(tenantId, (tx) =>
      tx.dispositivoPush.deleteMany({ where: { token: datos.token } }),
    );
  }

  /**
   * Envio de prueba a los dispositivos de quien lo pide.
   *
   * Existe para que el equipo (y el CEO en una demo) verifique la tuberia
   * completa de extremo a extremo. Solo alcanza los dispositivos de la propia
   * sesion: no es un endpoint para notificar a terceros.
   */
  @Post('prueba')
  @HttpCode(200)
  async prueba(@Req() peticion: { sesion: Sesion }) {
    const { tenantId, usuarioId } = peticion.sesion;

    const dispositivos = await conTenant(tenantId, (tx) =>
      tx.dispositivoPush.findMany({ where: { usuarioId } }),
    );

    const resultado = await this.mensajero.enviar(
      dispositivos.map((d) => d.token),
      {
        titulo: 'Azahar',
        cuerpo: 'Tus notificaciones estan funcionando.',
        destino: '/panel',
      },
    );

    // Los tokens que el proveedor rechaza se dan de baja aqui mismo: dejarlos
    // vivos degrada la entrega de los que si sirven.
    if (resultado.tokensInvalidos.length > 0) {
      await conTenant(tenantId, (tx) =>
        tx.dispositivoPush.deleteMany({ where: { token: { in: resultado.tokensInvalidos } } }),
      );
    }

    return { dispositivos: dispositivos.length, ...resultado };
  }
}
