import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { GuardSesion } from '../comun/sesion.guard.js';
import type { Sesion } from '../comun/sesion.js';
import { ServicioCobranza } from './cobranza.service.js';
import type { CargoResumen, ConceptoResumen, ResultadoGeneracion } from './cobranza.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EsquemaId = z.string().regex(UUID, 'El identificador no es válido.');
const EsquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe venir como AAAA-MM-DD.');
const EsquemaPeriodo = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'El periodo debe venir como AAAA-MM.');

// El dinero viaja como CADENA, nunca como numero. Un importe convertido a
// `number` para pasar por JSON deja de ser exacto, y el error aparece meses
// despues como "el corte no cuadra" (§4).
const EsquemaMonto = z
  .string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/, 'El importe debe venir como 1234.56, sin signos ni comas.');

const EsquemaConcepto = z.object({
  // Clave estable para analitica (§37): minusculas, numeros y guiones, sin
  // espacios ni acentos, para que sobreviva a exportaciones y a cambios de
  // nombre comercial.
  clave: z
    .string()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'La clave lleva minúsculas, números y guiones.'),
  nombre: z.string().min(2).max(120),
  periodicidad: z.enum(['MENSUAL', 'UNICO', 'ANUAL']),
  monto: EsquemaMonto,
  diaVencimiento: z.number().int().min(1).max(31).optional(),
  cohorteId: EsquemaId.optional(),
  deducibleIedu: z.boolean().optional(),
  nivelEducativo: z
    .enum(['PREESCOLAR', 'PRIMARIA', 'SECUNDARIA', 'PROFESIONAL_TECNICO', 'BACHILLERATO'])
    .optional(),
  vigenteDesde: EsquemaFecha,
  avisadoEn: EsquemaFecha.optional(),
});

const EsquemaAjuste = z.object({
  monto: EsquemaMonto,
  vigenteDesde: EsquemaFecha,
  // Obligatorio, no opcional: sin la fecha del aviso no se puede demostrar la
  // anticipacion que exige el Articulo 5-I.
  avisadoEn: EsquemaFecha,
});

/**
 * Catalogo de cargos (AZ-M4.1). Pantalla 8 de la matriz D10.
 *
 * Es donde la escuela declara QUE cobra. Todo lo demas de la cobranza —generar,
 * repartir y, en el Sprint 5, cobrar— se apoya en lo que se define aqui.
 */
@Controller('catalogo-cargos')
@UseGuards(GuardSesion)
export class ControladorCatalogo {
  constructor(private readonly servicio: ServicioCobranza) {}

  @Get()
  async listar(@Req() peticion: { sesion: Sesion }): Promise<ConceptoResumen[]> {
    return this.servicio.listarConceptos(peticion.sesion);
  }

  @Post()
  @HttpCode(201)
  async crear(
    @Body() cuerpo: unknown,
    @Req() peticion: { sesion: Sesion },
  ): Promise<ConceptoResumen> {
    return this.servicio.crearConcepto(peticion.sesion, EsquemaConcepto.parse(cuerpo));
  }

  /**
   * Ajustar el precio. Exige fecha de vigencia Y fecha de aviso: el Articulo 5-I
   * del Acuerdo de PROFECO pide 60 dias de anticipacion, y sin las dos fechas no
   * hay forma de demostrarlos.
   */
  @Patch(':id/precio')
  async ajustarPrecio(
    @Param('id') id: string,
    @Body() cuerpo: unknown,
    @Req() peticion: { sesion: Sesion },
  ): Promise<{ id: string; monto: string; vigenteDesde: string; diasDeAviso: number }> {
    return this.servicio.ajustarPrecio(
      peticion.sesion,
      EsquemaId.parse(id),
      EsquemaAjuste.parse(cuerpo),
    );
  }
}

/** Generacion y consulta de cargos (AZ-M4.2 / AZ-M4.3). */
@Controller('cargos')
@UseGuards(GuardSesion)
export class ControladorCargos {
  constructor(private readonly servicio: ServicioCobranza) {}

  @Get()
  async listar(
    @Query('periodo') periodo: string,
    @Req() peticion: { sesion: Sesion },
  ): Promise<CargoResumen[]> {
    return this.servicio.listarCargos(peticion.sesion, EsquemaPeriodo.parse(periodo));
  }

  @Post('generar')
  @HttpCode(200)
  async generar(
    @Body() cuerpo: unknown,
    @Req() peticion: { sesion: Sesion },
  ): Promise<ResultadoGeneracion> {
    const { periodo } = z.object({ periodo: EsquemaPeriodo }).parse(cuerpo);
    return this.servicio.generarCargos(peticion.sesion, periodo);
  }
}
