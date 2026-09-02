import { Module } from '@nestjs/common';
import {
  ControladorAceptaciones,
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
import { ServicioAceptaciones, ServicioBecas } from './becas.service.js';

@Module({
  controllers: [
    ControladorCatalogo,
    ControladorCargos,
    ControladorPagos,
    ControladorEstadoDeCuenta,
    ControladorMorosidad,
    ControladorBecas,
    ControladorAceptaciones,
  ],
  providers: [ServicioCobranza, ServicioPagos, ServicioBecas, ServicioAceptaciones],
})
export class ModuloCobranza {}
