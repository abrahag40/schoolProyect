/**
 * Periodos de cobro (AZ-M4.1c) — la clave del periodo deja de ser un mes.
 *
 * MODULO PURO: sin base de datos, sin reloj propio, sin red.
 *
 * EL DEFECTO QUE ESTE ARCHIVO CIERRA. Hasta el Sprint 5 un cargo se identificaba
 * por `AAAA-MM` y la periodicidad solo admitia MENSUAL, UNICO y ANUAL. Un
 * semestre no se podia expresar: `ANUAL` lo cobraria una vez cuando deberian ser
 * dos, y `MENSUAL` doce. La pregunta que lo destapo fue del CEO —"una escuela
 * puede que cobre bimestralmente o semestralmente"— y la evidencia ya estaba en
 * el estudio sin que la leyeramos asi: el Reglamento de Pagos de la UPAEP cobra
 * por **periodo academico** y ofrece pagarlo completo o en parcialidades. El
 * periodo es el semestre; la mensualidad es solo la forma de pagarlo.
 *
 * LA DECISION QUE MAS IMPORTA DE ESTE ARCHIVO: **los periodos se anclan al ciclo
 * escolar, no al año calendario.** Un colegio que arranca en agosto tiene su
 * primer semestre de agosto a enero, no de enero a junio. Anclarlo al calendario
 * daria periodos que no existen para nadie: ni la escuela ni la familia hablan
 * de "el semestre de enero" cuando su ciclo empezo en agosto.
 *
 * FORMATO DE LA CLAVE, y por que cada uno:
 *   MENSUAL       -> `2026-09`   el mes calendario, como siempre
 *   BIMESTRAL     -> `2026-B3`   bimestre 1..6 del ciclo
 *   CUATRIMESTRAL -> `2026-C2`   cuatrimestre 1..3 del ciclo
 *   SEMESTRAL     -> `2026-S1`   semestre 1..2 del ciclo
 *   ANUAL/UNICO   -> `2026-A1`   el ciclo entero, una sola vez
 * El año que encabeza la clave es SIEMPRE el de inicio del ciclo, para que el
 * ciclo 2026-2027 no se parta en dos claves distintas a mitad de enero.
 *
 * Todas caben en los 7 caracteres que la columna ya tenia: la migracion no
 * ensancha la columna, solo admite mas formas.
 */

/** Cada cuanto se cobra un concepto. */
export type Periodicidad =
  'MENSUAL' | 'BIMESTRAL' | 'CUATRIMESTRAL' | 'SEMESTRAL' | 'ANUAL' | 'UNICO';

/** Cuantos meses abarca un periodo de cada periodicidad. */
const MESES_POR_PERIODO: Record<Exclude<Periodicidad, 'UNICO'>, number> = {
  MENSUAL: 1,
  BIMESTRAL: 2,
  CUATRIMESTRAL: 4,
  SEMESTRAL: 6,
  ANUAL: 12,
};

/** La letra que identifica cada periodicidad en la clave. UNICO comparte la de ANUAL. */
const LETRA: Record<Exclude<Periodicidad, 'MENSUAL'>, string> = {
  BIMESTRAL: 'B',
  CUATRIMESTRAL: 'C',
  SEMESTRAL: 'S',
  ANUAL: 'A',
  UNICO: 'A',
};

const RE_MENSUAL = /^\d{4}-(0[1-9]|1[0-2])$/;
const RE_CICLICO = /^(\d{4})-([BCSA])([1-9])$/;

/** Cuantos periodos de esa periodicidad caben en un ciclo de doce meses. */
export function periodosPorCiclo(periodicidad: Periodicidad): number {
  if (periodicidad === 'UNICO') return 1;
  return 12 / MESES_POR_PERIODO[periodicidad];
}

/**
 * ¿Es una clave de periodo bien formada?
 *
 * Se valida la FORMA y el RANGO: `2026-S3` no existe —solo hay dos semestres—
 * y aceptarlo produciria un cargo que nadie sabe cuando vence. Es el mismo
 * criterio que ya tenia el mes: `2026-13` nunca fue valido.
 */
export function esPeriodoValido(clave: string): boolean {
  if (RE_MENSUAL.test(clave)) return true;

  const m = RE_CICLICO.exec(clave);
  if (!m) return false;

  const [, , letra, numero] = m as unknown as [string, string, string, string];
  const cuantos = letra === 'B' ? 6 : letra === 'C' ? 3 : letra === 'S' ? 2 : /* 'A' */ 1;
  return Number(numero) >= 1 && Number(numero) <= cuantos;
}

