import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { conTenant } from '@azahar/db';
import type { Sesion } from '../comun/sesion.js';

/**
 * Quien administra los datos fiscales de la escuela.
 *
 * Mas cerrado que cobranza: un RVOE equivocado no cobra de mas, hace que el SAT
 * rechace las facturas de todo un nivel educativo. COBRANZA queda fuera a
 * proposito — quien cobra no decide con que acuerdo se factura.
 */
const ROLES_DATOS_FISCALES = ['DUENO', 'DIRECTOR', 'ADMIN'];

type NivelEducativo =
  | 'PREESCOLAR'
  | 'PRIMARIA'
  | 'SECUNDARIA'
  | 'PROFESIONAL_TECNICO'
  | 'BACHILLERATO';

export interface RvoeResumen {
  id: string;
  sedeId: string;
  sede: string;
  nivelEducativo: string;
  acuerdo: string;
}

/**
 * El RVOE, por nivel educativo (AZ-A1).
 *
 * POR QUE ESTO NECESITA PANTALLA Y NO SOLO TABLA: desde el Sprint 6 el catalogo
 * RECHAZA crear un concepto deducible si no existe el RVOE de su nivel. Sin un
 * lugar donde capturarlo, ese gate deja de ser una proteccion y se vuelve un
 * muro: la escuela no puede avanzar y no sabe por que. Una regla que no se
 * puede satisfacer es un defecto, por correcta que sea.
 */
@Injectable()
export class ServicioRvoe {
  private exigirRol(sesion: Sesion): void {
    if (!sesion.roles.some((r) => ROLES_DATOS_FISCALES.includes(r))) {
      throw new ForbiddenException('Los datos fiscales los administra la dirección.');
    }
  }

  async listar(sesion: Sesion): Promise<RvoeResumen[]> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const filas = await tx.rvoe.findMany({
        include: { sede: { select: { nombre: true } } },
        orderBy: [{ sedeId: 'asc' }, { nivelEducativo: 'asc' }],
      });
      return filas.map((r) => ({
        id: r.id,
        sedeId: r.sedeId,
        sede: r.sede.nombre,
        nivelEducativo: r.nivelEducativo,
        acuerdo: r.acuerdo,
      }));
    });
  }

  /**
   * Registrar o corregir el acuerdo de un nivel.
   *
   * Es un UPSERT sobre (sede, nivel): capturar dos veces el mismo nivel es
   * corregir el numero, no crear un segundo acuerdo. Dos filas para primaria en
   * el mismo plantel harian que la factura dependiera de cual leyo la consulta
   * primero — que es una variante del mismo defecto que este sprint corrigio.
   */
  async registrar(
    sesion: Sesion,
    entrada: { sedeId: string; nivelEducativo: NivelEducativo; acuerdo: string },
  ): Promise<RvoeResumen> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const sede = await tx.sede.findUnique({ where: { id: entrada.sedeId } });
      if (!sede) throw new NotFoundException('No encontramos ese plantel.');

      const guardado = await tx.rvoe.upsert({
        where: {
          sedeId_nivelEducativo: {
            sedeId: entrada.sedeId,
            nivelEducativo: entrada.nivelEducativo,
          },
        },
        create: {
          tenantId: sesion.tenantId,
          sedeId: entrada.sedeId,
          nivelEducativo: entrada.nivelEducativo,
          acuerdo: entrada.acuerdo,
        },
        update: { acuerdo: entrada.acuerdo },
        include: { sede: { select: { nombre: true } } },
      });

      // Un dato fiscal que cambia deja rastro: si una factura sale con un
      // acuerdo y la siguiente con otro, tiene que poder explicarse cuando.
      await tx.eventoAuditoria.create({
        data: {
          tenantId: sesion.tenantId,
          actorId: sesion.usuarioId,
          tipo: 'escuela.rvoe_registrado',
          entidad: 'rvoe',
          entidadId: guardado.id,
          datos: {
            sedeId: entrada.sedeId,
            nivelEducativo: entrada.nivelEducativo,
            acuerdo: entrada.acuerdo,
          },
        },
      });

      return {
        id: guardado.id,
        sedeId: guardado.sedeId,
        sede: guardado.sede.nombre,
        nivelEducativo: guardado.nivelEducativo,
        acuerdo: guardado.acuerdo,
      };
    });
  }
}
