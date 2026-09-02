import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { conTenant } from '@azahar/db';
import type { Sesion } from '../comun/sesion.js';
import {
  aCentavos,
  aMonto,
  anticipacionDeAjuste,
  claveDeCargo,
  esPeriodoValido,
  fechaLimiteSinRecargo,
  fechaDelPeriodo,
  repartir,
  RepartoInvalidoError,
} from './reglas.js';
import { diasDeAvisoExigidos, pisoDeGracia, type Vertical } from './marco-legal.js';
import { aplicarSaldoAFavorPendiente } from './saldo-a-favor.js';
import {
  esPeriodoValido as esClaveDePeriodoValida,
  mesesDelPeriodo,
  periodoDeFecha,
  primerMes,
} from './periodos.js';
import {
  becasAplicables,
  calcularDescuentos,
  descuentoPorProrrateo,
  proporcionDelPeriodo,
  type DescuentoAplicable,
} from './descuentos.js';

/**
 * Quien administra el dinero de la escuela.
 *
 * COBRANZA entra aqui y DOCENTE no: un maestro pasa lista, no define cuanto
 * cuesta la colegiatura. Deny-by-default tambien en el dinero.
 */
const ROLES_COBRANZA = ['DUENO', 'DIRECTOR', 'ADMIN', 'COBRANZA'];

/**
 * Niveles del complemento IEDU del SAT. Se repiten aqui como tipo —y no se
 * importan del cliente generado— para que el contrato de entrada del servicio
 * no dependa de que Prisma ya haya generado sus tipos.
 */
type NivelEducativo =
  'PREESCOLAR' | 'PRIMARIA' | 'SECUNDARIA' | 'PROFESIONAL_TECNICO' | 'BACHILLERATO';

type Transaccion = Parameters<Parameters<typeof conTenant>[1]>[0];

export interface ConceptoResumen {
  id: string;
  clave: string;
  nombre: string;
  periodicidad: string;
  monto: string;
  diaVencimiento: number;
  alcance: { cohorteId: string; nombre: string } | null;
  deducibleIedu: boolean;
  nivelEducativo: string | null;
  /// Si cuenta para el umbral del Articulo 7 (§52). Viaja al cliente porque la
  /// administracion tiene que poder verlo y corregirlo, no adivinarlo.
  esColegiatura: boolean;
  /// Si puede saldarse con el dinero que la familia ya tiene a favor.
  aceptaSaldoAFavor: boolean;
  /// OBLIGATORIA o VOLUNTARIA. Una voluntaria solo se le cobra a quien la
  /// acepto (Acuerdo DOF 10-mar-1992, arts. 3 y 5-III).
  obligatoriedad: string;
  vigenteDesde: string;
  activo: boolean;
}

export interface ParteResumen {
  tutor: string;
  porcentaje: string;
  monto: string;
}

export interface CargoResumen {
  id: string;
  alumno: string;
  concepto: string;
  monto: string;
  vence: string;
  /// Hasta cuando NO se puede cobrar recargo (Art. 4). Viaja al cliente a
  /// proposito: la administracion debe VERLO, no deducirlo.
  sinRecargoHasta: string;
  estado: string;
  partes: ParteResumen[];
}

export interface ProblemaDeGeneracion {
  alumno: string;
  concepto: string;
  motivo: string;
}

export interface ResultadoGeneracion {
  periodo: string;
  /// Cargos creados en ESTA corrida. Cero al repetirla: es la prueba visible de
  /// que la idempotencia funciona (§15).
  generados: number;
  /// Ya existian. Volver a correr no los toca.
  omitidos: number;
  importeTotal: string;
  /// Alumnos cuyo cargo se creo pero no se pudo repartir. No se ocultan: un
  /// cargo sin pagador es un dato incompleto que alguien tiene que arreglar.
  problemas: ProblemaDeGeneracion[];
  /// Cuanto saldo a favor se consumio con los cargos recien generados. La
  /// administracion tiene que verlo: es dinero que ya estaba en la caja y que
  /// acaba de dejar de estar disponible para otra cosa (AZ-M4.10).
  saldoAFavorAplicado: string;
  familiasConSaldoAplicado: number;
  /// Cuanto se dejo de cobrar por becas en esta corrida. Es el numero que
  /// demuestra el cumplimiento del 5% que exige la ley (LGE 149-III), y por eso
  /// se reporta en vez de quedarse en la diferencia entre dos totales.
  becado: string;
}

