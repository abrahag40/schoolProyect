import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { conTenant } from '@azahar/db';
import type { Sesion } from '../comun/sesion.js';
import { fechaEscolar } from '../comun/fecha-escolar.js';
import { estaVigente, validarPorcentaje } from './descuentos.js';

const ROLES_COBRANZA = ['DUENO', 'DIRECTOR', 'ADMIN', 'COBRANZA'];

type Transaccion = Parameters<Parameters<typeof conTenant>[1]>[0];

export interface BecaResumen {
  id: string;
  alumno: string;
  alumnoId: string;
  tipo: string;
  /// Cadena, nunca number: un porcentaje con dos decimales convertido a `number`
  /// para viajar por JSON deja de ser exacto igual que un importe (§43).
  valor: string;
  /// Null = aplica a todos los conceptos.
  concepto: { id: string; nombre: string } | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  motivo: string;
  esObligacionLegal: boolean;
  activa: boolean;
  /// Si HOY esta surtiendo efecto. Se deriva de la vigencia y de `activa`: la
  /// pantalla no deberia tener que comparar fechas para saberlo, y que lo haga
  /// cada cliente por su cuenta es como dos superficies acaban discrepando.
  vigenteHoy: boolean;
}

export interface AlumnoParaBeca {
  id: string;
  nombre: string;
  cohorte: string | null;
}

/**
 * Becas y convenios (AZ-M4.3a).
 *
 * QUE HACE ESTE SERVICIO QUE NO SE VE: guarda la PRUEBA de por que se beco.
 * La beca del 5 % de la matricula es obligacion legal (Ley General de Educacion
 * art. 149-III, Ley General de Educacion Superior art. 70). Una autoridad puede
 * pedir a quien se le otorgo y con que criterio, y un descuento sin motivo no es
 * prueba de nada.
 */
@Injectable()
export class ServicioBecas {
  private exigirRol(sesion: Sesion): void {
    if (!sesion.roles.some((r) => ROLES_COBRANZA.includes(r))) {
      throw new ForbiddenException('Esta sección es para administración y cobranza.');
    }
  }

  private async hoyEscolar(tx: Transaccion): Promise<string> {
    const config = await tx.configuracionEscuela.findFirst();
    return fechaEscolar(new Date(), config?.zonaHoraria ?? 'America/Mexico_City');
  }

  /** Los alumnos activos, para poder elegir a quien se beca. */
  async alumnos(sesion: Sesion): Promise<AlumnoParaBeca[]> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const alumnos = await tx.alumno.findMany({
        where: { activo: true },
        include: {
          inscripciones: {
            where: { estado: 'ACTIVA' },
            include: { cohorte: { select: { nombre: true } } },
            take: 1,
          },
        },
        orderBy: [{ apellidos: 'asc' }, { nombre: 'asc' }],
      });

