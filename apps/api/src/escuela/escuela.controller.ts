import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { conTenant } from '@azahar/db';
import { GuardSesion } from '../comun/sesion.guard.js';
import type { Sesion } from '../comun/sesion.js';

/**
 * Datos de la escuela de la sesion.
 *
 * Observese que ningun metodo recibe un identificador de escuela: se toma del
 * token. Es la diferencia entre "la API filtra por el tenant que le mandan" y
 * "la API solo puede ver el tenant de quien pregunta".
 */
/**
 * Contrato de salida explicito.
 *
 * No es ceremonia: dejar que el tipo lo infiera Prisma acopla la respuesta HTTP
 * a la forma interna de la tabla, y cualquier columna nueva se filtraria sola
 * al cliente. Declararlo obliga a decidir que sale.
 */
export interface ResumenEscuela {
  escuela: { nombre: string; vertical: string } | null;
  sedes: Array<{ id: string; nombre: string; cct: string | null; rvoe: string | null }>;
  totalUsuarios: number;
}

@Controller('mi-escuela')
@UseGuards(GuardSesion)
export class ControladorEscuela {
  @Get()
  async resumen(@Req() peticion: { sesion: Sesion }): Promise<ResumenEscuela> {
    const { tenantId } = peticion.sesion;

    return conTenant(tenantId, async (tx) => {
      const [escuela, sedes, totalUsuarios] = await Promise.all([
        tx.tenant.findFirst(),
        tx.sede.findMany({ orderBy: { nombre: 'asc' } }),
        tx.usuario.count(),
      ]);

      return {
        escuela: escuela && {
          nombre: escuela.nombre,
          vertical: escuela.vertical,
        },
        sedes: sedes.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          cct: s.cct,
          // El RVOE se captura desde el Sprint 0 aunque la facturacion llegue
          // en R2: asi ninguna escuela recaptura al activar el modulo fiscal.
          rvoe: s.rvoe,
        })),
        totalUsuarios,
      };
    });
  }
}
