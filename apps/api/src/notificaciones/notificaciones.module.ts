import { Module } from '@nestjs/common';
import { ControladorNotificaciones } from './notificaciones.controller.js';
import { ControladorAvisos } from './avisos.controller.js';
import { Mensajero, MensajeroSimulado } from './mensajero.js';

/**
 * El proveedor se elige por entorno (§18). Hoy solo existe el simulado; cuando
 * entre el real (Expo/EAS), se agrega aqui y NADA mas cambia en el resto del
 * codigo — esa es la razon de que exista el puerto.
 */
@Module({
  controllers: [ControladorNotificaciones, ControladorAvisos],
  providers: [
    {
      provide: Mensajero,
      useClass: MensajeroSimulado,
    },
  ],
  exports: [Mensajero],
})
export class ModuloNotificaciones {}
