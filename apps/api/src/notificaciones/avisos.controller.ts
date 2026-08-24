import { Controller, Get, HttpCode, Param, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { conTenant } from '@azahar/db';
import { GuardSesion } from '../comun/sesion.guard.js';
import type { Sesion } from '../comun/sesion.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EsquemaId = z.string().regex(UUID, 'El identificador no es válido.');

export interface AvisoParaLaFamilia {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  destino: string | null;
  creadaEn: string;
  leida: boolean;
}

/**
 * Los avisos de quien pregunta (AZ-M5.2).
 *
 * ESTO NO ES EL CENTRO DE AVISOS (pantalla 4, Sprint 7): no filtra, no pagina
 * ni agrupa por conversacion. Es la lectura del registro que el motor de avisos
 * ya escribe, y existe por una razon concreta: el push puede no llegar — el
 * telefono sin permisos, la app cerrada, iOS sin cuenta de desarrollador. Si el
 * unico canal fuera el push, el aviso se perderia sin dejar rastro. Aqui la
 * familia SIEMPRE puede verlo al abrir la app.
 */
@Controller('mis-avisos')
@UseGuards(GuardSesion)
export class ControladorAvisos {
  @Get()
  async mios(@Req() peticion: { sesion: Sesion }): Promise<AvisoParaLaFamilia[]> {
    const { tenantId, usuarioId } = peticion.sesion;

    const avisos = await conTenant(tenantId, (tx) =>
      tx.notificacion.findMany({
        where: { usuarioId },
        orderBy: { creadaEn: 'desc' },
        // Tope explicito: la pantalla muestra lo reciente. Sin limite, una
        // familia con dos anos de historia descarga todo en cada arranque.
        take: 30,
      }),
    );

    return avisos.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      titulo: a.titulo,
      cuerpo: a.cuerpo,
      destino: a.destino,
      creadaEn: a.creadaEn.toISOString(),
      leida: a.leidaEn !== null,
    }));
  }

  /**
   * Marcar leido. El `updateMany` con usuarioId en el WHERE no es estilo: un
   * `update` por id dejaria marcar como leido el aviso de otra familia de la
   * misma escuela, donde RLS no protege (mismo tenant).
   */
  @Post(':id/leido')
  @HttpCode(204)
  async marcarLeido(@Param('id') id: string, @Req() peticion: { sesion: Sesion }): Promise<void> {
    const { tenantId, usuarioId } = peticion.sesion;
    await conTenant(tenantId, (tx) =>
      tx.notificacion.updateMany({
        where: { id: EsquemaId.parse(id), usuarioId, leidaEn: null },
        data: { leidaEn: new Date() },
      }),
    );
  }
}
