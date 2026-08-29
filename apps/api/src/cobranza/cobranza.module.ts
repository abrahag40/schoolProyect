import { Module } from '@nestjs/common';
import {
  ControladorBecas,
  ControladorCargos,
  ControladorCatalogo,
} from './cobranza.controller.js';
import {
  ControladorEstadoDeCuenta,
  ControladorMorosidad,
  ControladorPagos,
} from './pagos.controller.js';
import { ServicioCobranza } from './cobranza.service.js';
import { ServicioPagos } from './pagos.service.js';
import { ServicioBecas } from './becas.service.js';

@Module({
  controllers: [
    ControladorCatalogo,
    ControladorCargos,
    ControladorPagos,
    ControladorEstadoDeCuenta,
    ControladorMorosidad,
    ControladorBecas,
  ],
  providers: [ServicioCobranza, ServicioPagos, ServicioBecas],
})
export class ModuloCobranza {}
