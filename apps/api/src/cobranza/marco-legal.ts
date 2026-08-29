/**
 * A QUIEN obliga cada regla de cobranza (§51, §52).
 *
 * MODULO PURO. Aqui vive una sola pregunta, y es la que estabamos contestando
 * mal: **¿a este tenant lo alcanza la ley que le estamos aplicando?**
 *
 * EL DEFECTO QUE ESTE ARCHIVO CIERRA. Desde el Sprint 4 el dominio impone a
 * TODOS los tenants el Acuerdo que establece las bases minimas de informacion
 * para la comercializacion de los servicios educativos que prestan los
 * particulares (DOF 10-mar-1992, vigilancia de PROFECO). Su articulo 1 acota el
 * ambito a los particulares que imparten educacion **con reconocimiento de
 * validez oficial en los niveles basico y normal**. Una universidad no esta
 * ahi; una academia deportiva o un taller de idiomas sin incorporacion, tampoco.
 *
 * Aplicarles la ley "por si acaso" suena prudente y no lo es. Le impone a un
 * cliente una ventana de gracia, un aviso de 60 dias y un umbral de suspension
 * que su contrato no tiene por que respetar, y encima le dice en pantalla que
 * es la ley. Eso es informacion falsa sobre su obligacion legal. §51: cuando
 * una ley acota al negocio, el limite vive en el dominio — y el dominio tiene
 * que saber tambien A QUIEN acota.
 *
 * LO QUE ESTE MODULO NO HACE: no relaja nada para los tenants cubiertos. Para
 * un COLEGIO todo sigue exactamente igual que en el Sprint 4.
 */

/** Los verticales del producto. Se declara aqui para no acoplar el modulo puro
 *  al cliente generado de la base (§28 en espiritu: el dominio no importa Prisma). */
export type Vertical =
  'COLEGIO' | 'UNIVERSIDAD' | 'ACADEMIA_DEPORTIVA' | 'ESCUELA_IDIOMAS' | 'TALLER';

/** Piso legal del Articulo 4: diez dias naturales sin recargo. */
export const DIAS_GRACIA_MINIMOS = 10;

/** Articulo 5, fraccion I: aviso de ajuste de cuotas. */
export const DIAS_AVISO_AJUSTE = 60;

/** Articulo 7: colegiaturas impagas que habilitan a suspender el servicio. */
export const PERIODOS_PARA_SUSPENDER = 3;

/**
 * ¿Al tenant lo alcanza el Acuerdo de PROFECO?
 *
 * INFERENCIA PROPIA, MARCADA COMO TAL: el mapeo vertical -> ambito es nuestra
 * lectura, no un texto de la norma. La norma habla de niveles educativos con
 * RVOE; nosotros modelamos verticales. COLEGIO es el vertical que en este
 * producto significa educacion basica incorporada, y por eso es el unico que
 * queda dentro.
 *
 * El dia que exista una academia con RVOE de educacion basica —posible— este
 * mapeo se queda corto y habra que preguntar por el RVOE del plantel y no por
 * el vertical. Queda escrito para que quien lo encuentre sepa que fue una
 * decision y no un descuido.
 */
export function aplicaAcuerdoProfeco(vertical: Vertical): boolean {
  return vertical === 'COLEGIO';
}

/**
 * Dias minimos sin recargo que el dominio IMPONE a este tenant.
 *
 * Cero no significa "cobra recargo desde el dia uno": significa que la ley no
 * fija un piso y manda lo que la escuela configure. Un colegio no puede bajar
 * de diez ni queriendo; una universidad decide su ventana en su reglamento —
 * el de la UPAEP, por ejemplo, da dieciseis dias naturales, mas generoso que el
 * piso legal que no le aplica.
 */
export function pisoDeGracia(vertical: Vertical): number {
  return aplicaAcuerdoProfeco(vertical) ? DIAS_GRACIA_MINIMOS : 0;
}

/** Dias de anticipacion exigidos para subir un precio. Cero = lo rige el contrato. */
export function diasDeAvisoExigidos(vertical: Vertical): number {
  return aplicaAcuerdoProfeco(vertical) ? DIAS_AVISO_AJUSTE : 0;
}

// ---------------------------------------------------------------------------
// Avisos fiscales al que paga (AZ-M4.5b)
// ---------------------------------------------------------------------------

/**
 * Lo que la familia deberia saber ANTES de pagar, y que ningun sistema revisado
 * le dice.
 *
 * DATO DURO: el Decreto que otorga el estimulo fiscal por pagos de servicios
 * educativos (DOF 26-dic-2013, articulo 1.9) condiciona la deducibilidad a que
 * el pago se haga con cheque nominativo, transferencia, tarjeta de credito, de
 * debito o de servicios. **El efectivo no es deducible**, aunque el CFDI se
 * emita correctamente.
 *
 * Cuesta una frase y le ahorra dinero real a la familia: una colegiatura de
 * primaria tiene un tope de deduccion anual de miles de pesos que se pierde
 * entera por pagar en la ventanilla equivocada. Que nadie lo haga es
 * precisamente la razon para hacerlo.
 */
export function avisosFiscales(entrada: { hayConceptosDeducibles: boolean }): string[] {
  if (!entrada.hayConceptosDeducibles) return [];
  return [
    'Estos pagos son deducibles de impuestos, pero solo si NO se pagan en ' +
      'efectivo: tienen que ir por transferencia, tarjeta o cheque nominativo.',
  ];
}
