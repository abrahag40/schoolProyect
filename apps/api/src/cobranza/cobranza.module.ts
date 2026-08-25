import { Module } from '@nestjs/common';
import { ControladorCargos, ControladorCatalogo } from './cobranza.controller.js';
import { ServicioCobranza } from './cobranza.service.js';

@Module({
  controllers: [ControladorCatalogo, ControladorCargos],
  providers: [ServicioCobranza],
})
export class ModuloCobranza {}
