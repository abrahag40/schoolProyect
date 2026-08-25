import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { conTenant } from '@azahar/db';
import { Mensajero } from '../notificaciones/mensajero.js';
import type { Sesion } from '../comun/sesion.js';
import {
  avisosPorRegistro,
  fechaEscolar,
  fechaFueraDeRango,
  inicioDeVentana,
  PARAMETROS_POR_OMISION,
  type EstadoAsistencia,
  type ParametrosAviso,
} from './reglas.js';

/**
 * Quien puede pasar lista. Direccion y administracion tambien: en una escuela
 * chica la directora cubre un grupo cuando falta la maestra, y obligarla a
 * pedir una cuenta de docente es como el sistema pierde al usuario (AZ-M1.3).
 */
const ROLES_PASE_LISTA = ['DOCENTE', 'DIRECTOR', 'ADMIN', 'DUENO'];
/// Ven TODAS las cohortes. El docente ve solo las suyas.
const ROLES_TODA_LA_ESCUELA = ['DIRECTOR', 'ADMIN', 'DUENO'];

export interface GrupoDelDocente {
  id: string;
  nombre: string;
  /// GRADO, CATEGORIA, NIVEL o TALLER: la interfaz lo traduce al idioma de la
  /// vertical (grupo, categoria, nivel, taller).
  tipo: string;
  sede: string;
  inscritos: number;
  /// Si ya se paso lista hoy. Es la pregunta que la coordinadora hace a las 9
  /// de la manana, y por eso viaja en la lista y no en una consulta aparte.
  listaDeHoy: boolean;
}

export interface MisGrupos {
  /// El "hoy" de LA ESCUELA (su zona horaria), no el del servidor.
  hoy: string;
  grupos: GrupoDelDocente[];
}

export interface AlumnoEnLista {
  alumnoId: string;
  nombre: string;
  apellidos: string;
  estado: EstadoAsistencia | null;
}

export interface ListaDelDia {
  cohorte: { id: string; nombre: string; tipo: string; sede: string };
  fecha: string;
  /// Ya se habia guardado hoy. La pantalla lo dice en vez de fingir que esta
  /// en blanco: el docente necesita saber si esta capturando o corrigiendo.
  yaRegistrada: boolean;
  alumnos: AlumnoEnLista[];
}

export interface ResultadoPaseLista {
  fecha: string;
  guardados: number;
  resumen: { presentes: number; ausentes: number; retardos: number; justificadas: number };
  /// Cuantos avisos NUEVOS produjo. Cero al re-guardar lo mismo: es la prueba
  /// visible de que la idempotencia funciona (§15).
  avisosGenerados: number;
}

type Transaccion = Parameters<Parameters<typeof conTenant>[1]>[0];

@Injectable()
export class ServicioAsistencia {
  private readonly log = new Logger('Asistencia');

  constructor(private readonly mensajero: Mensajero) {}

  /** Parametros de la escuela, con caida a los de omision si aun no configura. */
  private async parametros(tx: Transaccion): Promise<ParametrosAviso & { zonaHoraria: string }> {
    const fila = await tx.configuracionEscuela.findFirst();
    return {
      umbralFaltas: fila?.umbralFaltas ?? PARAMETROS_POR_OMISION.umbralFaltas,
      ventanaDias: fila?.ventanaDias ?? PARAMETROS_POR_OMISION.ventanaDias,
      avisarFaltaDelDia: fila?.avisarFaltaDelDia ?? PARAMETROS_POR_OMISION.avisarFaltaDelDia,
      zonaHoraria: fila?.zonaHoraria ?? 'America/Mexico_City',
    };
  }

  /**
   * Las cohortes que esta persona puede pasar. `null` significa "todas".
   *
   * Deny-by-default tambien aqui: si alguien tiene rol DOCENTE y ninguna
   * asignacion, no ve grupos. Preferimos una pantalla vacia con explicacion a
   * un docente pasando lista del grupo equivocado.
   */
  private async cohortesPermitidas(tx: Transaccion, sesion: Sesion): Promise<string[] | null> {
    if (sesion.roles.some((r) => ROLES_TODA_LA_ESCUELA.includes(r))) return null;
    const asignaciones = await tx.asignacionDocente.findMany({
      where: { usuarioId: sesion.usuarioId },
      select: { cohorteId: true },
    });
    return asignaciones.map((a) => a.cohorteId);
  }

  private exigirRol(sesion: Sesion): void {
    if (!sesion.roles.some((r) => ROLES_PASE_LISTA.includes(r))) {
      throw new ForbiddenException('El pase de lista es para el personal de la escuela.');
    }
  }