@Injectable()
export class ServicioCobranza {
  private readonly log = new Logger('Cobranza');

  private exigirRol(sesion: Sesion): void {
    if (!sesion.roles.some((r) => ROLES_COBRANZA.includes(r))) {
      throw new ForbiddenException('Esta sección es para administración y cobranza.');
    }
  }

  private async parametros(tx: Transaccion) {
    const fila = await tx.configuracionEscuela.findFirst();
    return {
      diaVencimientoPorOmision: fila?.diaVencimientoPorOmision ?? 5,
      diasGraciaSinRecargo: fila?.diasGraciaSinRecargo ?? 10,
      zonaHoraria: fila?.zonaHoraria ?? 'America/Mexico_City',
    };
  }

  /**
   * El vertical del tenant, que es lo que decide QUE ley lo obliga (§51).
   *
   * Ante la ausencia del dato se asume COLEGIO, que es el caso cubierto por el
   * Acuerdo: si algo va a fallar, que falle del lado que protege a la familia.
   */
  private async verticalDe(tx: Transaccion): Promise<Vertical> {
    const tenant = await tx.tenant.findFirst({ select: { vertical: true } });
    return tenant?.vertical ?? 'COLEGIO';
  }

  // -------------------------------------------------------------------------
  // Catalogo (AZ-M4.1)
  // -------------------------------------------------------------------------

  async listarConceptos(sesion: Sesion): Promise<ConceptoResumen[]> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const conceptos = await tx.conceptoCargo.findMany({
        include: { cohorte: { select: { id: true, nombre: true } } },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });

