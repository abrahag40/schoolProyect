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
 * **Prorrateo, luego beca, luego descuento — y cada uno sobre lo que quedo.**
 * El prorrateo abre la fila porque no es un descuento: fija el precio real de
 * lo que se cobra. El detalle de por que, en el comentario de `ORDEN`.
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
export type CategoriaDescuento = 'PRORRATEO' | 'BECA' | 'DESCUENTO';

/**
 * El orden de aplicacion, y por que este.
 *
 * PRORRATEO va primero porque no es un descuento: es el **precio real** de lo
 * que se esta cobrando. Un alumno que entra el 17 de agosto no debe medio mes
 * de colegiatura con beca: debe la beca sobre el medio mes. Aplicar la beca
 * antes del prorrateo becaria dias que el alumno no estuvo.
 *
 * BECA antes que DESCUENTO por la razon del comentario de cabecera: el pronto
 * pago premia pagar a tiempo lo que te toca, y lo que te toca ya viene con tu
 * beca aplicada.
 */
const ORDEN: Record<CategoriaDescuento, number> = { PRORRATEO: 0, BECA: 1, DESCUENTO: 2 };

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
// Prorrateo por alta a mitad de periodo (AZ-M4.1)
// ---------------------------------------------------------------------------

/**
 * Que proporcion del periodo alcanza a cubrir quien se da de alta a mitad.
 *
 * SE CUENTA EN DIAS, NO EN MESES, y la razon es que los meses no duran lo
 * mismo: prorratear "medio semestre" cuando alguien entra el 15 de octubre
 * daria un numero distinto segun se cuente octubre completo o no. Los dias son
 * la unidad que no admite dos interpretaciones.
 *
 * Los dos extremos cuentan: quien entra el ultimo dia del periodo debe un dia,
 * no cero. Y quien entra antes de que empiece debe el periodo completo — no se
 * le cobra de mas por haberse inscrito temprano.
 *
 * ============================================================================
 * EL CASO PELIGROSO: UN ALTA POSTERIOR AL PERIODO NO PRORRATEA
 * ============================================================================
 * Si la fecha de alta cae DESPUES de que el periodo termino, se cobra el
 * periodo COMPLETO. Parece al reves y no lo es.
 *
 * La fecha de alta es cuando el alumno entro **a nuestro sistema**, que no es
 * lo mismo que cuando entro a la escuela. Una escuela que migra a Azahar en
 * noviembre y genera los cargos de agosto a octubre tiene a todos sus alumnos
 * con alta de noviembre. Prorratear ahi dejaria los tres meses en CERO, la
 * escuela no lo notaria hasta el corte, y habria perdido un trimestre de
 * ingresos sin un solo mensaje de error.
 *
 * El error contrario —cobrarle un periodo anterior a quien de verdad llego
 * tarde— es visible el mismo dia: la familia reclama y la escuela cancela el
 * cargo. Entre un fallo silencioso que cuesta dinero y uno ruidoso que se
 * corrige en un minuto, se elige el ruidoso.
 *
 * Devuelve el numerador y el denominador en vez de una fraccion decimal, porque
 * un `0.5333333` multiplicado por centavos vuelve a meter punto flotante en el
 * dinero por la puerta de atras (§43).
 */
export function proporcionDelPeriodo(entrada: {
  altaEn: string;
  inicioDelPeriodo: string;
  finDelPeriodo: string;
}): { diasCubiertos: number; diasTotales: number } {
  const dia = 86_400_000;
  const inicio = Date.parse(`${entrada.inicioDelPeriodo}T00:00:00Z`);
  const fin = Date.parse(`${entrada.finDelPeriodo}T00:00:00Z`);
  const alta = Date.parse(`${entrada.altaEn}T00:00:00Z`);

  const diasTotales = Math.round((fin - inicio) / dia) + 1;
  // Antes del periodo: completo. Despues del periodo: tambien completo, por la
  // razon del comentario de arriba. Solo se prorratea DENTRO del periodo.
  if (alta <= inicio || alta > fin) return { diasCubiertos: diasTotales, diasTotales };

  return { diasCubiertos: Math.round((fin - alta) / dia) + 1, diasTotales };
}

/**
 * Lo que se descuenta por los dias que el alumno NO estuvo.
 *
 * Se expresa como descuento y no como un importe distinto para que el estado de
 * cuenta pueda ensenar el renglon: "Colegiatura 2,450 · Prorrateo por alta el
 * 17 de agosto −1,185". Un cargo que simplemente dijera 1,265 obligaria a la
 * familia a llamar para entender por que no son 2,450.
 */
export function descuentoPorProrrateo(
  baseCentavos: number,
  proporcion: { diasCubiertos: number; diasTotales: number },
): number {
  if (proporcion.diasTotales <= 0) return 0;
  if (proporcion.diasCubiertos >= proporcion.diasTotales) return 0;
  const aCobrar = Math.round((baseCentavos * proporcion.diasCubiertos) / proporcion.diasTotales);
  return Math.max(0, baseCentavos - aCobrar);
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