  /** Los grupos que le tocan a quien pregunta, para el selector de la pantalla. */
  async misGrupos(sesion: Sesion): Promise<MisGrupos> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const permitidas = await this.cohortesPermitidas(tx, sesion);
      const cohortes = await tx.cohorte.findMany({
        where: {
          activa: true,
          periodo: { activo: true },
          ...(permitidas ? { id: { in: permitidas } } : {}),
        },
        include: {
          sede: true,
          _count: { select: { inscripciones: { where: { estado: 'ACTIVA' } } } },
        },
        orderBy: { orden: 'asc' },
      });

      const { zonaHoraria } = await this.parametros(tx);
      const hoy = fechaEscolar(new Date(), zonaHoraria);
      // Cuantos grupos ya pasaron lista hoy: la pregunta que la coordinadora
      // hace a las 9 de la manana. Una consulta agregada, no una por grupo.
      const yaPasadas = await tx.asistencia.groupBy({
        by: ['cohorteId'],
        where: { fecha: new Date(`${hoy}T00:00:00.000Z`) },
      });
      const conLista = new Set(yaPasadas.map((f) => f.cohorteId));

      return {
        hoy,
        grupos: cohortes.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          tipo: c.tipo,
          sede: c.sede.nombre,
          inscritos: c._count.inscripciones,
          listaDeHoy: conLista.has(c.id),
        })),
      };
    });
  }

  /** La lista de un grupo en una fecha, con lo ya capturado si lo hay. */
  async lista(sesion: Sesion, cohorteId: string, fechaPedida?: string): Promise<ListaDelDia> {
    this.exigirRol(sesion);

    return conTenant(sesion.tenantId, async (tx) => {
      const { zonaHoraria } = await this.parametros(tx);
      const fecha = fechaPedida ?? fechaEscolar(new Date(), zonaHoraria);

      const cohorte = await this.exigirCohorte(tx, sesion, cohorteId);

      const inscritos = await tx.inscripcion.findMany({
        where: { cohorteId, estado: 'ACTIVA' },
        include: { alumno: true },
      });
      const registros = await tx.asistencia.findMany({
        where: { cohorteId, fecha: new Date(`${fecha}T00:00:00.000Z`) },
      });
      const porAlumno = new Map(registros.map((r) => [r.alumnoId, r.estado]));

      const alumnos = inscritos
        .map((i) => ({
          alumnoId: i.alumno.id,
          nombre: i.alumno.nombre,
          apellidos: i.alumno.apellidos,
          estado: porAlumno.get(i.alumno.id) ?? null,
        }))
        // Ordenado por apellido: es como la escuela lee una lista, y el docente
        // busca con la vista, no con un filtro.
        .sort((a, b) =>
          `${a.apellidos} ${a.nombre}`.localeCompare(`${b.apellidos} ${b.nombre}`, 'es'),
        );

      return {
        cohorte: {
          id: cohorte.id,
          nombre: cohorte.nombre,
          tipo: cohorte.tipo,
          sede: cohorte.sede.nombre,
        },
        fecha,
        yaRegistrada: registros.length > 0,
        alumnos,
      };
    });
  }

  private async exigirCohorte(tx: Transaccion, sesion: Sesion, cohorteId: string) {
    const permitidas = await this.cohortesPermitidas(tx, sesion);
    if (permitidas && !permitidas.includes(cohorteId)) {
      // Mismo mensaje exista o no el grupo: distinguirlos confirmaria a quien
      // sondea que ese identificador existe en esta escuela.
      throw new ForbiddenException('Ese grupo no está asignado a tu cuenta.');
    }
    const cohorte = await tx.cohorte.findUnique({
      where: { id: cohorteId },
      include: { sede: true },
    });
    if (!cohorte) throw new NotFoundException('No encontramos ese grupo.');
    return cohorte;
  }

  /**
   * Guarda el pase de lista y produce los avisos. El nucleo del Sprint 3.
   *
   * DOS FASES A PROPOSITO (ADR-010):
   *   1. Transaccion: asistencias + bitacora + FILAS de aviso con clave unica.
   *   2. Despues del commit: el envio push.
   * Llamar al proveedor dentro de la transaccion produciria dos males clasicos:
   * transacciones largas bloqueando la tabla, y avisos enviados de operaciones
   * que despues revierten — imposibles de retirar del telefono de una madre.
   */
  async guardar(
    sesion: Sesion,
    entrada: {
      cohorteId: string;
      fecha?: string;
      registros: Array<{ alumnoId: string; estado: EstadoAsistencia }>;
    },
  ): Promise<ResultadoPaseLista> {
    this.exigirRol(sesion);

    const { pendientes, destinatarios, resultado } = await conTenant(
      sesion.tenantId,
      async (tx) => {
        const parametros = await this.parametros(tx);
        const hoy = fechaEscolar(new Date(), parametros.zonaHoraria);
        const fecha = entrada.fecha ?? hoy;

        if (fechaFueraDeRango(fecha, hoy)) {
          throw new BadRequestException('No se puede pasar lista de un día que todavía no ocurre.');
        }

        await this.exigirCohorte(tx, sesion, entrada.cohorteId);

        // Solo alumnos INSCRITOS en ese grupo. Sin esta comprobacion, un cliente
        // manipulado marcaria faltas de cualquier alumno de la escuela — y RLS
        // no lo impediria, porque son del mismo tenant.
        const inscritos = await tx.inscripcion.findMany({
          where: { cohorteId: entrada.cohorteId, estado: 'ACTIVA' },
          include: { alumno: { select: { id: true, nombre: true } } },
        });
        const validos = new Map(inscritos.map((i) => [i.alumno.id, i.alumno.nombre]));
        const intrusos = entrada.registros.filter((r) => !validos.has(r.alumnoId));
        if (intrusos.length > 0) {
          throw new BadRequestException('Hay alumnos que no pertenecen a este grupo.');
        }

        const fechaSql = new Date(`${fecha}T00:00:00.000Z`);
        const previos = await tx.asistencia.findMany({
          where: { cohorteId: entrada.cohorteId, fecha: fechaSql },
        });
        const estadoPrevio = new Map(previos.map((p) => [p.alumnoId, p.estado]));

        const resumen = { presentes: 0, ausentes: 0, retardos: 0, justificadas: 0 };
        for (const registro of entrada.registros) {
          await tx.asistencia.upsert({
            where: {
              alumnoId_cohorteId_fecha: {
                alumnoId: registro.alumnoId,
                cohorteId: entrada.cohorteId,
                fecha: fechaSql,
              },
            },
            create: {
              tenantId: sesion.tenantId,
              alumnoId: registro.alumnoId,
              cohorteId: entrada.cohorteId,
              fecha: fechaSql,
              estado: registro.estado,
              registradoPor: sesion.usuarioId,
            },
            update: {
              estado: registro.estado,
              registradoPor: sesion.usuarioId,
              registradoEn: new Date(),
            },
          });

          if (registro.estado === 'PRESENTE') resumen.presentes++;
          else if (registro.estado === 'AUSENTE') resumen.ausentes++;
          else if (registro.estado === 'RETARDO') resumen.retardos++;
          else resumen.justificadas++;

          // Toda CORRECCION deja rastro en la bitacora append-only (§39). La fila
          // de asistencia se puede corregir; la historia de quien la corrigio, no.
          const anterior = estadoPrevio.get(registro.alumnoId);
          if (anterior && anterior !== registro.estado) {
            await tx.eventoAuditoria.create({
              data: {
                tenantId: sesion.tenantId,
                actorId: sesion.usuarioId,
                tipo: 'asistencia.corregida',
                entidad: 'asistencia',
                datos: { alumnoId: registro.alumnoId, fecha, de: anterior, a: registro.estado },
              },
            });
          }
        }

        await tx.eventoAuditoria.create({
          data: {
            tenantId: sesion.tenantId,
            actorId: sesion.usuarioId,
            tipo: 'asistencia.pase_lista',
            entidad: 'cohorte',
            entidadId: entrada.cohorteId,
            datos: { fecha, ...resumen },
          },
        });

        // --- Avisos: primero se calculan, luego se materializan ---------------
        const ausentes = entrada.registros.filter((r) => r.estado === 'AUSENTE');
        const desde = new Date(`${inicioDeVentana(fecha, parametros.ventanaDias)}T00:00:00.000Z`);

        const propuestos: Array<{
          alumnoId: string;
          aviso: ReturnType<typeof avisosPorRegistro>[number];
        }> = [];
        for (const ausente of ausentes) {
          const faltasEnVentana = await tx.asistencia.count({
            where: {
              alumnoId: ausente.alumnoId,
              estado: 'AUSENTE',
              fecha: { gte: desde, lte: fechaSql },
            },
          });
          for (const aviso of avisosPorRegistro({
            alumnoId: ausente.alumnoId,
            nombreAlumno: validos.get(ausente.alumnoId) ?? 'Tu hija o hijo',
            fecha,
            estado: 'AUSENTE',
            faltasEnVentana,
            parametros,
          })) {
            propuestos.push({ alumnoId: ausente.alumnoId, aviso });
          }
        }

        // Destinatarios: TODOS los tutores vinculados con acceso a la app, no
        // solo el pagador. Enterarse de que su hijo falto es de la crianza, no
        // de la cobranza — la abuela que recoge y no paga tambien necesita saber.
        const vinculos = propuestos.length
          ? await tx.tutorAlumno.findMany({
              where: { alumnoId: { in: [...new Set(propuestos.map((p) => p.alumnoId))] } },
              include: { tutor: { select: { usuarioId: true } } },
            })
          : [];

        const filas = propuestos.flatMap(({ alumnoId, aviso }) =>
          vinculos
            .filter((v) => v.alumnoId === alumnoId && v.tutor.usuarioId)
            .map((v) => ({
              tenantId: sesion.tenantId,
              usuarioId: v.tutor.usuarioId!,
              tipo: aviso.tipo,
              titulo: aviso.titulo,
              cuerpo: aviso.cuerpo,
              destino: aviso.destino,
              alumnoId,
              clave: aviso.clave,
            })),
        );

        // skipDuplicates + unico (tenant, usuario, clave): la idempotencia la
        // garantiza la BASE. Dos docentes guardando a la vez no pueden producir
        // dos avisos de la misma falta, por rapido que corran.
        const creados = filas.length
          ? await tx.notificacion.createMany({ data: filas, skipDuplicates: true })
          : { count: 0 };

        const destinatarios = [...new Set(filas.map((f) => f.usuarioId))];
        // Se recogen TODOS los pendientes de esas personas, no solo los de este
        // lote: si un envio anterior fallo, sale ahora. Es el reintento del
        // outbox sin necesidad de un cron.
        const pendientes = destinatarios.length
          ? await tx.notificacion.findMany({
              where: { usuarioId: { in: destinatarios }, enviadaEn: null },
            })
          : [];

        return {
          pendientes,
          destinatarios,
          resultado: {
            fecha,
            guardados: entrada.registros.length,
            resumen,
            avisosGenerados: creados.count,
          },
        };
      },
    );

    if (pendientes.length > 0) await this.despachar(sesion.tenantId, destinatarios, pendientes);
    return resultado;
  }

  /**
   * Fase 2: entregar. Ya con el commit hecho.
   *
   * Un fallo aqui NO tumba la peticion: la asistencia quedo guardada y el aviso
   * sigue en la tabla como pendiente. Perder el pase de lista de un docente
   * porque el proveedor de push tuvo un mal minuto seria un pesimo negocio.
   */
  private async despachar(
    tenantId: string,
    destinatarios: string[],
    pendientes: Array<{
      id: string;
      usuarioId: string;
      titulo: string;
      cuerpo: string;
      destino: string | null;
    }>,
  ): Promise<void> {
    try {
      const dispositivos = await conTenant(tenantId, (tx) =>
        tx.dispositivoPush.findMany({ where: { usuarioId: { in: destinatarios } } }),
      );

      for (const aviso of pendientes) {
        const tokens = dispositivos
          .filter((d) => d.usuarioId === aviso.usuarioId)
          .map((d) => d.token);
        const envio = tokens.length
          ? await this.mensajero.enviar(tokens, {
              titulo: aviso.titulo,
              cuerpo: aviso.cuerpo,
              destino: aviso.destino ?? undefined,
            })
          : { enviados: 0, fallidos: 0, tokensInvalidos: [] };

        await conTenant(tenantId, async (tx) => {
          // Se marca enviada aunque alcance 0 dispositivos: la familia sin app
          // instalada NO es un error a reintentar por siempre, y el aviso sigue
          // visible dentro de la app cuando entre. `dispositivos: 0` deja el
          // dato para producto (cuantas familias no tienen la app).
          await tx.notificacion.update({
            where: { id: aviso.id },
            data: { enviadaEn: new Date(), dispositivos: envio.enviados },
          });
          if (envio.tokensInvalidos.length > 0) {
            await tx.dispositivoPush.deleteMany({
              where: { token: { in: envio.tokensInvalidos } },
            });
          }
        });
      }
    } catch (error) {
      // Se registra sin datos personales: el log dice que fallo, no a quien.
      this.log.error(`No se pudieron despachar ${pendientes.length} aviso(s): ${String(error)}`);
    }
  }
}
