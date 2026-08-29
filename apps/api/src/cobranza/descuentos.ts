/**
 * Becas y descuentos (AZ-M4.3a / AZ-M4.3b).
 *
 * MODULO PURO: centavos enteros, sin base de datos, sin reloj propio (§43).
 *
 * POR QUE ESTO NO ES UN CAMPO EN EL CARGO. Un cargo con `monto: 2205` y nada
 * mas no puede contestar "¿por que 2205 y no 2450?". El cargo conserva su
 * **precio de lista** y cada beca o descuento se registra como un **asiento**
 * encima, igual que un pago (§48). Asi el estado de cuenta puede mostrar el
 * renglon —"beca de hermanos, −245"— y la escuela puede demostrar cuanto beco.
 *
 * Y demostrarlo no es una comodidad: la beca del 5 % de la matricula es una
 * **obligacion legal** (Ley General de Educacion art. 149-III y Ley General de
 * Educacion Superior art. 70), no un descuento comercial. Una autoridad puede
 * pedir la prueba, y "el monto del cargo ya venia rebajado" no es prueba.
 *
 * ============================================================================
 * EL ORDEN DE APLICACION, DECLARADO Y PROBADO
 * ============================================================================
 * Se aplica **beca primero, descuento despues, y cada uno sobre lo que quedo**.
 *
 * No es arbitrario y no es gratis elegirlo: con una beca del 50 % y un pronto
 * pago del 10 %, en cascada la familia paga 45 % del precio de lista; sumando
 * los porcentajes pagaria 40 %. Sobre una colegiatura de 2,450 son 122.50 pesos
 * de diferencia AL MES. Lo que hace daño no es elegir mal, es no elegir: dos
 * partes del sistema calculando distinto producen el corte que no cuadra y que
 * nadie sabe explicar en marzo.
 *
 * Se elige cascada con la beca primero porque es como lo hacen las escuelas: el
 * pronto pago premia pagar a tiempo **lo que te toca pagar**, y lo que te toca
 * ya viene con tu beca aplicada.
 */

export type TipoDescuento = 'PORCENTAJE' | 'MONTO_FIJO';

/**
 * A que familia pertenece el descuento. Decide el ORDEN de aplicacion, y por
 * eso es un dato y no un comentario.
 */
export type CategoriaDescuento = 'BECA' | 'DESCUENTO';

const ORDEN: Record<CategoriaDescuento, number> = { BECA: 0, DESCUENTO: 1 };

export interface DescuentoAplicable {
  /// Identificador opaco. A este modulo no le importa si es una beca, un pronto
  /// pago o un convenio: solo lo ordena y lo resta.
  referencia: string;
  categoria: CategoriaDescuento;
  tipo: TipoDescuento;
  /// Porcentaje con hasta dos decimales (50 = 50 %), o centavos si es MONTO_FIJO.
  valor: number;
  /// Texto para el estado de cuenta: "Beca de hermanos", "Pronto pago".
  concepto: string;
}

export interface DescuentoCalculado {
  referencia: string;
  concepto: string;
  centavos: number;
}

export interface ResultadoDescuentos {
  aplicados: DescuentoCalculado[];
  totalCentavos: number;
  /// Lo que la familia debe de verdad. Nunca negativo.
  netoCentavos: number;
}

export class BecaInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'BecaInvalidaError';
  }
}

/**
 * Valida un porcentaje ANTES de que llegue a un cargo.
 *
 * Una beca del 120 % no es un descuento: es la escuela pagandole al alumno por
 * venir. Se rechaza al capturarla, no al generar el cargo, porque para entonces
 * ya hay cuatrocientas familias con el importe equivocado.
 */
export function validarPorcentaje(valor: number): void {
  if (!(valor > 0) || valor > 100) {
    throw new BecaInvalidaError(
      `Un porcentaje de descuento va entre 0 y 100, y llegó ${valor}. ` +
        `Si quieres condonar el cargo completo, usa 100.`,
    );
  }
}

