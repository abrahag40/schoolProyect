import { conTenant } from '@azahar/db';
import { aCentavos, aMonto } from './reglas.js';
import {
  aplicarSaldoAFavor,
  saldoDeParte,
  type ParteAbierta,
  type PagoConSobrante,
} from './saldos.js';

type Transaccion = Parameters<Parameters<typeof conTenant>[1]>[0];

export interface ResultadoAplicacionAutomatica {
  /// Personas cuyo saldo a favor se movio. Cero es el caso normal.
  tutores: number;
  /// Asientos creados.
  aplicaciones: number;
  /// Lo que dejo de estar a favor porque ya se aplico a deuda.
  aplicado: string;
}

/**
 * Aplica el saldo a favor pendiente a las partes abiertas del tenant (AZ-M4.10).
 *
 * POR QUE ESTA FUNCION EXISTE. El Sprint 5 dejo el sobrante de un pago
 * registrado, visible y **quieto**. La app de la familia decia "se aplicará al
 * próximo cargo" y el proximo cargo se generaba intacto. El estudio de cobranza
 * lo confirmo contra fuente primaria: el reglamento de pagos de la UPAEP da por
 * sentado que el pago adelantado se acredita contra el total del periodo, y
 * brightwheel modela el credito como una transaccion del ledger que se aplica
 * sola a los cargos que vienen. Nosotros teniamos el asiento y no el
 * automatismo.
 *
 * CUANDO CORRE: al terminar de generar los cargos de un periodo, dentro de la
 * misma transaccion. Es el unico momento en que aparece deuda nueva, que es lo
 * unico que puede consumir un saldo a favor.
 *
 * ES IDEMPOTENTE POR CONSTRUCCION: solo mira pagos cuyo sobrante sigue siendo
 * mayor que cero, y ese sobrante se deriva de lo ya aplicado. Correrla dos
 * veces seguidas no mueve un peso la segunda vez.
 *
 * LO QUE NO HACE: no toca cargos cancelados, no toca conceptos marcados como
 * `aceptaSaldoAFavor = false`, y no reabre nada del pasado — solo crea asientos
 * contra partes que hoy siguen abiertas.
 *
 * CASO CONOCIDO QUE NO CUBRE: si la escuela cambia un concepto de "no acepta
 * saldo a favor" a "si acepta", los cargos ya emitidos de ese concepto no se
 * saldan hasta la siguiente generacion. Se acepta porque la alternativa
 * —escuchar cambios del catalogo para disparar aplicaciones de dinero— es
 * mucha maquinaria para un caso que se resuelve registrando el pago a mano.
 */
export async function aplicarSaldoAFavorPendiente(
  tx: Transaccion,
  entrada: { tenantId: string; actorId: string | null },
): Promise<ResultadoAplicacionAutomatica> {
  // 1 · De quien hay dinero sin aplicar. El sobrante se DERIVA (§47).
  const pagos = await tx.pago.findMany({
    where: { canceladoEn: null },
    include: { aplicaciones: true },
  });

  const creditoPorTutor = new Map<string, PagoConSobrante[]>();
  for (const pago of pagos) {
    const aplicado = pago.aplicaciones.reduce((a, x) => a + aCentavos(x.monto.toFixed(2)), 0);
    const sobrante = aCentavos(pago.monto.toFixed(2)) - aplicado;
    if (sobrante <= 0) continue;

    const lista = creditoPorTutor.get(pago.tutorId) ?? [];
    lista.push({
      pagoId: pago.id,
      fecha: pago.fecha.toISOString().slice(0, 10),
      sobranteCentavos: sobrante,
    });
    creditoPorTutor.set(pago.tutorId, lista);
  }

  if (creditoPorTutor.size === 0) {
    return { tutores: 0, aplicaciones: 0, aplicado: '0.00' };
  }

  // 2 · Contra que se puede aplicar. El filtro por concepto es la bandera que
  //     el estudio tomo de GES Educativo: no todo cargo debe poder consumir el
  //     dinero que la familia dejo a cuenta.
  const partes = await tx.parteDeCargo.findMany({
    where: {
      tutorId: { in: [...creditoPorTutor.keys()] },
      cargo: {
        estado: { not: 'CANCELADO' },
        concepto: { aceptaSaldoAFavor: true },
      },
    },
    include: { cargo: true, aplicaciones: true },
  });

  const abiertasPorTutor = new Map<string, ParteAbierta[]>();
  for (const parte of partes) {
    const aplicado = parte.aplicaciones.reduce((a, x) => a + aCentavos(x.monto.toFixed(2)), 0);
    const saldo = saldoDeParte(aCentavos(parte.monto.toFixed(2)), aplicado);
    if (saldo <= 0) continue;

    const lista = abiertasPorTutor.get(parte.tutorId) ?? [];
    lista.push({
      referencia: parte.id,
      vence: parte.cargo.fechaVencimiento.toISOString().slice(0, 10),
      saldoCentavos: saldo,
    });
    abiertasPorTutor.set(parte.tutorId, lista);
  }

  // 3 · La aritmetica, en el modulo puro. Aqui solo se escribe.
  const asientos: Array<{ pagoId: string; parteDeCargoId: string; monto: string }> = [];
  let aplicadoCentavos = 0;
  let tutoresAlcanzados = 0;

  for (const [tutorId, creditos] of creditoPorTutor) {
    const abiertas = abiertasPorTutor.get(tutorId);
    if (!abiertas || abiertas.length === 0) continue;

    const { aplicaciones } = aplicarSaldoAFavor(creditos, abiertas);
    if (aplicaciones.length === 0) continue;

    tutoresAlcanzados++;
    for (const a of aplicaciones) {
      asientos.push({ pagoId: a.pagoId, parteDeCargoId: a.referencia, monto: aMonto(a.centavos) });
      aplicadoCentavos += a.centavos;
    }
  }

  if (asientos.length === 0) {
    return { tutores: 0, aplicaciones: 0, aplicado: '0.00' };
  }

  // SIN `skipDuplicates` a proposito. La combinacion (pago, parte) es unica en
  // la base, y aqui no puede repetirse: un pago solo llega con sobrante cuando
  // ya no le quedaba deuda que saldar, asi que nunca vuelve a la misma parte.
  // Si algun dia choca, es un defecto de esta funcion — y silenciarlo dejaria
  // dinero aplicado a medias sin que nadie se entere.
  await tx.aplicacionDePago.createMany({
    data: asientos.map((a) => ({ tenantId: entrada.tenantId, ...a })),
  });

  await tx.eventoAuditoria.create({
    data: {
      tenantId: entrada.tenantId,
      actorId: entrada.actorId,
      tipo: 'cobranza.saldo_a_favor_aplicado',
      entidad: 'aplicacion_de_pago',
      datos: {
        tutores: tutoresAlcanzados,
        aplicaciones: asientos.length,
        aplicado: aMonto(aplicadoCentavos),
      },
    },
  });

  return {
    tutores: tutoresAlcanzados,
    aplicaciones: asientos.length,
    aplicado: aMonto(aplicadoCentavos),
  };
}
