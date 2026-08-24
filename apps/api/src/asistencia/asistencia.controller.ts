import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import { GuardSesion } from '../comun/sesion.guard.js';
import type { Sesion } from '../comun/sesion.js';
import { ServicioAsistencia } from './asistencia.service.js';
import type { ListaDelDia, MisGrupos, ResultadoPaseLista } from './asistencia.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EsquemaId = z.string().regex(UUID, 'El identificador no es válido.');
const EsquemaFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe venir como AAAA-MM-DD.');

const EsquemaGuardar = z.object({
  cohorteId: EsquemaId,
  fecha: EsquemaFecha.optional(),
  registros: z
    .array(
      z.object({
        alumnoId: EsquemaId,
        estado: z.enum(['PRESENTE', 'AUSENTE', 'RETARDO', 'JUSTIFICADA']),
      }),
    )
    // El tope no es decorativo: sin el, una peticion con 100 mil registros
    // mantiene abierta una transaccion y bloquea la tabla para toda la escuela.
    .min(1, 'No hay nada que guardar.')
    .max(500, 'Demasiados registros en una sola petición.'),
});

/**
 * Pase de lista (AZ-M3.1). Pantalla 6 de la matriz D10.
 *
 * Objetivo duro de diseno: menos de 30 segundos por grupo, con el pulgar. Un
 * docente que tarda mas vuelve al papel — y sin asistencia capturada no hay
 * alertas automaticas, que es la funcion con mejor evidencia de impacto
 * academico de todo el producto.
 */
@Controller('pase-lista')
@UseGuards(GuardSesion)
export class ControladorAsistencia {
  constructor(private readonly servicio: ServicioAsistencia) {}

  /// Declarado ANTES que ':cohorteId': Nest resuelve por orden y 'grupos'
  /// caeria dentro del parametro dinamico.
  @Get('grupos')
  async grupos(@Req() peticion: { sesion: Sesion }): Promise<MisGrupos> {
    return this.servicio.misGrupos(peticion.sesion);
  }

  @Get(':cohorteId')
  async lista(
    @Param('cohorteId') cohorteId: string,
    @Query('fecha') fecha: string | undefined,
    @Req() peticion: { sesion: Sesion },
  ): Promise<ListaDelDia> {
    return this.servicio.lista(
      peticion.sesion,
      EsquemaId.parse(cohorteId),
      fecha ? EsquemaFecha.parse(fecha) : undefined,
    );
  }

  @Post()
  @HttpCode(200)
  async guardar(
    @Body() cuerpo: unknown,
    @Req() peticion: { sesion: Sesion },
  ): Promise<ResultadoPaseLista> {
    return this.servicio.guardar(peticion.sesion, EsquemaGuardar.parse(cuerpo));
  }
}
