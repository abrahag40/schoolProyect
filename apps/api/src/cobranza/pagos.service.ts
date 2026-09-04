import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { conTenant } from '@azahar/db';
import type { Sesion } from '../comun/sesion.js';
import { aCentavos, aMonto } from './reglas.js';
import { fechaEscolar } from '../comun/fecha-escolar.js';
import {
  aplicarPagoConProntoPago,
  puedeDevolverse,
  recargoAplicable,
  saldoDeParte,
  situacionLegal,
  type CargoParaMora,
  type ParteConProntoPago,
  type SituacionLegal,
} from './saldos.js';
import { aplicaAcuerdoProfeco, avisosFiscales, type Vertical } from './marco-legal.js';

const ROLES_COBRANZA = ['DUENO', 'DIRECTOR', 'ADMIN', 'COBRANZA'];

type Transaccion = Parameters<Parameters<typeof conTenant>[1]>[0];

// ---------------------------------------------------------------------------
// Contratos de salida (§31): se declara que sale, para que una columna nueva
// no se filtre sola al cliente.
// ---------------------------------------------------------------------------

export interface ResultadoPago {
  pagoId: string;
  /// Lo que se alcanzo a aplicar contra deuda vencida o por vencer.
  aplicado: string;
  /// Lo que quedo a favor de la familia por pagar de mas o por adelantado.
  saldoAFavor: string;
  /// Lo que la escuela condono por pagar antes de tiempo (AZ-M4.3b). Cero casi
  /// siempre; se reporta porque es dinero que la escuela decidio no cobrar y
  /// quien esta en caja tiene que poder decirselo a la familia.
  descuentoProntoPago: string;
  /// Que se saldo, en orden. La escuela necesita poder decirle al padre
  /// exactamente que cubrio su transferencia.
  aplicaciones: Array<{ concepto: string; periodo: string; monto: string }>;
}

export interface CargoEnEstadoDeCuenta {
  concepto: string;
  periodo: string;
  /// Importe total del cargo, de todos los pagadores.
  total: string;
  /// Lo que le toca a QUIEN pregunta. Con padres separados, cada uno ve lo
  /// suyo: mostrarle el total a quien paga el 40% invita a pagar de mas.
  miParte: string;
  miSaldo: string;
  vence: string;
  /// Hasta cuando se acepta sin recargo (Art. 4). Se muestra, no se deduce.
  sinRecargoHasta: string;
  /// Recargo calculado a hoy sobre MI saldo. Cero mientras no pase la fecha.
  recargoHoy: string;
  vencido: boolean;
  /// Por que este cargo no cuesta su precio de lista: prorrateo, becas y
  /// descuentos, cada uno con su nombre y su importe.
  descuentos: Array<{ concepto: string; monto: string }>;
}

export interface EstadoDeCuenta {
  alumno: string;
  /// El "hoy" de la escuela, en su zona horaria.
  hoy: string;
  cargos: CargoEnEstadoDeCuenta[];
  /// La cifra que el padre viene a ver. Sin competencia visual en la pantalla.
  totalAPagar: string;
  recargoTotal: string;
  saldoAFavor: string;
  /// Si ese saldo a favor se puede pedir de vuelta hoy, y por que no cuando no
  /// se puede. La familia tiene derecho a saberlo sin ir a preguntar.
  devolucionDeSaldo: { permitido: boolean; motivo: string };
  /// Lo que conviene saber ANTES de pagar (AZ-M4.5b). Hoy es uno solo: el
  /// efectivo mata la deducibilidad.
  avisos: string[];
}

export interface FamiliaMorosa {
  alumnoId: string;
  alumno: string;
  /// Con su identificador, no solo el nombre: es lo que permite que la pantalla
  /// cierre el ciclo —ver quien debe y registrar ahi mismo el pago— sin obligar
  /// a caja a buscar a la persona en otra seccion.
  pagadores: Array<{ tutorId: string; nombre: string }>;
  saldo: string;
  /// Dias desde el vencimiento mas antiguo sin pagar.
  diasDeAtraso: number;
  situacion: SituacionLegal;
}

