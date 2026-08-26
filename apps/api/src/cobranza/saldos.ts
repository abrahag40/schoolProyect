/**
 * Saldos, aplicacion de pagos y morosidad (AZ-M4.5 / AZ-M4.8 / AZ-M4.9).
 *
 * MODULO PURO, como `reglas.ts`: enteros de centavos, sin base de datos, sin
 * red y sin reloj propio. Aqui vive la aritmetica que decide cuanto debe una
 * familia — el numero que un padre mira antes de pagar y que un director mira
 * antes de llamar. Si esto se equivoca, se equivoca en pesos.
 *
 * LA IDEA CENTRAL: **el saldo se deriva, nunca se guarda.**
 * Un cargo no cambia de importe cuando alguien paga; se registra el pago y se
 * aplica, y lo que falta es una resta. Guardar el saldo como columna obligaria
 * a mantenerlo sincronizado con cada abono, y el dia que la columna y la suma
 * difieran nadie sabria cual de las dos creer.
 */
import { calcularRecargo, hayRecargo } from './reglas.js';

// ---------------------------------------------------------------------------
// Saldo
// ---------------------------------------------------------------------------

/** Lo que falta por pagar de una parte. Nunca negativo: sobrepagar no genera deuda inversa. */
export function saldoDeParte(importeCentavos: number, aplicadoCentavos: number): number {
  return Math.max(0, importeCentavos - aplicadoCentavos);
}

export interface ParteAbierta {
  /// Identificador opaco. A este modulo no le importa si es una parte de cargo
  /// o cualquier otra cosa: solo la ordena y la salda.
  referencia: string;
  /// Fecha de vencimiento (AAAA-MM-DD). Es el criterio de orden.
  vence: string;
  saldoCentavos: number;
}

export interface Aplicacion {
  referencia: string;
  centavos: number;
}

export interface ResultadoAplicacion {
  aplicaciones: Aplicacion[];
  /// Lo que el pago NO alcanzo a aplicar porque ya no habia deuda. No se
  /// pierde ni se rechaza: queda como saldo a favor de la familia, que es lo
  /// que pasa de verdad cuando alguien paga por adelantado.
  sobranteCentavos: number;
}

/**
 * Aplica un pago a las partes abiertas, **lo mas viejo primero**.
 *
 * Por que FIFO y no "lo que el padre elija": porque saldar primero lo mas
 * antiguo es lo que reduce los meses de mora, y los meses —no los pesos— son
 * lo que el Articulo 7 del Acuerdo de PROFECO cuenta para decidir si la escuela
 * puede suspender el servicio. Pagar el mes corriente y dejar agosto abierto
 * mantiene a la familia en riesgo aunque haya pagado lo mismo.
 *
 * El empate por fecha se rompe por referencia, para que el resultado sea
 * reproducible: aplicar dos veces el mismo pago da exactamente lo mismo.
 */
export function aplicarPago(montoCentavos: number, partes: ParteAbierta[]): ResultadoAplicacion {
  const abiertas = partes
    .filter((p) => p.saldoCentavos > 0)
    .sort((a, b) => a.vence.localeCompare(b.vence) || a.referencia.localeCompare(b.referencia));

  const aplicaciones: Aplicacion[] = [];
  let restante = Math.max(0, Math.trunc(montoCentavos));

  for (const parte of abiertas) {
    if (restante <= 0) break;
    const centavos = Math.min(restante, parte.saldoCentavos);
    aplicaciones.push({ referencia: parte.referencia, centavos });
    restante -= centavos;
  }

  return { aplicaciones, sobranteCentavos: restante };
}

// ---------------------------------------------------------------------------
// Mora
// ---------------------------------------------------------------------------

export interface CargoParaMora {
  /// Periodo de cobro AAAA-MM. Es lo que se cuenta para el Articulo 7: la ley
  /// habla de COLEGIATURAS, no de importes.
  periodo: string;
  saldoCentavos: number;
  fechaLimiteSinRecargo: string;
}

/**
 * Recargo aplicable HOY sobre un saldo.
 *
 * Devuelve cero mientras no se pase la fecha limite, que en cada cargo viene
 * congelada desde que se genero (Sprint 4) respetando el Articulo 4. No hay
 * forma de cobrarlo antes: el dato no lo permite.
 */
export function recargoAplicable(entrada: {
  saldoCentavos: number;
  fechaLimiteSinRecargo: string;
  hoy: string;
  porcentaje: number;
}): number {
  if (entrada.saldoCentavos <= 0) return 0;
  if (!hayRecargo(entrada.hoy, entrada.fechaLimiteSinRecargo)) return 0;
  return calcularRecargo(entrada.saldoCentavos, entrada.porcentaje);
}

/**
 * Cuantas COLEGIATURAS distintas estan vencidas e impagas.
 *
 * Se cuentan periodos, no cargos: un mes con colegiatura y comedor pendientes
 * es UN mes de atraso, no dos. Es la lectura correcta del Articulo 7, que habla
 * de "tres o mas colegiaturas, equivalentes a cuando menos tres meses".
 */
export function periodosEnMora(cargos: CargoParaMora[], hoy: string): number {
  const vencidos = new Set(
    cargos
      .filter((c) => c.saldoCentavos > 0 && hayRecargo(hoy, c.fechaLimiteSinRecargo))
      .map((c) => c.periodo),
  );
  return vencidos.size;
}

/** Umbral del Articulo 7: tres o mas colegiaturas impagas. */
export const PERIODOS_PARA_SUSPENDER = 3;

export interface SituacionLegal {
  periodosEnMora: number;
  /// Si la ley YA permite dejar de prestar el servicio. Nunca es automatico:
  /// el mismo Articulo 7 exige 15 dias de aviso previo, y las fracciones I y II
  /// conservan el derecho del alumno a su documentacion y a sus examenes.
  puedeSuspender: boolean;
  /// Texto para la pantalla. La escuela no deberia tener que recordar la ley:
  /// el sistema le dice donde esta parada.
  explicacion: string;
}

export function situacionLegal(cargos: CargoParaMora[], hoy: string): SituacionLegal {
  const meses = periodosEnMora(cargos, hoy);

  if (meses === 0) {
    return { periodosEnMora: 0, puedeSuspender: false, explicacion: 'Al corriente.' };
  }
  if (meses < PERIODOS_PARA_SUSPENDER) {
    const faltan = PERIODOS_PARA_SUSPENDER - meses;
    return {
      periodosEnMora: meses,
      puedeSuspender: false,
      explicacion:
        `${meses} mes(es) vencido(s). La ley permite suspender el servicio a partir de ` +
        `${PERIODOS_PARA_SUSPENDER}: falta(n) ${faltan}.`,
    };
  }
  return {
    periodosEnMora: meses,
    puedeSuspender: true,
    explicacion:
      `${meses} meses vencidos. La ley ya permite suspender el servicio, pero exige ` +
      `avisar con 15 días de anticipación, y el alumno conserva su derecho a la ` +
      `documentación oficial y a presentar exámenes.`,
  };
}
