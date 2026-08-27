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
import { PERIODOS_PARA_SUSPENDER } from './marco-legal.js';

// Se re-exporta para no romper a quien ya la importaba de aqui; su definicion
// vive con el resto del ambito legal (§51).
export { PERIODOS_PARA_SUSPENDER } from './marco-legal.js';

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
  /// Si este cargo ES una colegiatura. Lo declara el catalogo, no lo adivina
  /// este modulo: el comedor tambien se cobra cada mes y no es colegiatura.
  esColegiatura: boolean;
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
 *
 * DEFECTO CORREGIDO EN EL SPRINT 5 (§52). Hasta hoy esta funcion contaba
 * cualquier cargo vencido. Una excursion y un uniforme impagos en tres meses
 * distintos ponian a la familia en el umbral de suspension **sin deber una sola
 * colegiatura**, y el panel se lo decia al director como si fuera la ley. El
 * filtro por `esColegiatura` es toda la correccion, y es la unica lectura fiel
 * al texto: la ley cuenta colegiaturas, no adeudos.
 */
export function periodosEnMora(cargos: CargoParaMora[], hoy: string): number {
  const vencidos = new Set(
    cargos
      .filter((c) => c.esColegiatura)
      .filter((c) => c.saldoCentavos > 0 && hayRecargo(hoy, c.fechaLimiteSinRecargo))
      .map((c) => c.periodo),
  );
  return vencidos.size;
}

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

/**
 * Donde esta parada la escuela frente al Articulo 7.
 *
 * `aplicaElAcuerdo` viene de `aplicaAcuerdoProfeco(vertical)` (§51). Cuando es
 * `false` esta funcion NO inventa un umbral propio ni calla: dice que el limite
 * lo fija el contrato de esa institucion, porque afirmar "la ley te permite
 * suspender" a una universidad seria informarle mal sobre su propia obligacion.
 */
export function situacionLegal(
  cargos: CargoParaMora[],
  hoy: string,
  aplicaElAcuerdo = true,
): SituacionLegal {
  const meses = periodosEnMora(cargos, hoy);

  if (!aplicaElAcuerdo) {
    return {
      periodosEnMora: meses,
      // Nunca `true`: el sistema no puede afirmar que se permite suspender
      // cuando la regla que lo permitiria vive en un contrato que no leemos.
      puedeSuspender: false,
      explicacion:
        meses === 0
          ? 'Al corriente.'
          : `${meses} colegiatura(s) vencida(s). El Acuerdo de PROFECO no aplica a esta ` +
            `institución: lo que se puede hacer por falta de pago lo fija su reglamento.`,
    };
  }

  if (meses === 0) {
    return { periodosEnMora: 0, puedeSuspender: false, explicacion: 'Al corriente.' };
  }
  if (meses < PERIODOS_PARA_SUSPENDER) {
    const faltan = PERIODOS_PARA_SUSPENDER - meses;
    return {
      periodosEnMora: meses,
      puedeSuspender: false,
      explicacion:
        `${meses} colegiatura(s) vencida(s). La ley permite suspender el servicio a partir ` +
        `de ${PERIODOS_PARA_SUSPENDER}: falta(n) ${faltan}.`,
    };
  }
  return {
    periodosEnMora: meses,
    puedeSuspender: true,
    explicacion:
      `${meses} colegiaturas vencidas. La ley ya permite suspender el servicio, pero exige ` +
      `avisar con 15 días de anticipación, y el alumno conserva su derecho a la ` +
      `documentación oficial y a presentar exámenes.`,
  };
}

// ---------------------------------------------------------------------------
// Saldo a favor (AZ-M4.10)
// ---------------------------------------------------------------------------

/**
 * Un pago con dinero que todavia no se aplico a nada.
 *
 * El saldo a favor NO es una columna: es la resta entre lo que entro y lo que
 * se aplico (§47). Se modela por pago y no como un total porque cada centavo
 * que se aplique tiene que decir de QUE pago salio — sin eso, un pago cancelado
 * no se podria deshacer sin adivinar.
 */
export interface PagoConSobrante {
  pagoId: string;
  /// Fecha del pago (AAAA-MM-DD). El credito mas viejo se consume primero.
  fecha: string;
  sobranteCentavos: number;
}

