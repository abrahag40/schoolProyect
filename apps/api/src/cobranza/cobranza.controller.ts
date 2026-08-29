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
import { ServicioBecas } from './becas.service.js';
import type { AlumnoParaBeca, BecaResumen } from './becas.service.js';
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
  // Si cuenta para el umbral del Articulo 7 (§52). Sin marca, NO cuenta: de los
  // dos errores posibles, no poder suspender cuesta dinero y suspender antes de
  // tiempo cuesta una multa.
  esColegiatura: z.boolean().optional(),
  // Si puede saldarse con el saldo a favor de la familia (AZ-M4.10). Por
  // omision si; la excepcion son los cobros por cuenta de un tercero.
  aceptaSaldoAFavor: z.boolean().optional(),
  // Una VOLUNTARIA solo se le cobra a quien la acepto (AZ-M4.2). Por omision
  // obligatoria, que es lo que eran todos los conceptos hasta el Sprint 6.
  obligatoriedad: z.enum(['OBLIGATORIA', 'VOLUNTARIA']).optional(),
  // Pronto pago: los dos campos van juntos o ninguno, y la base lo impone.
  descuentoProntoPagoPorcentaje: z.number().positive().max(100).optional(),
  diaProntoPago: z.number().int().min(1).max(31).optional(),
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

// ---------------------------------------------------------------------------
// Becas y convenios (AZ-M4.3a)
// ---------------------------------------------------------------------------

const EsquemaBeca = z
  .object({
    alumnoId: EsquemaId,
    tipo: z.enum(['PORCENTAJE', 'MONTO_FIJO']),
    // Cadena, no número: un porcentaje con dos decimales convertido a `number`
    // para viajar por JSON deja de ser exacto, igual que un importe (§43).
    valor: z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/, 'El valor debe venir como 12.50, sin signos ni comas.'),
    // Null / ausente = aplica a todos los conceptos.
    conceptoId: EsquemaId.optional(),
    vigenteDesde: EsquemaFecha,
    vigenteHasta: EsquemaFecha.optional(),
    // Obligatorio y no vacío: es la prueba de POR QUÉ se becó, y la beca del
    // 5 % de la matrícula es obligación legal, no cortesía.
    motivo: z.string().trim().min(3, 'Escribe por qué se otorga la beca.').max(300),
    esObligacionLegal: z.boolean().optional(),
  })
  .refine((b) => b.tipo !== 'PORCENTAJE' || Number(b.valor) <= 100, {
    message: 'Un porcentaje de beca no puede pasar de 100.',
    path: ['valor'],
  });

/**
 * Becas y convenios (AZ-M4.3a).
 *
 * Vive bajo `/becas` y no colgando del catálogo porque una beca es de una
 * PERSONA, no de un concepto: la misma colegiatura cuesta distinto para dos
 * alumnos, y ese es justo el punto.
 */
@Controller('becas')
@UseGuards(GuardSesion)
export class ControladorBecas {
  constructor(private readonly servicio: ServicioBecas) {}

  @Get()
  async listar(@Req() peticion: { sesion: Sesion }): Promise<BecaResumen[]> {
    return this.servicio.listar(peticion.sesion);
  }

  /** Los alumnos activos, para elegir a quién se beca. */
  @Get('alumnos')
  async alumnos(@Req() peticion: { sesion: Sesion }): Promise<AlumnoParaBeca[]> {
    return this.servicio.alumnos(peticion.sesion);
  }

  @Post()
  @HttpCode(201)
  async otorgar(
    @Body() cuerpo: unknown,
    @Req() peticion: { sesion: Sesion },
  ): Promise<BecaResumen> {
    return this.servicio.otorgar(peticion.sesion, EsquemaBeca.parse(cuerpo));
  }

  /**
   * Retirar una beca. No la borra: la desactiva.
   *
   * Es POST y no DELETE a propósito — no se elimina nada, y el verbo debería
   * decir lo que de verdad pasa. Además exige motivo, igual que cancelar un
   * cargo: un descuento que desaparece sin explicación deja cargos pasados que
   * nadie puede justificar.
   */
  @Post(':id/retirar')
  async retirar(
    @Param('id') id: string,
    @Body() cuerpo: unknown,
    @Req() peticion: { sesion: Sesion },
  ): Promise<{ id: string; activa: boolean }> {
    const { motivo } = z
      .object({ motivo: z.string().trim().min(3, 'Escribe por qué se retira.').max(300) })
      .parse(cuerpo);
    return this.servicio.retirar(peticion.sesion, EsquemaId.parse(id), motivo);
  }
}
