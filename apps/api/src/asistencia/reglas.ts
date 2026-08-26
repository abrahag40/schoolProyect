/**
 * Reglas del pase de lista y del motor de avisos (AZ-M3.1 / AZ-M5.1).
 *
 * MODULO PURO A PROPOSITO: sin base de datos, sin red y sin reloj propio. Todo
 * lo que varia entra por parametro. Esa es la razon de que exista separado del
 * servicio — permite probar el NO-camino (que NO se avise) sin montar una
 * escuela entera, que es justo el caso que nadie prueba cuando la regla vive
 * enterrada en un controlador (§13).
 *
 * POR QUE ESTAS REGLAS Y NO OTRAS — la evidencia:
 *   - Bergman & Chan (2021), Journal of Human Resources 56(1):125-158: las
 *     alertas automaticas a las familias bajaron 27% la reprobacion y subieron
 *     12% la asistencia. https://doi.org/10.3368/jhr.56.1.1118-9837R1
 *   - Rogers & Feller (2018), Nature Human Behaviour 2:335-342: informar el
 *     ACUMULADO de faltas redujo el ausentismo cronico 10% o mas, corrigiendo
 *     la creencia equivocada del padre sobre cuantas faltas lleva su hijo.
 *     https://doi.org/10.1038/s41562-018-0328-1
 * De ahi salen dos decisiones que se ven abajo: el aviso dice el acumulado (no
 * solo el hecho del dia), y el acumulado se topa a uno por mes — el estudio
 * usa recordatorios espaciados, no un goteo diario. El goteo entrena a ignorar.
 */

export type EstadoAsistencia = 'PRESENTE' | 'AUSENTE' | 'RETARDO' | 'JUSTIFICADA';

/** Tipos estables para analitica (§37): se agregan, nunca se renombran. */
export const TIPO_FALTA = 'asistencia.falta';
export const TIPO_ACUMULADA = 'asistencia.acumulada';

export interface ParametrosAviso {
  umbralFaltas: number;
  ventanaDias: number;
  avisarFaltaDelDia: boolean;
}

export const PARAMETROS_POR_OMISION: ParametrosAviso = {
  umbralFaltas: 3,
  ventanaDias: 30,
  avisarFaltaDelDia: true,
};

export interface AvisoPropuesto {
  tipo: string;
  clave: string;
  titulo: string;
  cuerpo: string;
  destino: string;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * "2026-09-03" -> "3 de septiembre". Formateo propio y no Intl con locale:
 * el texto viaja en una notificacion que debe leerse igual en cualquier
 * servidor, sin depender de que locales tenga instalado el contenedor.
 */
export function fechaLegible(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  const indice = Number(mes) - 1;
  if (!MESES[indice] || !dia) return fecha;
  return `${Number(dia)} de ${MESES[indice]}`;
}

/**
 * El dia escolar vive en `comun/` desde el Sprint 5: la cobranza tambien lo
 * necesita, y hacerla importar del modulo de pase de lista habria inventado un
 * acoplamiento que no describe ninguna relacion real. Se reexporta para no
 * romper a quien ya lo importaba desde aqui.
 */
export { fechaEscolar } from '../comun/fecha-escolar.js';

/** Primer dia de la ventana movil, inclusivo: 30 dias = hoy y 29 anteriores. */
export function inicioDeVentana(fecha: string, dias: number): string {
  const base = new Date(`${fecha}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() - (Math.max(1, dias) - 1));
  return base.toISOString().slice(0, 10);
}

/**
 * Que avisos genera UN registro de asistencia. El corazon del sprint.
 *
 * Decisiones visibles aqui, todas discutibles y por eso escritas:
 *  - PRESENTE, RETARDO y JUSTIFICADA no avisan. Un retardo no es una falta, y
 *    notificar cada llegada tarde convierte el canal en ruido que la familia
 *    silencia — y una app silenciada no avisa nada, ni lo importante.
 *  - El aviso acumulado se dispara con `>=` y no con `==` el umbral: una carga
 *    masiva puede saltar del 1 al 5 sin pisar el numero exacto, y ese alumno
 *    es precisamente el que hay que reportar.
 *  - La clave del acumulado lleva el ANO-MES: como maximo un aviso acumulado
 *    por alumno por mes, aunque siga faltando. La cadencia es del estudio, no
 *    del gusto.
 */
export function avisosPorRegistro(entrada: {
  alumnoId: string;
  nombreAlumno: string;
  fecha: string;
  estado: EstadoAsistencia;
  /// Faltas del alumno dentro de la ventana, INCLUYENDO la que se registra.
  faltasEnVentana: number;
  parametros: ParametrosAviso;
}): AvisoPropuesto[] {
  const { alumnoId, nombreAlumno, fecha, estado, faltasEnVentana, parametros } = entrada;

  if (estado !== 'AUSENTE') return [];

  const avisos: AvisoPropuesto[] = [];

  if (parametros.avisarFaltaDelDia) {
    avisos.push({
      tipo: TIPO_FALTA,
      clave: `falta:${alumnoId}:${fecha}`,
      titulo: `${nombreAlumno} no asistió hoy`,
      // Se dice que hacer si el aviso es un error: un mensaje que solo acusa
      // pone a la familia a la defensiva y no resuelve nada.
      cuerpo:
        `Se registró su falta del ${fechaLegible(fecha)}. ` +
        `Si ya avisaste a la escuela, no necesitas hacer nada.`,
      destino: '/panel',
    });
  }

  if (faltasEnVentana >= parametros.umbralFaltas) {
    avisos.push({
      tipo: TIPO_ACUMULADA,
      clave: `acumulada:${alumnoId}:${fecha.slice(0, 7)}`,
      titulo: `${nombreAlumno} lleva ${faltasEnVentana} faltas`,
      // El acumulado es el mecanismo con evidencia: corrige la creencia del
      // padre sobre cuantas faltas lleva su hijo, que casi siempre subestima.
      cuerpo:
        `Son ${faltasEnVentana} faltas en los últimos ${parametros.ventanaDias} días. ` +
        `Si algo está pasando, la escuela puede ayudar: escríbeles.`,
      destino: '/panel',
    });
  }

  return avisos;
}

/**
 * Un pase de lista no se registra en el futuro.
 *
 * No es paranoia: la pantalla trae un selector de fecha, y una fecha adelantada
 * generaria avisos de faltas que todavia no ocurrieron. Corregir eso despues es
 * imposible: el aviso ya llego al telefono de la madre.
 */
export function fechaFueraDeRango(fecha: string, hoyEscolar: string): boolean {
  return fecha > hoyEscolar;
}