      return conceptos.map((c) => ({
        id: c.id,
        clave: c.clave,
        nombre: c.nombre,
        periodicidad: c.periodicidad,
        // El dinero sale como cadena, jamas como numero de punto flotante: en
        // cuanto un importe se convierte a `number` para viajar por JSON, deja
        // de ser exacto (§4).
        monto: c.montoBase.toFixed(2),
        diaVencimiento: c.diaVencimiento,
        alcance: c.cohorte ? { cohorteId: c.cohorte.id, nombre: c.cohorte.nombre } : null,
        deducibleIedu: c.deducibleIedu,
        nivelEducativo: c.nivelEducativo,
        esColegiatura: c.esColegiatura,
        aceptaSaldoAFavor: c.aceptaSaldoAFavor,
        obligatoriedad: c.obligatoriedad,
        vigenteDesde: c.vigenteDesde.toISOString().slice(0, 10),
        activo: c.activo,
      }));
    });
  }

  async crearConcepto(
    sesion: Sesion,
    entrada: {
      clave: string;
      nombre: string;
      periodicidad: 'MENSUAL' | 'UNICO' | 'ANUAL';
      monto: string;
      diaVencimiento?: number;
      cohorteId?: string;
      deducibleIedu?: boolean;
      nivelEducativo?: NivelEducativo;
      esColegiatura?: boolean;
      aceptaSaldoAFavor?: boolean;
      obligatoriedad?: 'OBLIGATORIA' | 'VOLUNTARIA';
      vigenteDesde: string;
      avisadoEn?: string;
    },
  ): Promise<ConceptoResumen> {
    this.exigirRol(sesion);

    // Un concepto deducible SIN nivel educativo produce un CFDI que el SAT
    // rechaza al timbrar. Se detiene aqui, no en R2 cuando ya haya cien
    // escuelas con el dato incompleto.
    if (entrada.deducibleIedu && !entrada.nivelEducativo) {
      throw new BadRequestException(
        'Un concepto deducible necesita nivel educativo: el complemento IEDU lo exige.',
      );
    }

    // El Articulo 7 cuenta colegiaturas "equivalentes a cuando menos tres
    // meses": un cobro de una sola vez —la inscripcion, una credencial— no
    // puede ser una de ellas. Marcarlo asi inflaria el contador de morosidad
    // con algo que la ley no cuenta, que es el defecto que este sprint corrige.
    // Una cuota voluntaria no puede ser colegiatura: la colegiatura ES la
    // contraprestacion del servicio educativo. Si fuera voluntaria no habria
    // nada que cobrar, y ademas entraria al contador del Articulo 7 — el
    // defecto que §52 acaba de cerrar.
    if (entrada.obligatoriedad === 'VOLUNTARIA' && entrada.esColegiatura) {
      throw new BadRequestException(
        'Una cuota voluntaria no puede ser colegiatura: la colegiatura es lo que se ' +
          'cobra por el servicio educativo.',
      );
    }

    if (entrada.esColegiatura && entrada.periodicidad === 'UNICO') {
      throw new BadRequestException(
        'Un cobro de una sola vez no es una colegiatura: el Artículo 7 cuenta meses. ' +
          'Quita la marca o cambia la periodicidad.',
      );
    }

    return conTenant(sesion.tenantId, async (tx) => {
      const { diaVencimientoPorOmision } = await this.parametros(tx);

      // Un concepto deducible necesita el RVOE **de su nivel** capturado: el
      // complemento IEDU lo exige y sin el, el CFDI se rechaza al timbrar
      // (AZ-A1). Se detiene aqui y no en el Release 2, cuando ya haya cien
      // escuelas con el dato incompleto y facturas que corregir cancelando.
      if (entrada.deducibleIedu && entrada.nivelEducativo) {
        const tieneRvoe = await tx.rvoe.findFirst({
          where: { nivelEducativo: entrada.nivelEducativo },
        });
        if (!tieneRvoe) {
          throw new BadRequestException(
            `No hay RVOE capturado para ${entrada.nivelEducativo}. El complemento IEDU lo ` +
              `exige, y sin él el SAT rechaza la factura. Regístralo en los datos de la escuela.`,
          );
        }
      }

      if (entrada.cohorteId) {
        const existe = await tx.cohorte.findUnique({ where: { id: entrada.cohorteId } });
        if (!existe) throw new NotFoundException('No encontramos ese grupo.');
      }

      const creado = await tx.conceptoCargo.create({
        data: {
          tenantId: sesion.tenantId,
          clave: entrada.clave,
          nombre: entrada.nombre,
          periodicidad: entrada.periodicidad,
          montoBase: entrada.monto,
          diaVencimiento: entrada.diaVencimiento ?? diaVencimientoPorOmision,
          cohorteId: entrada.cohorteId ?? null,
          deducibleIedu: entrada.deducibleIedu ?? false,
          nivelEducativo: entrada.nivelEducativo ?? null,
          esColegiatura: entrada.esColegiatura ?? false,
          aceptaSaldoAFavor: entrada.aceptaSaldoAFavor ?? true,
          obligatoriedad: entrada.obligatoriedad ?? 'OBLIGATORIA',
          vigenteDesde: new Date(`${entrada.vigenteDesde}T00:00:00.000Z`),
          avisadoEn: entrada.avisadoEn ? new Date(`${entrada.avisadoEn}T00:00:00.000Z`) : null,
        },
        include: { cohorte: { select: { id: true, nombre: true } } },
      });

      await tx.eventoAuditoria.create({
        data: {
          tenantId: sesion.tenantId,
          actorId: sesion.usuarioId,
          tipo: 'cobranza.concepto_creado',
          entidad: 'concepto_cargo',
          entidadId: creado.id,
          datos: { clave: creado.clave, monto: creado.montoBase.toFixed(2) },
        },
      });

      return {
        id: creado.id,
        clave: creado.clave,
        nombre: creado.nombre,
        periodicidad: creado.periodicidad,
        monto: creado.montoBase.toFixed(2),
        diaVencimiento: creado.diaVencimiento,
        alcance: creado.cohorte
          ? { cohorteId: creado.cohorte.id, nombre: creado.cohorte.nombre }
          : null,
        deducibleIedu: creado.deducibleIedu,
        nivelEducativo: creado.nivelEducativo,
        esColegiatura: creado.esColegiatura,
        aceptaSaldoAFavor: creado.aceptaSaldoAFavor,
        obligatoriedad: creado.obligatoriedad,
        vigenteDesde: creado.vigenteDesde.toISOString().slice(0, 10),
        activo: creado.activo,
      };
    });
  }

  /**
   * Cambiar el precio de un concepto (AZ-M4.4).
   *
   * ARTICULO 5, FRACCION I del Acuerdo de PROFECO: los ajustes de cuotas se
   * informan cuando menos 60 dias antes del periodo de reinscripcion. Por eso
   * subir un precio EXIGE decir desde cuando aplica y cuando se aviso — y si no
   * alcanzan los 60 dias, el sistema lo rechaza diciendo cuantos faltan.
   *
   * Se detiene aqui y no en una advertencia porque una advertencia se ignora, y
   * quien paga la multa es la escuela.
   *
   * A QUIEN SE LE EXIGE (§51): solo a los tenants que el Acuerdo alcanza. La
   * comprobacion se movio DENTRO de la transaccion en el Sprint 5 porque ahora
   * necesita saber el vertical, y eso es una lectura de la base.
   */
  async ajustarPrecio(
    sesion: Sesion,
    conceptoId: string,
    entrada: { monto: string; vigenteDesde: string; avisadoEn: string },
  ): Promise<{ id: string; monto: string; vigenteDesde: string; diasDeAviso: number }> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const exigidos = diasDeAvisoExigidos(await this.verticalDe(tx));
      const { dias, suficiente } = anticipacionDeAjuste(
        entrada.avisadoEn,
        entrada.vigenteDesde,
        exigidos,
      );
      if (!suficiente) {
        throw new BadRequestException(
          `El ajuste se avisó con ${dias} día(s) de anticipación y la ley pide ${exigidos}. ` +
            `Mueve la fecha de entrada en vigor o registra la fecha real del aviso.`,
        );
      }

      const concepto = await tx.conceptoCargo.findUnique({ where: { id: conceptoId } });
      if (!concepto) throw new NotFoundException('No encontramos ese concepto.');

      const actualizado = await tx.conceptoCargo.update({
        where: { id: conceptoId },
        data: {
          montoBase: entrada.monto,
          vigenteDesde: new Date(`${entrada.vigenteDesde}T00:00:00.000Z`),
          avisadoEn: new Date(`${entrada.avisadoEn}T00:00:00.000Z`),
        },
      });

      // El historico del precio vive en la bitacora append-only: la columna
      // solo guarda el vigente, pero hay que poder demostrar que se cobro lo
      // que se anuncio.
      await tx.eventoAuditoria.create({
        data: {
          tenantId: sesion.tenantId,
          actorId: sesion.usuarioId,
          tipo: 'cobranza.precio_ajustado',
          entidad: 'concepto_cargo',
          entidadId: conceptoId,
          datos: {
            de: concepto.montoBase.toFixed(2),
            a: actualizado.montoBase.toFixed(2),
            vigenteDesde: entrada.vigenteDesde,
            avisadoEn: entrada.avisadoEn,
            diasDeAviso: dias,
          },
        },
      });

      return {
        id: actualizado.id,
        monto: actualizado.montoBase.toFixed(2),
        vigenteDesde: actualizado.vigenteDesde.toISOString().slice(0, 10),
        diasDeAviso: dias,
      };
    });
  }

  // -------------------------------------------------------------------------
  // Generacion (AZ-M4.2 / AZ-M4.3)
  // -------------------------------------------------------------------------

  /**
   * Genera los cargos de un periodo. El nucleo del sprint.
   *
   * IDEMPOTENTE POR CONSTRUCCION (§15): la clave {alumno}:{concepto}:{periodo}
   * es unica en la base. Correrlo dos veces no duplica un solo peso, y el
   * resultado lo dice explicitamente devolviendo `generados: 0`.
   *
   * Un problema con UN alumno no aborta la corrida entera: se registra y se
   * sigue. Detener la generacion de 400 alumnos porque a uno le faltan los
   * porcentajes de sus pagadores seria cambiar un dato incompleto por una
   * escuela sin cobranza.
   */
  async generarCargos(sesion: Sesion, periodo: string): Promise<ResultadoGeneracion> {
    this.exigirRol(sesion);

    // La peticion sigue siendo un MES, aunque los conceptos ya no lo sean: la
    // administracion dice "genera lo de septiembre" y cada concepto resuelve su
    // propio periodo (AZ-M4.1c). Un concepto semestral generara su semestre una
    // sola vez, porque la idempotencia lo impide despues.
    if (!esPeriodoValido(periodo)) {
      throw new BadRequestException('El mes debe venir como AAAA-MM.');
    }

    return conTenant(sesion.tenantId, async (tx) => {
      const { diasGraciaSinRecargo } = await this.parametros(tx);
      // El piso de diez dias solo se le impone a quien la ley obliga (§51).
      const piso = pisoDeGracia(await this.verticalDe(tx));

      const periodoEscolar = await tx.periodo.findFirst({
        where: { activo: true },
        orderBy: { inicio: 'desc' },
      });
      if (!periodoEscolar) {
        throw new BadRequestException('La escuela no tiene un periodo activo.');
      }

      const inicioDelCiclo = periodoEscolar.inicio.toISOString().slice(0, 10);

      // Todos los conceptos activos: el filtro por vigencia se hace DENTRO del
      // bucle, porque ahora cada concepto abarca un tramo distinto del ciclo y
      // no hay un "ultimo dia del periodo" comun a todos.
      const conceptos = await tx.conceptoCargo.findMany({ where: { activo: true } });

      // Quien acepto cada cuota voluntaria (AZ-M4.2). De una sola consulta, por
      // la misma razon que las becas: N+1 sobre 400 familias en el proceso que
      // corre con la escuela entera esperando.
      const aceptaciones = await tx.aceptacionDeCuota.findMany({
        select: { alumnoId: true, conceptoId: true },
      });
      const acepto = new Set(aceptaciones.map((a) => `${a.alumnoId}:${a.conceptoId}`));

      // Las becas del tenant, de una sola consulta y agrupadas por alumno. Una
      // consulta por alumno seria N+1 sobre 400 familias, y la generacion es
      // justo el proceso que corre con la escuela entera esperando.
      const becasVigentes = await tx.beca.findMany({ where: { activa: true } });
      const becasPorAlumno = new Map<string, typeof becasVigentes>();
      for (const b of becasVigentes) {
        const lista = becasPorAlumno.get(b.alumnoId) ?? [];
        lista.push(b);
        becasPorAlumno.set(b.alumnoId, lista);
      }

      const problemas: ProblemaDeGeneracion[] = [];
      let generados = 0;
      let omitidos = 0;
      let totalCentavos = 0;
      /// Cuanto se dejo de cobrar por becas. La escuela tiene que poder verlo:
      /// es el numero que demuestra el cumplimiento del 5% que exige la ley.
      let becadoCentavos = 0;

      for (const concepto of conceptos) {
        // En que periodo DE ESTE CONCEPTO cae el mes que se pidio. Un concepto
        // mensual da `2026-09`; uno semestral, `2026-S1`; uno unico, `2026-A1`.
        // Null = el mes queda fuera del ciclo escolar, y entonces no hay nada
        // que generar: es informacion, no un error.
        const periodoEfectivo = periodoDeFecha(
          `${periodo}-01`,
          concepto.periodicidad,
          inicioDelCiclo,
        );
        if (periodoEfectivo === null || !esClaveDePeriodoValida(periodoEfectivo)) continue;

        // Los meses que abarca, para saber donde vence y hasta cuando cuenta la
        // vigencia del concepto.
        const meses = mesesDelPeriodo(periodoEfectivo, inicioDelCiclo);
        const mesDeVencimiento = primerMes(periodoEfectivo, inicioDelCiclo);
        const ultimoMes = meses[meses.length - 1] ?? mesDeVencimiento;

        // Un concepto entra si su vigencia empieza EN CUALQUIER DIA del periodo,
        // no solo si ya estaba vigente el primer dia.
        //
        // DEFECTO REAL cazado en la demo del 25-ago-2026: el ciclo escolar
        // arranca el 17 de agosto, asi que la colegiatura entra en vigor ese dia
        // — y comparando contra el dia 1 la generacion de agosto devolvia CERO
        // cargos, en silencio y sin error. La escuela no habria cobrado su primer
        // mes. El limite correcto es el ultimo dia del periodo: un aumento que
        // entra en septiembre sigue quedando fuera de agosto, que es lo que la
        // regla debe proteger.
        const finDeVigencia = fechaDelPeriodo(ultimoMes, 31);
        if (concepto.vigenteDesde > new Date(`${finDeVigencia}T00:00:00.000Z`)) continue;

        const inscripciones = await tx.inscripcion.findMany({
          where: {
            estado: 'ACTIVA',
            ...(concepto.cohorteId
              ? { cohorteId: concepto.cohorteId }
              : { cohorte: { periodoId: periodoEscolar.id } }),
          },
          include: {
            alumno: {
              select: {
                id: true,
                nombre: true,
                apellidos: true,
                activo: true,
                tutores: {
                  where: { esPagador: true },
                  select: { tutorId: true, porcentajePago: true },
                },
              },
            },
          },
        });

        // Los limites del periodo en dias, para el prorrateo.
        const primerDiaDelPeriodo = `${mesDeVencimiento}-01`;
        const ultimoDiaDelPeriodo = fechaDelPeriodo(ultimoMes, 31);

        // El cargo vence en el PRIMER mes del periodo: un semestre que arranca
        // en agosto se cobra en agosto, no en enero.
        const vencimiento = fechaDelPeriodo(mesDeVencimiento, concepto.diaVencimiento);
        const limite = fechaLimiteSinRecargo(
          mesDeVencimiento,
          concepto.diaVencimiento,
          diasGraciaSinRecargo,
          piso,
        );
        // La beca se juzga vigente al ARRANCAR el periodo que se cobra, no el
        // dia en que alguien pulsa "generar": generar tarde no debe quitarle la
        // beca a nadie.
        const inicioDelPeriodo = `${mesDeVencimiento}-01`;

        // Pronto pago, congelado en el cargo. Se recorta al limite sin recargo
        // porque premiar por "pagar temprano" un dia en que ya corre la mora
        // seria premiar y penalizar el mismo acto — y la base lo rechazaria.
        const diaProntoPago = concepto.diaProntoPago;
        const limiteProntoPago =
          diaProntoPago === null || concepto.descuentoProntoPagoPorcentaje === null
            ? null
            : (() => {
                const candidato = fechaDelPeriodo(mesDeVencimiento, diaProntoPago);
                return candidato <= limite ? candidato : limite;
              })();
        const montoCentavos = aCentavos(concepto.montoBase.toFixed(2));

        for (const inscripcion of inscripciones) {
          const alumno = inscripcion.alumno;
          if (!alumno.activo) continue;

          // --- Guard de cuotas voluntarias (AZ-M4.2) ---
          // El Acuerdo DOF 10-mar-1992 (arts. 3 y 5-III) prohibe condicionar el
          // servicio educativo a un pago voluntario. Generarle una
          // "cooperacion" a los 400 alumnos de golpe la vuelve obligatoria de
          // hecho: aparece en su estado de cuenta, suma al adeudo y entra a la
          // lista de morosos. Llamarla voluntaria en la pantalla no cambia lo
          // que el sistema hace con ella.
          //
          // Solo se le cobra a quien la acepto, y esa fila es la prueba de que
          // la escuela informo y la familia eligio.
          if (
            concepto.obligatoriedad === 'VOLUNTARIA' &&
            !acepto.has(`${alumno.id}:${concepto.id}`)
          ) {
            continue;
          }

          const clave = claveDeCargo(alumno.id, concepto.id, periodoEfectivo);

          const yaExiste = await tx.cargo.findUnique({
            where: { tenantId_clave: { tenantId: sesion.tenantId, clave } },
          });
          if (yaExiste) {
            omitidos++;
            continue;
          }

          // --- Becas: el cargo guarda su PRECIO DE LISTA y el descuento va
          //     encima como asiento (AZ-M4.3a) ---
          const aplicables = becasAplicables(
            (becasPorAlumno.get(alumno.id) ?? []).map((b) => ({
              id: b.id,
              tipo: b.tipo,
              valor: Number(b.valor),
              motivo: b.motivo,
              conceptoId: b.conceptoId,
              vigenteDesde: b.vigenteDesde.toISOString().slice(0, 10),
              vigenteHasta: b.vigenteHasta?.toISOString().slice(0, 10) ?? null,
            })),
            { conceptoId: concepto.id, fecha: inicioDelPeriodo },
          );

          const descuentos: DescuentoAplicable[] = aplicables.map((b) => ({
            referencia: b.id,
            categoria: 'BECA',
            tipo: b.tipo,
            // Un porcentaje viaja tal cual; un monto fijo se convierte a
            // centavos, que es la unidad de este dominio (§43).
            valor: b.tipo === 'PORCENTAJE' ? b.valor : aCentavos(b.valor.toFixed(2)),
            concepto: b.motivo,
          }));

          // --- Prorrateo por alta a mitad de periodo (AZ-M4.1) ---
          // Va PRIMERO en la cascada: fija el precio real de lo que se cobra.
          // Aplicar la beca antes becaria dias que el alumno no estuvo.
          //
          // NO se prorratea un concepto UNICO: la inscripcion, una credencial o
          // un examen extraordinario cuestan lo que cuestan. No son un servicio
          // que se consuma con el tiempo, asi que entrar en noviembre no hace
          // que la inscripcion valga menos. Prorratearla seria regalar dinero
          // por llegar tarde.
          const alta = inscripcion.altaEn.toISOString().slice(0, 10);
          const proporcion =
            concepto.periodicidad === 'UNICO'
              ? { diasCubiertos: 1, diasTotales: 1 }
              : proporcionDelPeriodo({
                  altaEn: alta,
                  inicioDelPeriodo: primerDiaDelPeriodo,
                  finDelPeriodo: ultimoDiaDelPeriodo,
                });
          const prorrateo = descuentoPorProrrateo(montoCentavos, proporcion);
          if (prorrateo > 0) {
            descuentos.push({
              referencia: `prorrateo:${inscripcion.id}`,
              categoria: 'PRORRATEO',
              tipo: 'MONTO_FIJO',
              valor: prorrateo,
              concepto:
                `Prorrateo por alta el ${alta} ` +
                `(${proporcion.diasCubiertos} de ${proporcion.diasTotales} días)`,
            });
          }

          const { aplicados, netoCentavos } = calcularDescuentos(montoCentavos, descuentos);

          const cargo = await tx.cargo.create({
            data: {
              tenantId: sesion.tenantId,
              alumnoId: alumno.id,
              conceptoId: concepto.id,
              periodo: periodoEfectivo,
              // Precio de LISTA, no el neto: sin el, el estado de cuenta no
              // puede explicar por que se cobra lo que se cobra.
              monto: concepto.montoBase,
              fechaVencimiento: new Date(`${vencimiento}T00:00:00.000Z`),
              fechaLimiteSinRecargo: new Date(`${limite}T00:00:00.000Z`),
              fechaLimiteProntoPago:
                limiteProntoPago === null ? null : new Date(`${limiteProntoPago}T00:00:00.000Z`),
              descuentoProntoPagoPorcentaje:
                limiteProntoPago === null ? null : concepto.descuentoProntoPagoPorcentaje,
              clave,
              generadoPor: sesion.usuarioId,
            },
          });
          generados++;
          totalCentavos += netoCentavos;
          becadoCentavos += montoCentavos - netoCentavos;

          if (aplicados.length > 0) {
            await tx.descuentoDeCargo.createMany({
              // El prorrateo NO tiene beca detras: su referencia es sintetica.
              // Guardarla como `becaId` seria una llave foranea rota.
              data: aplicados.map((d) => ({
                tenantId: sesion.tenantId,
                cargoId: cargo.id,
                becaId: d.referencia.startsWith('prorrateo:') ? null : d.referencia,
                categoria: d.referencia.startsWith('prorrateo:')
                  ? ('PRORRATEO' as const)
                  : ('BECA' as const),
                concepto: d.concepto,
                monto: aMonto(d.centavos),
              })),
            });
          }

          // --- El reparto, congelado en este momento ---
          // Sobre el NETO, que es lo que la familia debe de verdad. Repartir el
          // precio de lista le cobraria a los pagadores la beca que la escuela
          // ya concedio.
          const pagadores = alumno.tutores
            .filter((t) => t.porcentajePago !== null)
            .map((t) => ({ referencia: t.tutorId, porcentaje: Number(t.porcentajePago) }));

          if (pagadores.length === 0) {
            problemas.push({
              alumno: `${alumno.nombre} ${alumno.apellidos}`,
              concepto: concepto.nombre,
              motivo: 'No tiene pagadores con porcentaje registrado.',
            });
            continue;
          }

          try {
            const partes = repartir(netoCentavos, pagadores);
            await tx.parteDeCargo.createMany({
              data: partes.map((parte) => ({
                tenantId: sesion.tenantId,
                cargoId: cargo.id,
                tutorId: parte.referencia,
                porcentaje:
                  pagadores.find((p) => p.referencia === parte.referencia)?.porcentaje ?? 0,
                monto: aMonto(parte.centavos),
              })),
              skipDuplicates: true,
            });
          } catch (error) {
            if (error instanceof RepartoInvalidoError) {
              problemas.push({
                alumno: `${alumno.nombre} ${alumno.apellidos}`,
                concepto: concepto.nombre,
                motivo: error.message,
              });
              continue;
            }
            throw error;
          }
        }
      }

      // --- El saldo a favor se aplica solo (AZ-M4.10) ---
      // Ultimo paso y DENTRO de la misma transaccion: generar cargos es el
      // unico momento en que aparece deuda nueva, y por tanto el unico en que
      // el dinero que la familia ya entrego puede consumirse. Si esto falla, la
      // generacion entera se deshace — preferible a dejar cargos emitidos con
      // un saldo a favor que la app promete aplicar y no aplico.
      const credito = await aplicarSaldoAFavorPendiente(tx, {
        tenantId: sesion.tenantId,
        actorId: sesion.usuarioId,
      });

      await tx.eventoAuditoria.create({
        data: {
          tenantId: sesion.tenantId,
          actorId: sesion.usuarioId,
          tipo: 'cobranza.cargos_generados',
          entidad: 'periodo_cobro',
          datos: {
            periodo,
            generados,
            omitidos,
            problemas: problemas.length,
            importe: aMonto(totalCentavos),
            becado: aMonto(becadoCentavos),
            saldoAFavorAplicado: credito.aplicado,
          },
        },
      });

      if (problemas.length > 0) {
        this.log.warn(`Generación de ${periodo}: ${problemas.length} alumno(s) sin reparto.`);
      }

      return {
        periodo,
        generados,
        omitidos,
        importeTotal: aMonto(totalCentavos),
        becado: aMonto(becadoCentavos),
        problemas,
        saldoAFavorAplicado: credito.aplicado,
        familiasConSaldoAplicado: credito.tutores,
      };
    });
  }

  /** Los cargos de un periodo, con su reparto. Lectura para la pantalla. */
  async listarCargos(sesion: Sesion, periodo: string): Promise<CargoResumen[]> {
    this.exigirRol(sesion);
    // La peticion sigue siendo un MES, aunque los conceptos ya no lo sean: la
    // administracion dice "genera lo de septiembre" y cada concepto resuelve su
    // propio periodo (AZ-M4.1c). Un concepto semestral generara su semestre una
    // sola vez, porque la idempotencia lo impide despues.
    if (!esPeriodoValido(periodo)) {
      throw new BadRequestException('El mes debe venir como AAAA-MM.');
    }

    return conTenant(sesion.tenantId, async (tx) => {
      const cargos = await tx.cargo.findMany({
        where: { periodo },
        include: {
          alumno: { select: { nombre: true, apellidos: true } },
          concepto: { select: { nombre: true, clave: true } },
          partes: { include: { tutor: { select: { nombre: true, apellidos: true } } } },
        },
        orderBy: [{ alumno: { apellidos: 'asc' } }, { concepto: { nombre: 'asc' } }],
      });

      return cargos.map((c) => ({
        id: c.id,
        alumno: `${c.alumno.apellidos}, ${c.alumno.nombre}`,
        concepto: c.concepto.nombre,
        monto: c.monto.toFixed(2),
        vence: c.fechaVencimiento.toISOString().slice(0, 10),
        // Se expone la ventana legal: la administración debe VER hasta cuándo
        // no puede cobrar recargo, no deducirlo.
        sinRecargoHasta: c.fechaLimiteSinRecargo.toISOString().slice(0, 10),
        estado: c.estado,
        partes: c.partes.map((p) => ({
          tutor: `${p.tutor.nombre} ${p.tutor.apellidos}`,
          porcentaje: p.porcentaje.toFixed(2),
          monto: p.monto.toFixed(2),
        })),
      }));
    });
  }
}
