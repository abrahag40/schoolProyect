import { Module } from '@nestjs/common';
import { ControladorCargos, ControladorCatalogo } from './cobranza.controller.js';
import {
  ControladorEstadoDeCuenta,
  ControladorMorosidad,
  ControladorPagos,
} from './pagos.controller.js';
import { ServicioCobranza } from './cobranza.service.js';
import { ServicioPagos } from './pagos.service.js';

@Module({
  controllers: [
    ControladorCatalogo,
    ControladorCargos,
    ControladorPagos,
    ControladorEstadoDeCuenta,
    ControladorMorosidad,
  ],
  providers: [ServicioCobranza, ServicioPagos],
})
export class ModuloCobranza {}
