/**
 * Reglas de cobranza (AZ-M4.2 / AZ-M4.3 / AZ-M4.4).
 *
 * MODULO PURO: sin base de datos, sin red, sin reloj propio. Todo lo que varia
 * entra por parametro, para que el NO-camino —que NO se cobre recargo antes de
 * tiempo, que NO se pierda un centavo al repartir— se pueda probar sin montar
 * una escuela entera (§13).
 *
 * EL DINERO SE MANEJA EN CENTAVOS ENTEROS, NUNCA EN PUNTO FLOTANTE (§4).
 * `0.1 + 0.2` no es `0.3` en ningun lenguaje con IEEE-754, y un centavo perdido
 * por alumno por mes es una escuela llamando a soporte en marzo sin poder
 * explicar por que su corte no cuadra. La conversion a `Decimal` ocurre en la
 * frontera con la base de datos; aqui dentro solo hay enteros.
 *
 * NORMATIVA QUE ESTE ARCHIVO IMPLEMENTA — Acuerdo que establece las bases
 * minimas de informacion para la comercializacion de los servicios educativos
 * que prestan los particulares (DOF, 10-mar-1992; vigilancia de PROFECO):
 *   - Art. 4   -> los pagos de colegiatura se aceptan SIN CARGO durante los
 *                primeros diez dias naturales de cada mes.
 *   - Art. 5-I -> los ajustes de cuotas se informan con 60 dias de anticipacion.
 * Estan aqui y no en una casilla de configuracion a proposito: la escuela puede
 * ser mas generosa que la ley, nunca mas estricta.
 */

/** Piso legal del Articulo 4. No es un valor por omision: es un minimo. */
export const DIAS_GRACIA_MINIMOS = 10;

/** Articulo 5, fraccion I. */
export const DIAS_AVISO_AJUSTE = 60;

