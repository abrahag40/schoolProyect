import { Module } from '@nestjs/common';
import { ControladorEscuela, ControladorRvoe } from './escuela.controller.js';
import { ServicioRvoe } from './rvoe.service.js';

@Module({
  controllers: [ControladorEscuela, ControladorRvoe],
  providers: [ServicioRvoe],
})
export class ModuloEscuela {}