/** "2026-08-17" -> 2026, 8. Sin `Date`, que en zonas horarias negativas retrocede un dia. */
function partes(fecha: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fecha.split('-').map(Number) as [number, number, number];
  return { anio, mes, dia };
}

/**
 * Cuantos meses han pasado desde el inicio del ciclo hasta esa fecha.
 *
 * Puede ser negativo (una fecha anterior al ciclo) o >= 12 (posterior). Quien
 * llama decide que hacer con eso; aqui no se recorta en silencio.
 */
function mesesDesdeElInicio(fecha: string, inicioDelCiclo: string): number {
  const f = partes(fecha);
  const i = partes(inicioDelCiclo);
  return (f.anio - i.anio) * 12 + (f.mes - i.mes);
}

/**
 * En que periodo cae una fecha, dado el ciclo escolar y la periodicidad.
 *
 * Devuelve `null` cuando la fecha queda fuera del ciclo: es informacion, no un
 * error que haya que atrapar. Generar cargos de un mes anterior al arranque del
 * ciclo es una peticion legitima que sencillamente no produce nada.
 */
export function periodoDeFecha(
  fecha: string,
  periodicidad: Periodicidad,
  inicioDelCiclo: string,
): string | null {
  if (periodicidad === 'MENSUAL') return fecha.slice(0, 7);

  const transcurridos = mesesDesdeElInicio(fecha, inicioDelCiclo);
  if (transcurridos < 0 || transcurridos >= 12) return null;

  const anioDelCiclo = partes(inicioDelCiclo).anio;
  if (periodicidad === 'UNICO' || periodicidad === 'ANUAL') {
    return `${anioDelCiclo}-A1`;
  }

  const indice = Math.floor(transcurridos / MESES_POR_PERIODO[periodicidad]) + 1;
  return `${anioDelCiclo}-${LETRA[periodicidad]}${indice}`;
}

/**
 * Los meses calendario que abarca un periodo, en orden.
 *
 * Es lo que el prorrateo necesita: para cobrar la parte proporcional de un
 * semestre a quien se inscribe a mitad, hay que saber de cuantos meses se
 * compone y cuales son.
 */
export function mesesDelPeriodo(clave: string, inicioDelCiclo: string): string[] {
  if (RE_MENSUAL.test(clave)) return [clave];

  const m = RE_CICLICO.exec(clave);
  if (!m) return [];

  const [, , letra, numero] = m as unknown as [string, string, string, string];
  const cuantos = letra === 'B' ? 2 : letra === 'C' ? 4 : letra === 'S' ? 6 : 12;
  const desplazamiento = (Number(numero) - 1) * cuantos;

  const i = partes(inicioDelCiclo);
  const meses: string[] = [];
  for (let n = 0; n < cuantos; n++) {
    // Aritmetica de meses a mano: `new Date(anio, mes+n)` con mes 12 salta de
    // año solo, pero tambien "resuelve" un dia 31 inexistente saltando al mes
    // siguiente. Aqui no hay dias, asi que se calcula directo y sin sorpresas.
    const total = i.mes - 1 + desplazamiento + n;
    const anio = i.anio + Math.floor(total / 12);
    const mes = (total % 12) + 1;
    meses.push(`${anio}-${String(mes).padStart(2, '0')}`);
  }
  return meses;
}

/** El primer mes calendario de un periodo. Es donde vence, salvo que se diga otra cosa. */
export function primerMes(clave: string, inicioDelCiclo: string): string {
  return mesesDelPeriodo(clave, inicioDelCiclo)[0] ?? clave;
}

/**
 * Nombre legible del periodo, para la pantalla.
 *
 * La familia no lee `2026-S1`. Y la escuela tampoco deberia tener que
 * traducirlo mentalmente cada vez que mira el panel de morosidad.
 */
export function periodoLegible(clave: string): string {
  if (RE_MENSUAL.test(clave)) return clave;

  const m = RE_CICLICO.exec(clave);
  if (!m) return clave;

  const [, anio, letra, numero] = m as unknown as [string, string, string, string];
  const nombre =
    letra === 'B'
      ? `${numero}º bimestre`
      : letra === 'C'
        ? `${numero}º cuatrimestre`
        : letra === 'S'
          ? `${numero}º semestre`
          : 'ciclo completo';
  return `${nombre} ${anio}`;
}