export class RepartoInvalidoError extends Error {
  constructor(sumaPorcentajes: number) {
    super(
      `Los porcentajes de pago suman ${sumaPorcentajes} y deben sumar 100. ` +
        `Revisa los pagadores del alumno antes de generar sus cargos.`,
    );
    this.name = 'RepartoInvalidoError';
  }
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

const RE_PERIODO = /^\d{4}-(0[1-9]|1[0-2])$/;

export function esPeriodoValido(periodo: string): boolean {
  return RE_PERIODO.test(periodo);
}

/** Cuantos dias tiene ese mes. Resuelve febrero y los bisiestos sin tablas. */
export function diasDelMes(periodo: string): number {
  const [anio, mes] = periodo.split('-').map(Number) as [number, number];
  // Dia 0 del mes SIGUIENTE es el ultimo del actual.
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

/**
 * El dia `dia` de ese periodo, recortado al ultimo dia real del mes.
 *
 * El recorte no es un detalle: una escuela que cobra el dia 31 tendria un
 * vencimiento inexistente en febrero, abril, junio, septiembre y noviembre.
 * JavaScript lo "resolveria" saltando al mes siguiente en silencio, que es
 * peor que fallar.
 */
export function fechaDelPeriodo(periodo: string, dia: number): string {
  const limite = diasDelMes(periodo);
  const diaReal = Math.min(Math.max(1, Math.trunc(dia)), limite);
  return `${periodo}-${String(diaReal).padStart(2, '0')}`;
}

/**
 * Ultimo dia en que se acepta el pago SIN recargo.
 *
 * Es el maximo de tres cosas, y el orden importa:
 *   1. el dia de vencimiento que fijo la escuela — cobrar recargo antes de que
 *      algo venza no tiene sentido;
 *   2. los dias de gracia que la escuela quiera dar de mas;
 *   3. el piso del Articulo 4: el dia 10, siempre.
 * Una escuela puede ser mas generosa. Mas estricta que la ley, no.
 */
export function fechaLimiteSinRecargo(
  periodo: string,
  diaVencimiento: number,
  diasGraciaDeLaEscuela: number = DIAS_GRACIA_MINIMOS,
): string {
  const dia = Math.max(
    Math.trunc(diaVencimiento),
    Math.trunc(diasGraciaDeLaEscuela),
    DIAS_GRACIA_MINIMOS,
  );
  return fechaDelPeriodo(periodo, dia);
}

/** ¿Ya se puede cobrar recargo? Solo DESPUES del limite, nunca el mismo dia. */
export function hayRecargo(hoy: string, fechaLimiteSinRecargo: string): boolean {
  return hoy > fechaLimiteSinRecargo;
}

/**
 * Dias de anticipacion entre el aviso y la entrada en vigor de un ajuste.
 *
 * Devuelve el dato y el veredicto por separado: la pantalla necesita decirle a
 * la administracion CUANTOS dias faltan, no solo que no se puede.
 */
export function anticipacionDeAjuste(
  avisadoEn: string,
  vigenteDesde: string,
): { dias: number; suficiente: boolean } {
  const inicio = Date.parse(`${avisadoEn}T00:00:00Z`);
  const fin = Date.parse(`${vigenteDesde}T00:00:00Z`);
  const dias = Math.floor((fin - inicio) / 86_400_000);
  return { dias, suficiente: dias >= DIAS_AVISO_AJUSTE };
}

// ---------------------------------------------------------------------------
// Dinero
// ---------------------------------------------------------------------------

/** "2450.00" -> 245000. La frontera entre el Decimal de la base y este modulo. */
export function aCentavos(monto: string): number {
  const [entero = '0', decimales = ''] = monto.trim().split('.');
  const centavos = `${decimales}00`.slice(0, 2);
  const signo = entero.startsWith('-') ? -1 : 1;
  return signo * (Math.abs(Number(entero)) * 100 + Number(centavos));
}

/** 245000 -> "2450.00". Se devuelve cadena, no numero: lo consume un Decimal. */
export function aMonto(centavos: number): string {
  const signo = centavos < 0 ? '-' : '';
  const absoluto = Math.abs(Math.trunc(centavos));
  return `${signo}${Math.floor(absoluto / 100)}.${String(absoluto % 100).padStart(2, '0')}`;
}

/**
 * Recargo por mora, en centavos.
 *
 * Redondeo al centavo mas cercano, con el medio hacia arriba. Se documenta
 * porque el criterio de redondeo tiene que ser UNO y estar escrito: dos partes
 * del sistema redondeando distinto es como aparecen las diferencias que nadie
 * sabe explicar.
 */
export function calcularRecargo(montoCentavos: number, porcentaje: number): number {
  const puntosBase = Math.round(porcentaje * 100); // 3.5% -> 350
  return Math.round((montoCentavos * puntosBase) / 10_000);
}

export interface Pagador {
  /// Identificador de quien paga. Este modulo no sabe ni le importa si es un
  /// tutor, una empresa o una beca: solo reparte.
  referencia: string;
  /// Porcentaje con hasta dos decimales. Entre todos deben sumar 100.
  porcentaje: number;
}

export interface Parte {
  referencia: string;
  centavos: number;
}

/**
 * Reparte un importe entre varios pagadores SIN perder ni inventar centavos.
 *
 * Metodo del resto mayor: se asigna la parte entera a cada quien y el sobrante
 * va, de a un centavo, a quienes tengan el resto mas grande; los empates se
 * rompen por orden de llegada, para que el resultado sea reproducible.
 *
 * POR QUE NO SE REDONDEA CADA PARTE POR SEPARADO —el camino obvio—: repartir
 * 100.00 en tres partes iguales daria 33.33 tres veces, y 99.99 no es 100.00.
 * Ese centavo perdido reaparece meses despues como "el corte no cuadra", y para
 * entonces nadie asocia el sintoma con su causa.
 *
 * INVARIANTE, y esta probada: la suma de las partes es EXACTAMENTE el total.
 */
export function repartir(totalCentavos: number, pagadores: Pagador[]): Parte[] {
  if (pagadores.length === 0) return [];

  const puntosBase = pagadores.map((p) => Math.round(p.porcentaje * 100));
  const suma = puntosBase.reduce((a, b) => a + b, 0);
  if (suma !== 10_000) {
    // Falla ruidosamente. Un alumno cuyos pagadores suman 90% cobraria de menos
    // todos los meses, y ese error se descubre en la auditoria anual.
    throw new RepartoInvalidoError(suma / 100);
  }

  const partes = pagadores.map((p, indice) => {
    const numerador = totalCentavos * puntosBase[indice]!;
    return {
      referencia: p.referencia,
      centavos: Math.floor(numerador / 10_000),
      resto: numerador % 10_000,
      indice,
    };
  });

  const repartido = partes.reduce((a, p) => a + p.centavos, 0);
  let sobrante = totalCentavos - repartido;

  // Mayor resto primero; empate, el que llego antes. Determinista a proposito:
  // el mismo cargo repartido dos veces debe dar el mismo resultado.
  const porResto = [...partes].sort((a, b) => b.resto - a.resto || a.indice - b.indice);
  for (const parte of porResto) {
    if (sobrante <= 0) break;
    parte.centavos += 1;
    sobrante -= 1;
  }

  return partes.map(({ referencia, centavos }) => ({ referencia, centavos }));
}

// ---------------------------------------------------------------------------
// Identidad de un cargo
// ---------------------------------------------------------------------------

/**
 * Clave de idempotencia de un cargo (§15).
 *
 * Un alumno, un concepto, un periodo: una sola vez. La unicidad la impone la
 * base de datos con esta clave, no la aplicacion — dos administradores dando
 * clic a la vez no pueden generar el cargo dos veces, por rapido que corran.
 */
export function claveDeCargo(alumnoId: string, conceptoId: string, periodo: string): string {
  return `${alumnoId}:${conceptoId}:${periodo}`;
}

/** "2026-09-14" -> "2026-09". El periodo de cobro al que pertenece una fecha. */
export function periodoDe(fecha: string): string {
  return fecha.slice(0, 7);
}
