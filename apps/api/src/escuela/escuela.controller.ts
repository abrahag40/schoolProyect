import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { conTenant } from '@azahar/db';
import { GuardSesion } from '../comun/sesion.guard.js';
import { ServicioRvoe } from './rvoe.service.js';
import type { RvoeResumen } from './rvoe.service.js';
import type { Sesion } from '../comun/sesion.js';
import {
  aplicaAcuerdoProfeco,
  diasDeAvisoExigidos,
  pisoDeGracia,
} from '../cobranza/marco-legal.js';

/**
 * Contrato de salida explicito (§31).
 *
 * No es ceremonia: dejar que el tipo lo infiera la capa de datos acopla la
 * respuesta HTTP a la forma de la tabla, y cualquier columna nueva se filtraria
 * sola al cliente. Declararlo obliga a decidir que sale.
 */
export interface ResumenEscuela {
  escuela: { nombre: string; vertical: string } | null;
  /// Cada plantel con SUS acuerdos RVOE, uno por nivel educativo (AZ-A1).
  /// Antes era una cadena por sede; con tres niveles, dos de cada tres CFDI
  /// habrian salido con el acuerdo equivocado.
  sedes: Array<{
    id: string;
    nombre: string;
    cct: string | null;
    rvoes: Array<{ nivelEducativo: string; acuerdo: string }>;
  }>;
  /// El periodo vigente. Su TIPO es lo que hace multi-vertical al producto:
  /// ciclo escolar, temporada o cohorte continua.
  periodo: { nombre: string; tipo: string } | null;
  cohortes: Array<{ id: string; nombre: string; tipo: string; inscritos: number }>;
  totales: { alumnos: number; tutores: number; usuarios: number };
  /// Roles de quien pregunta, para que la interfaz muestre lo que puede hacer.
  misRoles: string[];
  /// QUE LEY OBLIGA A ESTA ESCUELA, ya resuelto (§51).
  ///
  /// Viaja resuelto y no como "vertical" a secas por una razon de diseno: si la
  /// interfaz tradujera vertical -> ley, la regla legal viviria en dos sitios y
  /// el dia que cambie habria que acordarse del segundo. §45 dice que el limite
  /// legal vive en el dominio; esto es el dominio contandole a la pantalla que
  /// puede afirmar sin mentir.
  marcoLegal: {
    aplicaAcuerdoProfeco: boolean;
    /// Dias que la ley obliga a aceptar sin recargo. Cero = no hay piso legal.
    pisoSinRecargo: number;
    /// Dias de aviso que la ley exige para subir un precio. Cero = lo fija el contrato.
    avisoDeAjuste: number;
  };
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
        tx.sede.findMany({
          orderBy: { nombre: 'asc' },
          include: { rvoes: { orderBy: { nivelEducativo: 'asc' } } },
        }),
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

      const vertical = escuela?.vertical ?? 'COLEGIO';

      return {
        escuela: escuela && { nombre: escuela.nombre, vertical: escuela.vertical },
        marcoLegal: {
          aplicaAcuerdoProfeco: aplicaAcuerdoProfeco(vertical),
          pisoSinRecargo: pisoDeGracia(vertical),
          avisoDeAjuste: diasDeAvisoExigidos(vertical),
        },
        sedes: sedes.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          cct: s.cct,
          // El RVOE se captura desde el Sprint 0 aunque la facturacion llegue
          // en R2: asi ninguna escuela recaptura al activar el modulo fiscal.
          // Va POR NIVEL desde el Sprint 6, que es como lo otorga la autoridad
          // y como lo exige el complemento IEDU.
          rvoes: s.rvoes.map((r) => ({
            nivelEducativo: r.nivelEducativo,
            acuerdo: r.acuerdo,
          })),
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

// ---------------------------------------------------------------------------
// RVOE por nivel educativo (AZ-A1)
// ---------------------------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const EsquemaRvoe = z.object({
  sedeId: z.string().regex(UUID, 'El plantel no es válido.'),
  nivelEducativo: z.enum([
    'PREESCOLAR',
    'PRIMARIA',
    'SECUNDARIA',
    'PROFESIONAL_TECNICO',
    'BACHILLERATO',
  ]),
  // No vacío: un acuerdo en blanco pasaría la validación de "existe" del
  // catálogo y produciría un CFDI con el campo vacío, que el SAT rechaza igual.
  acuerdo: z.string().trim().min(3, 'Escribe el número de acuerdo.').max(120),
});

/**
 * Los acuerdos RVOE de la escuela, uno por plantel y nivel.
 *
 * Existe porque el catálogo RECHAZA crear un concepto deducible sin el RVOE de
 * su nivel: sin un lugar donde capturarlo, ese gate deja de proteger y se
 * vuelve un muro. Una regla que no se puede satisfacer es un defecto, por
 * correcta que sea.
 */
@Controller('rvoe')
@UseGuards(GuardSesion)
export class ControladorRvoe {
  constructor(private readonly servicio: ServicioRvoe) {}

  @Get()
  async listar(@Req() peticion: { sesion: Sesion }): Promise<RvoeResumen[]> {
    return this.servicio.listar(peticion.sesion);
  }

  @Post()
  @HttpCode(201)
  async registrar(
    @Body() cuerpo: unknown,
    @Req() peticion: { sesion: Sesion },
  ): Promise<RvoeResumen> {
    return this.servicio.registrar(peticion.sesion, EsquemaRvoe.parse(cuerpo));
  }
}
