import { Body, Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { GuardSesion } from '../comun/sesion.guard.js';
import type { Sesion } from '../comun/sesion.js';
import { ServicioPagos } from './pagos.service.js';
import type { EstadoDeCuenta, Morosidad, ResultadoPago } from './pagos.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EsquemaId = z.string().regex(UUID, 'El identificador no es válido.');
const EsquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe venir como AAAA-MM-DD.');

// El dinero viaja como CADENA (§4): un importe convertido a `number` para pasar
// por JSON deja de ser exacto.
const EsquemaPago = z.object({
  tutorId: EsquemaId,
  monto: z
    .string()
    .regex(/^\d{1,8}(\.\d{1,2})?$/, 'El importe debe venir como 1234.56, sin signos ni comas.'),
  fecha: EsquemaFecha,
  metodo: z.enum(['EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'TARJETA', 'OTRO']),
  // El folio no es obligatorio —el efectivo no lo tiene— pero es lo que permite
  // conciliar una transferencia contra el estado de cuenta del banco.
  referencia: z.string().max(120).optional(),
  nota: z.string().max(500).optional(),
});

/** Registro manual de pagos (AZ-M4.9). La pasarela del S6 entra por aquí mismo. */
@Controller('pagos')
@UseGuards(GuardSesion)
export class ControladorPagos {
  constructor(private readonly servicio: ServicioPagos) {}

  @Post()
  @HttpCode(201)
  async registrar(
    @Body() cuerpo: unknown,
    @Req() peticion: { sesion: Sesion },
  ): Promise<ResultadoPago> {
    return this.servicio.registrar(peticion.sesion, EsquemaPago.parse(cuerpo));
  }
}

/**
 * Estado de cuenta de la familia (AZ-M4.5) — pantalla 2 de la matriz D10.
 *
 * Cuelga de `/mis-hijos` a proposito: es la continuacion natural del home que
 * la familia ya conoce desde el Sprint 2, no una seccion aparte.
 */
@Controller('mis-hijos')
@UseGuards(GuardSesion)
export class ControladorEstadoDeCuenta {
  constructor(private readonly servicio: ServicioPagos) {}

  @Get(':alumnoId/estado-de-cuenta')
  async estadoDeCuenta(
    @Param('alumnoId') alumnoId: string,
    @Req() peticion: { sesion: Sesion },
  ): Promise<EstadoDeCuenta> {
    return this.servicio.estadoDeCuenta(peticion.sesion, EsquemaId.parse(alumnoId));
  }
}

/** Panel de morosidad (AZ-M4.8) — pantalla 5 de la matriz D10. */
@Controller('morosidad')
@UseGuards(GuardSesion)
export class ControladorMorosidad {
  constructor(private readonly servicio: ServicioPagos) {}

  @Get()
  async panel(@Req() peticion: { sesion: Sesion }): Promise<Morosidad> {
    return this.servicio.morosidad(peticion.sesion);
  }
}