export interface AplicacionDeCredito {
  pagoId: string;
  referencia: string;
  centavos: number;
}

/**
 * Aplica el saldo a favor de una persona a las partes que siguen abiertas.
 *
 * ESTE ES EL HUECO QUE EL ESTUDIO DE COBRANZA DESTAPO. Hasta hoy el sobrante de
 * un pago quedaba registrado y visible, y ahi se quedaba: cuando la escuela
 * generaba el cargo del mes siguiente, el dinero que la familia ya habia
 * entregado no lo tocaba. La app, mientras tanto, prometia que "se aplicará al
 * próximo cargo". Prometer algo que el sistema no hace es peor que no
 * ofrecerlo.
 *
 * DOS ORDENES, y los dos importan:
 *   - **Credito mas viejo primero**, porque es lo que hace cualquier libro
 *     contable y porque deja el rastro en el orden en que ocurrio.
 *   - **Deuda mas vieja primero**, por la misma razon que `aplicarPago`: los
 *     meses vencidos son lo que cuenta el Articulo 7, no los pesos.
 *
 * NUNCA REESCRIBE EL PASADO: genera asientos nuevos contra partes abiertas. Un
 * cargo ya saldado no se toca, y un cargo cancelado no llega hasta aqui.
 */
export function aplicarSaldoAFavor(
  pagos: PagoConSobrante[],
  partes: ParteAbierta[],
): { aplicaciones: AplicacionDeCredito[]; sinAplicarCentavos: number } {
  const creditos = [...pagos]
    .filter((p) => p.sobranteCentavos > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.pagoId.localeCompare(b.pagoId));

  // Copia mutable: cada credito consume de lo que dejo el anterior.
  const pendientes = partes
    .filter((p) => p.saldoCentavos > 0)
    .map((p) => ({ ...p }))
    .sort((a, b) => a.vence.localeCompare(b.vence) || a.referencia.localeCompare(b.referencia));

  const aplicaciones: AplicacionDeCredito[] = [];
  let sinAplicar = 0;

  for (const credito of creditos) {
    const { aplicaciones: hechas, sobranteCentavos } = aplicarPago(
      credito.sobranteCentavos,
      pendientes,
    );
    for (const hecha of hechas) {
      aplicaciones.push({ pagoId: credito.pagoId, ...hecha });
      const parte = pendientes.find((p) => p.referencia === hecha.referencia);
      if (parte) parte.saldoCentavos -= hecha.centavos;
    }
    sinAplicar += sobranteCentavos;
  }

  return { aplicaciones, sinAplicarCentavos: sinAplicar };
}

/**
 * ¿Se le puede devolver a la familia su saldo a favor?
 *
 * **No mientras deba algo vencido.** Devolver dinero a quien tiene una
 * colegiatura de agosto sin pagar es sacar de la caja de la escuela para
 * financiar una mora que ella misma esta contando.
 *
 * Cuando existe saldo a favor Y adeudo vencido a la vez, es porque el adeudo es
 * de un concepto que NO acepta saldo a favor — la unica forma de que la
 * aplicacion automatica no lo haya cubierto ya. Ese es exactamente el caso que
 * esta funcion protege.
 *
 * Devolver el veredicto y el motivo por separado: quien esta en caja necesita
 * poder decirle a la familia POR QUE, no solo que no.
 */
export function puedeDevolverse(
  saldoAFavorCentavos: number,
  cargos: CargoParaMora[],
  hoy: string,
): { permitido: boolean; motivo: string } {
  if (saldoAFavorCentavos <= 0) {
    return { permitido: false, motivo: 'No hay saldo a favor que devolver.' };
  }
  const vencidos = cargos.filter(
    (c) => c.saldoCentavos > 0 && hayRecargo(hoy, c.fechaLimiteSinRecargo),
  );
  if (vencidos.length > 0) {
    return {
      permitido: false,
      motivo:
        'Hay cargos vencidos sin pagar. El saldo a favor se aplica a esa deuda antes ' +
        'de poder devolverse.',
    };
  }
  return { permitido: true, motivo: 'Sin adeudo vencido.' };
}