export interface Morosidad {
  hoy: string;
  /// Los tres numeros que el director mira primero (wireframe D10, pantalla 5).
  cobrado: string;
  porCobrar: string;
  vencido: string;
  familias: FamiliaMorosa[];
}

@Injectable()
export class ServicioPagos {
  private exigirRolCobranza(sesion: Sesion): void {
    if (!sesion.roles.some((r) => ROLES_COBRANZA.includes(r))) {
      throw new ForbiddenException('Esta sección es para administración y cobranza.');
    }
  }

  private async hoyEscolar(tx: Transaccion): Promise<string> {
    const config = await tx.configuracionEscuela.findFirst();
    return fechaEscolar(new Date(), config?.zonaHoraria ?? 'America/Mexico_City');
  }

  private async recargoPorcentaje(tx: Transaccion): Promise<number> {
    const config = await tx.configuracionEscuela.findFirst();
    return Number(config?.recargoPorcentaje ?? 0);
  }

  /** Que ley obliga a este tenant (§51). Ante la ausencia del dato, la que protege. */
  private async verticalDe(tx: Transaccion): Promise<Vertical> {
    const tenant = await tx.tenant.findFirst({ select: { vertical: true } });
    return tenant?.vertical ?? 'COLEGIO';
  }

  /**
   * Partes abiertas de un tutor, con su saldo YA derivado.
   *
   * Se excluyen los cargos cancelados: un cargo anulado no se cobra, y aplicarle
   * un pago dejaria dinero atrapado contra una deuda que no existe.
   */
  private async partesAbiertasDe(tx: Transaccion, tutorId: string): Promise<ParteConProntoPago[]> {
    const partes = await tx.parteDeCargo.findMany({
      where: { tutorId, cargo: { estado: { not: 'CANCELADO' } } },
      include: { cargo: true, aplicaciones: true, descuentos: true },
    });

    return partes.map((p) => {
      // El saldo descuenta lo pagado Y lo condonado a esta parte. Un pronto
      // pago ya aplicado no puede volver a pedirse en dinero.
      const aplicado = p.aplicaciones.reduce((a, x) => a + aCentavos(x.monto.toFixed(2)), 0);
      const condonado = p.descuentos.reduce((a, x) => a + aCentavos(x.monto.toFixed(2)), 0);
      const prontoPago =
        p.cargo.fechaLimiteProntoPago !== null && p.cargo.descuentoProntoPagoPorcentaje !== null
          ? {
              hasta: p.cargo.fechaLimiteProntoPago.toISOString().slice(0, 10),
              porcentaje: Number(p.cargo.descuentoProntoPagoPorcentaje),
            }
          : null;

      return {
        referencia: p.id,
        vence: p.cargo.fechaVencimiento.toISOString().slice(0, 10),
        saldoCentavos: saldoDeParte(aCentavos(p.monto.toFixed(2)), aplicado + condonado),
        prontoPago,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Registro de pagos (AZ-M4.9)
  // -------------------------------------------------------------------------

  /**
   * Registra un pago recibido y lo aplica a la deuda del tutor.
   *
   * EL PAGO ES UN ASIENTO: el cargo no cambia de importe. Se guarda lo que
   * entro y contra que se aplico, y el saldo se deriva. Lo contrario destruiria
   * la prueba de que se cobro lo que se anuncio.
   *
   * La aplicacion es automatica y va de lo mas viejo a lo mas nuevo, porque los
   * meses vencidos —no los pesos— son lo que cuenta el Articulo 7 para decidir
   * si la escuela puede suspender el servicio.
   */
  async registrar(
    sesion: Sesion,
    entrada: {
      tutorId: string;
      monto: string;
      fecha: string;
      metodo: 'EFECTIVO' | 'TRANSFERENCIA' | 'DEPOSITO' | 'TARJETA' | 'OTRO';
      referencia?: string;
      nota?: string;
    },
  ): Promise<ResultadoPago> {
    this.exigirRolCobranza(sesion);

    const montoCentavos = aCentavos(entrada.monto);
    if (montoCentavos <= 0) {
      throw new BadRequestException('El importe del pago debe ser mayor a cero.');
    }

    return conTenant(sesion.tenantId, async (tx) => {
      const hoy = await this.hoyEscolar(tx);
      if (entrada.fecha > hoy) {
        throw new BadRequestException('No se puede registrar un pago con fecha futura.');
      }

      const tutor = await tx.tutor.findUnique({ where: { id: entrada.tutorId } });
      if (!tutor) throw new NotFoundException('No encontramos a esa persona.');

      const abiertas = await this.partesAbiertasDe(tx, entrada.tutorId);
      // El pronto pago se calcula ANTES de repartir, porque cambia cuanto
      // dinero hace falta para saldar cada parte (AZ-M4.3b).
      const { aplicaciones, sobranteCentavos, descuentoTotalCentavos } = aplicarPagoConProntoPago(
        montoCentavos,
        abiertas,
        entrada.fecha,
      );

      const pago = await tx.pago.create({
        data: {
          tenantId: sesion.tenantId,
          tutorId: entrada.tutorId,
          monto: entrada.monto,
          fecha: new Date(`${entrada.fecha}T00:00:00.000Z`),
          metodo: entrada.metodo,
          referencia: entrada.referencia ?? null,
          nota: entrada.nota ?? null,
          registradoPor: sesion.usuarioId,
        },
      });

      // Lo condonado por pronto pago queda como asiento atado a la PARTE, no al
      // cargo entero: el reparto ya estaba congelado y solo se salda la parte
      // de quien pago temprano.
      const conDescuento = aplicaciones.filter((a) => a.descuentoCentavos > 0);
      if (conDescuento.length > 0) {
        const partes = await tx.parteDeCargo.findMany({
          where: { id: { in: conDescuento.map((a) => a.referencia) } },
          select: { id: true, cargoId: true },
        });
        await tx.descuentoDeCargo.createMany({
          data: conDescuento.map((a) => ({
            tenantId: sesion.tenantId,
            cargoId: partes.find((p) => p.id === a.referencia)!.cargoId,
            parteDeCargoId: a.referencia,
            categoria: 'DESCUENTO' as const,
            concepto: 'Descuento por pronto pago',
            monto: aMonto(a.descuentoCentavos),
          })),
        });
      }

      if (aplicaciones.length > 0) {
        await tx.aplicacionDePago.createMany({
          data: aplicaciones.map((a) => ({
            tenantId: sesion.tenantId,
            pagoId: pago.id,
            parteDeCargoId: a.referencia,
            monto: aMonto(a.centavos),
          })),
        });
      }

      // Para poder decirle al padre QUE cubrio su transferencia.
      const detalle = await tx.parteDeCargo.findMany({
        where: { id: { in: aplicaciones.map((a) => a.referencia) } },
        include: { cargo: { include: { concepto: { select: { nombre: true } } } } },
      });

      await tx.eventoAuditoria.create({
        data: {
          tenantId: sesion.tenantId,
          actorId: sesion.usuarioId,
          tipo: 'cobranza.pago_registrado',
          entidad: 'pago',
          entidadId: pago.id,
          datos: {
            tutorId: entrada.tutorId,
            monto: entrada.monto,
            metodo: entrada.metodo,
            aplicado: aMonto(montoCentavos - sobranteCentavos),
            prontoPago: aMonto(descuentoTotalCentavos),
            partes: aplicaciones.length,
          },
        },
      });

      return {
        pagoId: pago.id,
        aplicado: aMonto(montoCentavos - sobranteCentavos),
        saldoAFavor: aMonto(sobranteCentavos),
        descuentoProntoPago: aMonto(descuentoTotalCentavos),
        aplicaciones: aplicaciones.map((a) => {
          const parte = detalle.find((d) => d.id === a.referencia);
          return {
            concepto: parte?.cargo.concepto.nombre ?? '(concepto)',
            periodo: parte?.cargo.periodo ?? '',
            monto: aMonto(a.centavos),
          };
        }),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Estado de cuenta de la familia (AZ-M4.5)
  // -------------------------------------------------------------------------

  /**
   * Lo que ESTE tutor debe por ESTE alumno.
   *
   * Criterio de aceptacion del Plan Maestro, literal: "un padre sin contexto
   * responde que debe y por que en menos de 30 segundos". De ahi que la
   * respuesta traiga el desglose y no solo el total, y que el importe que
   * encabeza sea el de SU parte: mostrarle el total al padre que paga el 40%
   * es invitarlo a pagar de mas.
   */
  async estadoDeCuenta(sesion: Sesion, alumnoId: string): Promise<EstadoDeCuenta> {
    if (!sesion.roles.includes('TUTOR')) {
      throw new ForbiddenException('Esta sección es para madres, padres y tutores.');
    }

    return conTenant(sesion.tenantId, async (tx) => {
      const tutor = await tx.tutor.findFirst({ where: { usuarioId: sesion.usuarioId } });
      if (!tutor) throw new ForbiddenException('Tu cuenta no está vinculada a una ficha de tutor.');

      // El vinculo se comprueba SIEMPRE: tener el id de un alumno no da derecho
      // a ver su estado de cuenta. RLS no separa a dos familias de la misma
      // escuela — eso lo hace este WHERE.
      const vinculo = await tx.tutorAlumno.findFirst({
        where: { tutorId: tutor.id, alumnoId },
        include: { alumno: { select: { nombre: true, apellidos: true } } },
      });
      if (!vinculo) throw new NotFoundException('No encontramos a esa alumna o alumno.');

      const hoy = await this.hoyEscolar(tx);
      const porcentaje = await this.recargoPorcentaje(tx);

      const cargos = await tx.cargo.findMany({
        where: { alumnoId, estado: { not: 'CANCELADO' } },
        include: {
          concepto: { select: { nombre: true, deducibleIedu: true, esColegiatura: true } },
          partes: { include: { aplicaciones: true, descuentos: true } },
          descuentos: true,
        },
        orderBy: [{ periodo: 'asc' }, { fechaVencimiento: 'asc' }],
      });

      let totalCentavos = 0;
      let recargoCentavos = 0;
      const paraDevolucion: CargoParaMora[] = [];

      const detalle: CargoEnEstadoDeCuenta[] = cargos.map((c) => {
        const mia = c.partes.find((p) => p.tutorId === tutor.id);
        const miImporte = mia ? aCentavos(mia.monto.toFixed(2)) : 0;
        const miAplicado = mia
          ? mia.aplicaciones.reduce((a, x) => a + aCentavos(x.monto.toFixed(2)), 0)
          : 0;
        const miCondonado = mia
          ? mia.descuentos.reduce((a, x) => a + aCentavos(x.monto.toFixed(2)), 0)
          : 0;
        const miSaldo = saldoDeParte(miImporte, miAplicado + miCondonado);

        const limite = c.fechaLimiteSinRecargo.toISOString().slice(0, 10);
        const recargo = recargoAplicable({
          saldoCentavos: miSaldo,
          fechaLimiteSinRecargo: limite,
          hoy,
          porcentaje,
        });

        totalCentavos += miSaldo;
        recargoCentavos += recargo;
        paraDevolucion.push({
          periodo: c.periodo,
          saldoCentavos: miSaldo,
          fechaLimiteSinRecargo: limite,
          esColegiatura: c.concepto.esColegiatura,
        });

        return {
          concepto: c.concepto.nombre,
          periodo: c.periodo,
          total: c.monto.toFixed(2),
          miParte: aMonto(miImporte),
          miSaldo: aMonto(miSaldo),
          vence: c.fechaVencimiento.toISOString().slice(0, 10),
          sinRecargoHasta: limite,
          recargoHoy: aMonto(recargo),
          vencido: miSaldo > 0 && hoy > limite,
          // El desglose de por que se cobra lo que se cobra. Sin el, un cargo
          // de 1,138.50 sobre una colegiatura de 2,450 obliga a la familia a
          // llamar para entenderlo.
          descuentos: [
            ...c.descuentos.map((d) => ({ concepto: d.concepto, monto: d.monto.toFixed(2) })),
            ...(mia?.descuentos ?? []).map((d) => ({
              concepto: d.concepto,
              monto: d.monto.toFixed(2),
            })),
          ],
        };
      });

      // Saldo a favor: lo que este tutor pago y no alcanzo a aplicarse.
      const pagos = await tx.pago.findMany({
        where: { tutorId: tutor.id, canceladoEn: null },
        include: { aplicaciones: true },
      });
      const aFavor = pagos.reduce((acumulado, p) => {
        const aplicado = p.aplicaciones.reduce((a, x) => a + aCentavos(x.monto.toFixed(2)), 0);
        return acumulado + (aCentavos(p.monto.toFixed(2)) - aplicado);
      }, 0);

      return {
        alumno: `${vinculo.alumno.nombre} ${vinculo.alumno.apellidos}`,
        hoy,
        // Solo lo que aun debe: una lista con veinte renglones saldados
        // esconde los tres que importan.
        cargos: detalle.filter((c) => c.miSaldo !== '0.00'),
        totalAPagar: aMonto(totalCentavos),
        recargoTotal: aMonto(recargoCentavos),
        saldoAFavor: aMonto(aFavor),
        devolucionDeSaldo: puedeDevolverse(aFavor, paraDevolucion, hoy),
        // El aviso se calcula sobre lo que esta familia debe de verdad: si
        // ninguno de sus cargos es deducible, decirle como pagar para deducir
        // seria ruido.
        avisos: avisosFiscales({
          hayConceptosDeducibles: cargos.some(
            (c) => c.concepto.deducibleIedu && c.partes.some((p) => p.tutorId === tutor.id),
          ),
        }),
      };
    });
  }

  // -------------------------------------------------------------------------
  // Panel de morosidad (AZ-M4.8)
  // -------------------------------------------------------------------------

  /**
   * Quien debe, desde cuando y cuanto — con la lectura legal ya hecha.
   *
   * La escuela no deberia tener que recordar el Articulo 7: el panel le dice si
   * la ley ya le permite suspender el servicio y bajo que condiciones. Contar
   * MESES y no cargos es lo que hace correcta esa lectura.
   */
  async morosidad(sesion: Sesion): Promise<Morosidad> {
    this.exigirRolCobranza(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const hoy = await this.hoyEscolar(tx);
      // Si a esta institucion la alcanza el Acuerdo (§51). Sin esto el panel le
      // decia a una universidad que "la ley permite suspender a partir de 3",
      // que es una ley que no la obliga.
      const aplicaElAcuerdo = aplicaAcuerdoProfeco(await this.verticalDe(tx));

      const cargos = await tx.cargo.findMany({
        where: { estado: { not: 'CANCELADO' } },
        include: {
          alumno: { select: { id: true, nombre: true, apellidos: true } },
          concepto: { select: { esColegiatura: true } },
          // Los descuentos NO son opcionales aqui: sin ellos el panel cobra el
          // precio de lista. Ver el bloque de abajo.
          descuentos: { select: { monto: true, parteDeCargoId: true } },
          partes: {
            include: {
              tutor: { select: { id: true, nombre: true, apellidos: true } },
              aplicaciones: true,
            },
          },
        },
      });

      let cobrado = 0;
      let porCobrar = 0;
      let vencido = 0;

      const porAlumno = new Map<
        string,
        {
          alumno: string;
          pagadores: Map<string, string>;
          saldo: number;
          masViejo: string | null;
          cargos: CargoParaMora[];
        }
      >();

      for (const c of cargos) {
        const limite = c.fechaLimiteSinRecargo.toISOString().slice(0, 10);
        // ---------------------------------------------------------------
        // EL SALDO SE DERIVA DEL PRECIO NETO, NO DEL DE LISTA (§47).
        //
        // DEFECTO REAL, visto en staging el 4-sep-2026: un alumno con alta a
        // mitad de mes tenia $1,540 de prorrateo. Su estado de cuenta —la
        // pantalla de la FAMILIA— lo restaba bien y pedia $6,660. Este panel
        // —el de la ESCUELA— seguia diciendo $8,200, porque sumaba
        // `cargo.monto`, que por diseno guarda el PRECIO DE LISTA (§43): los
        // descuentos viven como asientos aparte para poder explicarlos.
        //
        // Las dos pantallas hablaban del mismo dinero y no coincidian, y la
        // que se equivocaba era la que le dice a la escuela a quien cobrarle.
        //
        // Se restan las dos familias de descuento, que no son lo mismo:
        //   · sin parte  -> EMISION (prorrateo, beca): bajaron la base antes
        //                   de repartir, asi que reducen lo que se debe.
        //   · con parte  -> PRONTO PAGO: nacen despues del reparto y saldan la
        //                   parte de ese pagador; cuentan como cobrado, no como
        //                   menor precio. Por eso van con `aplicado` y no aqui.
        // ---------------------------------------------------------------
        const deEmision = c.descuentos
          .filter((d) => d.parteDeCargoId === null)
          .reduce((a, d) => a + aCentavos(d.monto.toFixed(2)), 0);
        const condonadoAPartes = c.descuentos
          .filter((d) => d.parteDeCargoId !== null)
          .reduce((a, d) => a + aCentavos(d.monto.toFixed(2)), 0);

        const importe = aCentavos(c.monto.toFixed(2)) - deEmision;
        const aplicado =
          c.partes.reduce(
            (a, p) => a + p.aplicaciones.reduce((b, x) => b + aCentavos(x.monto.toFixed(2)), 0),
            0,
          ) + condonadoAPartes;
        const saldo = saldoDeParte(importe, aplicado);

        cobrado += aplicado;
        porCobrar += saldo;
        if (saldo > 0 && hoy > limite) vencido += saldo;

        const fila = porAlumno.get(c.alumno.id) ?? {
          alumno: `${c.alumno.apellidos}, ${c.alumno.nombre}`,
          pagadores: new Map<string, string>(),
          saldo: 0,
          masViejo: null,
          cargos: [],
        };
        fila.saldo += saldo;
        fila.cargos.push({
          periodo: c.periodo,
          saldoCentavos: saldo,
          fechaLimiteSinRecargo: limite,
          esColegiatura: c.concepto.esColegiatura,
        });
        for (const p of c.partes) {
          fila.pagadores.set(p.tutor.id, `${p.tutor.nombre} ${p.tutor.apellidos}`);
        }
        if (saldo > 0 && hoy > limite && (fila.masViejo === null || limite < fila.masViejo)) {
          fila.masViejo = limite;
        }
        porAlumno.set(c.alumno.id, fila);
      }

      const familias: FamiliaMorosa[] = [...porAlumno.entries()]
        .filter(([, f]) => f.saldo > 0)
        .map(([alumnoId, f]) => ({
          alumnoId,
          alumno: f.alumno,
          pagadores: [...f.pagadores.entries()]
            .map(([tutorId, nombre]) => ({ tutorId, nombre }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
          saldo: aMonto(f.saldo),
          diasDeAtraso: f.masViejo
            ? Math.floor(
                (Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${f.masViejo}T00:00:00Z`)) /
                  86_400_000,
              )
            : 0,
          situacion: situacionLegal(f.cargos, hoy, aplicaElAcuerdo),
        }))
        // Lo mas urgente primero: mas dias de atraso, y a igualdad, mas dinero.
        .sort((a, b) => b.diasDeAtraso - a.diasDeAtraso || aCentavos(b.saldo) - aCentavos(a.saldo));

      return {
        hoy,
        cobrado: aMonto(cobrado),
        porCobrar: aMonto(porCobrar),
        vencido: aMonto(vencido),
        familias,
      };
    });
  }
}
