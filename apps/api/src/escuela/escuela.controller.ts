import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { conTenant } from '@azahar/db';
import { GuardSesion } from '../comun/sesion.guard.js';
import type { Sesion } from '../comun/sesion.js';

/**
 * Contrato de salida explicito (§31).
 *
 * No es ceremonia: dejar que el tipo lo infiera la capa de datos acopla la
 * respuesta HTTP a la forma de la tabla, y cualquier columna nueva se filtraria
 * sola al cliente. Declararlo obliga a decidir que sale.
 */
export interface ResumenEscuela {
  escuela: { nombre: string; vertical: string } | null;
  sedes: Array<{ id: string; nombre: string; cct: string | null; rvoe: string | null }>;
  /// El periodo vigente. Su TIPO es lo que hace multi-vertical al producto:
  /// ciclo escolar, temporada o cohorte continua.
  periodo: { nombre: string; tipo: string } | null;
  cohortes: Array<{ id: string; nombre: string; tipo: string; inscritos: number }>;
  totales: { alumnos: number; tutores: number; usuarios: number };
  /// Roles de quien pregunta, para que la interfaz muestre lo que puede hacer.
  misRoles: string[];
}

@Controller('mi-escuela')
@UseGuards(GuardSesion)
export class ControladorEscuela {
  @Get()
  async resumen(@Req() peticion: { sesion: Sesion }): Promise<ResumenEscuela> {
    const { tenantId, roles } = peticion.sesion;

    return conTenant(tenantId, async (tx) => {
      const [escuela, sedes, periodo, alumnos, tutores, usuarios] = await Promise.all([
        tx.tenant.findFirst(),
        tx.sede.findMany({ orderBy: { nombre: 'asc' } }),
        tx.periodo.findFirst({ where: { activo: true }, orderBy: { inicio: 'desc' } }),
        tx.alumno.count({ where: { activo: true } }),
        tx.tutor.count(),
        tx.usuario.count(),
      ]);

      // Las cohortes se piden despues porque dependen del periodo vigente.
      const cohortes = periodo
        ? await tx.cohorte.findMany({
            where: { periodoId: periodo.id, activa: true },
            orderBy: { orden: 'asc' },
            include: {
              // Contar inscripciones aqui evita N+1: una consulta, no una por
              // cohorte. Con 30 grupos la diferencia se nota en la pantalla.
              _count: { select: { inscripciones: { where: { estado: 'ACTIVA' } } } },
            },
          })
        : [];

      return {
        escuela: escuela && { nombre: escuela.nombre, vertical: escuela.vertical },
        sedes: sedes.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          cct: s.cct,
          // El RVOE se captura desde el Sprint 0 aunque la facturacion llegue
          // en R2: asi ninguna escuela recaptura al activar el modulo fiscal.
          rvoe: s.rvoe,
        })),
        periodo: periodo && { nombre: periodo.nombre, tipo: periodo.tipo },
        cohortes: cohortes.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          inscritos: c._count.inscripciones,
        })),
        totales: { alumnos, tutores, usuarios },
        misRoles: roles,
      };
    });
  }
}