/**
 * Aplica becas y descuentos a un importe, en el orden declarado.
 *
 * REGLAS QUE ESTA FUNCION SOSTIENE, todas probadas:
 *   1. Beca antes que descuento; dentro de la misma categoria, por referencia,
 *      para que dos corridas den exactamente lo mismo.
 *   2. Cada porcentaje se calcula sobre **lo que queda**, no sobre el precio de
 *      lista: es la cascada declarada arriba.
 *   3. El neto NUNCA es negativo. Un descuento que se pasaria se recorta a lo
 *      que queda, y el asiento registra lo que de verdad se aplico — no lo que
 *      pretendia. Guardar la intencion produciria un total de descuentos que no
 *      cuadra con la diferencia de importes.
 *   4. Redondeo al centavo, medio hacia arriba. El mismo criterio que el
 *      recargo (§43): uno solo, escrito, en todo el sistema.
 */
export function calcularDescuentos(
  baseCentavos: number,
  descuentos: DescuentoAplicable[],
): ResultadoDescuentos {
  const base = Math.max(0, Math.trunc(baseCentavos));

  const enOrden = [...descuentos].sort(
    (a, b) => ORDEN[a.categoria] - ORDEN[b.categoria] || a.referencia.localeCompare(b.referencia),
  );

  const aplicados: DescuentoCalculado[] = [];
  let restante = base;

  for (const d of enOrden) {
    if (restante <= 0) break;

    const pretendido =
      d.tipo === 'PORCENTAJE'
        ? Math.round((restante * Math.round(d.valor * 100)) / 10_000)
        : Math.max(0, Math.trunc(d.valor));

    // Recorte al remanente: ver regla 3.
    const centavos = Math.min(pretendido, restante);
    if (centavos <= 0) continue;

    aplicados.push({ referencia: d.referencia, concepto: d.concepto, centavos });
    restante -= centavos;
  }

  const total = aplicados.reduce((a, x) => a + x.centavos, 0);
  return { aplicados, totalCentavos: total, netoCentavos: base - total };
}

// ---------------------------------------------------------------------------
// Vigencia
// ---------------------------------------------------------------------------

export interface ConVigencia {
  vigenteDesde: string;
  /// Null = sin fecha de fin. Una beca permanente es legitima; una beca que
  /// nadie se acuerda de quitar, no.
  vigenteHasta: string | null;
}

/**
 * ¿La beca esta vigente en esa fecha?
 *
 * POR QUE LA VIGENCIA VIVE EN LA BECA Y NO EN EL ALUMNO: una beca que expira a
 * mitad del ciclo tiene que dejar de aplicarse **sola** en el siguiente periodo
 * generado. Si dependiera de que alguien la desactive a mano, la escuela seguiria
 * becando meses de mas — y esa es la clase de fuga que nadie detecta hasta la
 * auditoria anual.
 *
 * Los dos extremos son INCLUSIVOS: una beca vigente "hasta el 31 de diciembre"
 * cubre el 31 de diciembre. Excluir el ultimo dia es la interpretacion que
 * genera la llamada a soporte.
 */
export function estaVigente(beca: ConVigencia, fecha: string): boolean {
  if (fecha < beca.vigenteDesde) return false;
  if (beca.vigenteHasta !== null && fecha > beca.vigenteHasta) return false;
  return true;
}

/**
 * Las becas que aplican a un cargo concreto.
 *
 * Se filtra por vigencia **y** por alcance: una beca puede ser de toda la
 * colegiatura o de un concepto en particular (`conceptoId`). El alcance nulo
 * significa "todos los conceptos", igual que en el catalogo.
 */
export function becasAplicables<T extends ConVigencia & { conceptoId: string | null }>(
  becas: T[],
  entrada: { conceptoId: string; fecha: string },
): T[] {
  return becas.filter(
    (b) =>
      estaVigente(b, entrada.fecha) &&
      (b.conceptoId === null || b.conceptoId === entrada.conceptoId),
  );
}
