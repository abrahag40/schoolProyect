import { Module } from '@nestjs/common';
import { ControladorAsistencia } from './asistencia.controller.js';
import { ServicioAsistencia } from './asistencia.service.js';
import { ModuloNotificaciones } from '../notificaciones/notificaciones.module.js';

/// Importa notificaciones por el PUERTO `Mensajero`, no por una clase concreta:
/// el dia que entre Expo/EAS real, este modulo no se entera (§18).
@Module({
  imports: [ModuloNotificaciones],
  controllers: [ControladorAsistencia],
  providers: [ServicioAsistencia],
})
export class ModuloAsistencia {}
