import { Controller, ForbiddenException, Get, Req, UseGuards } from '@nestjs/common';
import { conTenant } from '@azahar/db';
import { GuardSesion } from '../comun/sesion.guard.js';
import type { Sesion } from '../comun/sesion.js';

export interface HijoResumen {
  id: string;
  nombre: string;
  apellidos: string;
  /// Como se llama su grupo EN SU ESCUELA: "3o A", "Sub-12", "Nivel B1".
  cohorte: { nombre: string; tipo: string } | null;
  sede: string | null;
  escuela: string;
  /// La relacion de quien pregunta con este alumno.
  parentesco: string;
  soyPagador: boolean;
}

/**
 * Lo que ve una familia (AZ-M6.1, cimiento del home "mis hijos").
 *
 * Este endpoint es la primera vez que el vinculo tutor-alumno del Sprint 1
 * sirve a un ser humano. Su diseno responde a la investigacion de mercado: el
 * padre vuelve a la app por informacion de SU hijo, no por un muro general
 * (el driver de retorno que ClassDojo demostro a escala).
 */
@Controller('mis-hijos')
@UseGuards(GuardSesion)
export class ControladorFamilia {
  @Get()
  async misHijos(@Req() peticion: { sesion: Sesion }): Promise<HijoResumen[]> {
    const { tenantId, usuarioId, roles } = peticion.sesion;

    // Deny-by-default por rol: este endpoint es para familias. Que el staff no
    // pueda usarlo no es una limitacion — es que el staff tiene su propia
    // vista, y "ver a todos los alumnos" jamas debe salir por la puerta de
    // "ver a mis hijos".
    if (!roles.includes('TUTOR')) {
      throw new ForbiddenException('Esta seccion es para madres, padres y tutores.');
    }

    return conTenant(tenantId, async (tx) => {
      const tutor = await tx.tutor.findFirst({ where: { usuarioId } });
      // Un usuario con rol TUTOR pero sin ficha de tutor es un dato a medias.
      // Devolver lista vacia es correcto y silencioso: no hay hijos que ver.
      if (!tutor) return [];

      const vinculos = await tx.tutorAlumno.findMany({
        where: { tutorId: tutor.id },
        include: {
          alumno: {
            include: {
              tenant: true,
              inscripciones: {
                where: { estado: 'ACTIVA' },
                include: { cohorte: { include: { sede: true } } },
                take: 1,
              },
            },
          },
        },
      });

      return vinculos.map((v) => {
        const inscripcion = v.alumno.inscripciones[0];
        return {
          id: v.alumno.id,
          nombre: v.alumno.nombre,
          apellidos: v.alumno.apellidos,
          cohorte: inscripcion
            ? { nombre: inscripcion.cohorte.nombre, tipo: inscripcion.cohorte.tipo }
            : null,
          sede: inscripcion?.cohorte.sede.nombre ?? null,
          escuela: v.alumno.tenant.nombre,
          parentesco: v.parentesco,
          soyPagador: v.esPagador,
        };
      });
    });
  }
}