      return alumnos.map((a) => ({
        id: a.id,
        nombre: `${a.apellidos}, ${a.nombre}`,
        cohorte: a.inscripciones[0]?.cohorte.nombre ?? null,
      }));
    });
  }

  async listar(sesion: Sesion): Promise<BecaResumen[]> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const hoy = await this.hoyEscolar(tx);
      const becas = await tx.beca.findMany({
        include: {
          alumno: { select: { nombre: true, apellidos: true } },
          concepto: { select: { id: true, nombre: true } },
        },
        // Las vigentes primero: es lo que alguien viene a revisar.
        orderBy: [{ activa: 'desc' }, { creadaEn: 'desc' }],
      });

      return becas.map((b) => {
        const vigenteDesde = b.vigenteDesde.toISOString().slice(0, 10);
        const vigenteHasta = b.vigenteHasta?.toISOString().slice(0, 10) ?? null;
        return {
          id: b.id,
          alumnoId: b.alumnoId,
          alumno: `${b.alumno.apellidos}, ${b.alumno.nombre}`,
          tipo: b.tipo,
          valor: b.valor.toFixed(2),
          concepto: b.concepto ? { id: b.concepto.id, nombre: b.concepto.nombre } : null,
          vigenteDesde,
          vigenteHasta,
          motivo: b.motivo,
          esObligacionLegal: b.esObligacionLegal,
          activa: b.activa,
          vigenteHoy: b.activa && estaVigente({ vigenteDesde, vigenteHasta }, hoy),
        };
      });
    });
  }

  async otorgar(
    sesion: Sesion,
    entrada: {
      alumnoId: string;
      tipo: 'PORCENTAJE' | 'MONTO_FIJO';
      valor: string;
      conceptoId?: string;
      vigenteDesde: string;
      vigenteHasta?: string;
      motivo: string;
      esObligacionLegal?: boolean;
    },
  ): Promise<BecaResumen> {
    this.exigirRol(sesion);

    // El porcentaje se valida ANTES de tocar la base. Una beca del 120 % es la
    // escuela pagandole al alumno por venir, y para cuando se generan los
    // cargos ya hay cuatrocientas familias con el importe equivocado.
    if (entrada.tipo === 'PORCENTAJE') validarPorcentaje(Number(entrada.valor));

    if (entrada.vigenteHasta && entrada.vigenteHasta < entrada.vigenteDesde) {
      // Una vigencia que termina antes de empezar no aplica NUNCA, y el fallo
      // es silencioso: el alumno simplemente no recibe su beca y nadie sabe por
      // que. La base tambien lo rechaza; aqui se dice con palabras.
      throw new BadRequestException(
        'La beca no puede terminar antes de empezar. Revisa las fechas de vigencia.',
      );
    }

    return conTenant(sesion.tenantId, async (tx) => {
      const alumno = await tx.alumno.findUnique({ where: { id: entrada.alumnoId } });
      if (!alumno) throw new NotFoundException('No encontramos a esa alumna o alumno.');

      if (entrada.conceptoId) {
        const concepto = await tx.conceptoCargo.findUnique({ where: { id: entrada.conceptoId } });
        if (!concepto) throw new NotFoundException('No encontramos ese concepto.');
      }

      const creada = await tx.beca.create({
        data: {
          tenantId: sesion.tenantId,
          alumnoId: entrada.alumnoId,
          tipo: entrada.tipo,
          valor: entrada.valor,
          conceptoId: entrada.conceptoId ?? null,
          vigenteDesde: new Date(`${entrada.vigenteDesde}T00:00:00.000Z`),
          vigenteHasta: entrada.vigenteHasta
            ? new Date(`${entrada.vigenteHasta}T00:00:00.000Z`)
            : null,
          motivo: entrada.motivo,
          esObligacionLegal: entrada.esObligacionLegal ?? false,
          otorgadaPor: sesion.usuarioId,
        },
        include: {
          alumno: { select: { nombre: true, apellidos: true } },
          concepto: { select: { id: true, nombre: true } },
        },
      });

      await tx.eventoAuditoria.create({
        data: {
          tenantId: sesion.tenantId,
          actorId: sesion.usuarioId,
          tipo: 'cobranza.beca_otorgada',
          entidad: 'beca',
          entidadId: creada.id,
          datos: {
            alumnoId: entrada.alumnoId,
            tipo: entrada.tipo,
            valor: entrada.valor,
            motivo: entrada.motivo,
            esObligacionLegal: entrada.esObligacionLegal ?? false,
          },
        },
      });

      const hoy = await this.hoyEscolar(tx);
      const vigenteDesde = creada.vigenteDesde.toISOString().slice(0, 10);
      const vigenteHasta = creada.vigenteHasta?.toISOString().slice(0, 10) ?? null;

      return {
        id: creada.id,
        alumnoId: creada.alumnoId,
        alumno: `${creada.alumno.apellidos}, ${creada.alumno.nombre}`,
        tipo: creada.tipo,
        valor: creada.valor.toFixed(2),
        concepto: creada.concepto
          ? { id: creada.concepto.id, nombre: creada.concepto.nombre }
          : null,
        vigenteDesde,
        vigenteHasta,
        motivo: creada.motivo,
        esObligacionLegal: creada.esObligacionLegal,
        activa: creada.activa,
        vigenteHoy: estaVigente({ vigenteDesde, vigenteHasta }, hoy),
      };
    });
  }

  /**
   * Retirar una beca.
   *
   * NO SE BORRA LA FILA. Una beca que desaparece de la historia deja cargos
   * pasados con un descuento que ya nadie puede explicar — y si esa beca era la
   * del 5 % legal, borra tambien la prueba del cumplimiento. Se desactiva, y
   * los cargos ya emitidos conservan su descuento: el reparto esta congelado
   * (ADR-011) y reescribirlo cambiaria lo que a la familia ya se le comunico.
   */
  async retirar(sesion: Sesion, id: string, motivo: string): Promise<{ id: string; activa: boolean }> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const beca = await tx.beca.findUnique({ where: { id } });
      if (!beca) throw new NotFoundException('No encontramos esa beca.');

      const actualizada = await tx.beca.update({ where: { id }, data: { activa: false } });

      await tx.eventoAuditoria.create({
        data: {
          tenantId: sesion.tenantId,
          actorId: sesion.usuarioId,
          tipo: 'cobranza.beca_retirada',
          entidad: 'beca',
          entidadId: id,
          datos: { motivo, alumnoId: beca.alumnoId, valor: beca.valor.toFixed(2) },
        },
      });

      return { id: actualizada.id, activa: actualizada.activa };
    });
  }
}
