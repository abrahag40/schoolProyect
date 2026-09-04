/**
 * Saldos, aplicacion de pagos y mora — probados sin base de datos (§13 capa 1).
 *
 * Los dos numeros que esta capa protege son los que un ser humano mira antes de
 * actuar: lo que un padre debe antes de pagar, y los meses de atraso que un
 * director mira antes de llamar. Equivocarse aqui no rompe una pantalla:
 * cobra de mas o suspende a un alumno antes de que la ley lo permita.
 */
import { describe, it, expect } from 'vitest';
import { aCentavos, fechaLimiteSinRecargo } from '../src/cobranza/reglas.js';
import {
  aplicarPago,
  aplicarPagoConProntoPago,
  aplicarSaldoAFavor,
  periodosEnMora,
  puedeDevolverse,
  recargoAplicable,
  saldoDeParte,
  situacionLegal,
  PERIODOS_PARA_SUSPENDER,
} from '../src/cobranza/saldos.js';
import {
  aplicaAcuerdoProfeco,
  avisosFiscales,
  diasDeAvisoExigidos,
  pisoDeGracia,
  DIAS_AVISO_AJUSTE,
  DIAS_GRACIA_MINIMOS,
} from '../src/cobranza/marco-legal.js';

describe('saldo derivado', () => {
  it('lo que falta es una resta, no una columna', () => {
    expect(saldoDeParte(147_000, 0)).toBe(147_000);
    expect(saldoDeParte(147_000, 100_000)).toBe(47_000);
    expect(saldoDeParte(147_000, 147_000)).toBe(0);
  });

  it('sobrepagar no genera deuda inversa', () => {
    // Un saldo negativo se leeria como "la escuela le debe al padre", y eso es
    // otro concepto (saldo a favor) que se deriva de los pagos, no de aqui.
    expect(saldoDeParte(147_000, 200_000)).toBe(0);
  });
});

describe('aplicacion de pagos: lo mas viejo primero', () => {
  const partes = [
    { referencia: 'sep', vence: '2026-09-05', saldoCentavos: aCentavos('2450.00') },
    { referencia: 'ago', vence: '2026-08-05', saldoCentavos: aCentavos('2450.00') },
    { referencia: 'oct', vence: '2026-10-05', saldoCentavos: aCentavos('2450.00') },
  ];

  it('un pago exacto salda el mes mas antiguo, no el corriente', () => {
    // Por que importa: el Articulo 7 cuenta MESES vencidos, no pesos. Pagar
    // octubre y dejar agosto abierto deja a la familia igual de expuesta.
    const { aplicaciones, sobranteCentavos } = aplicarPago(aCentavos('2450.00'), partes);
    expect(aplicaciones).toEqual([{ referencia: 'ago', centavos: 245_000 }]);
    expect(sobranteCentavos).toBe(0);
  });

  it('un pago parcial abona a lo mas viejo y deja el resto abierto', () => {
    const { aplicaciones } = aplicarPago(aCentavos('1000.00'), partes);
    expect(aplicaciones).toEqual([{ referencia: 'ago', centavos: 100_000 }]);
  });

  it('un pago grande recorre varios meses en orden', () => {
    const { aplicaciones, sobranteCentavos } = aplicarPago(aCentavos('5000.00'), partes);
    expect(aplicaciones).toEqual([
      { referencia: 'ago', centavos: 245_000 },
      { referencia: 'sep', centavos: 245_000 },
      { referencia: 'oct', centavos: 10_000 },
    ]);
    expect(sobranteCentavos).toBe(0);
  });

  it('pagar por adelantado deja SOBRANTE, no se pierde ni se rechaza', () => {
    // Es lo que pasa de verdad cuando una familia paga el año completo: queda
    // saldo a favor. Rechazarlo seria decirle a un cliente que paga de mas que
    // se equivoco.
    const { aplicaciones, sobranteCentavos } = aplicarPago(aCentavos('10000.00'), partes);
    expect(aplicaciones.reduce((a, x) => a + x.centavos, 0)).toBe(735_000);
    expect(sobranteCentavos).toBe(265_000);
  });

  it('INVARIANTE: lo aplicado nunca excede ni el pago ni la deuda', () => {
    const deuda = partes.reduce((a, p) => a + p.saldoCentavos, 0);
    for (let monto = 1; monto <= 1_000_000; monto += 7_919) {
      const { aplicaciones, sobranteCentavos } = aplicarPago(monto, partes);
      const aplicado = aplicaciones.reduce((a, x) => a + x.centavos, 0);

      expect(aplicado, `pago ${monto}: se aplico mas de lo pagado`).toBeLessThanOrEqual(monto);
      expect(aplicado, `pago ${monto}: se aplico mas de lo que se debe`).toBeLessThanOrEqual(deuda);
      expect(aplicado + sobranteCentavos, `pago ${monto}: se perdieron centavos`).toBe(monto);
      // Y ninguna parte recibe mas de lo que debia.
      for (const a of aplicaciones) {
        const parte = partes.find((p) => p.referencia === a.referencia)!;
        expect(a.centavos).toBeLessThanOrEqual(parte.saldoCentavos);
      }
    }
  });

  it('es determinista: el mismo pago aplicado dos veces da lo mismo', () => {
    expect(aplicarPago(aCentavos('3000.00'), partes)).toEqual(
      aplicarPago(aCentavos('3000.00'), partes),
    );
  });

  it('sin deuda abierta, todo el pago queda como sobrante (NO-camino)', () => {
    const saldadas = partes.map((p) => ({ ...p, saldoCentavos: 0 }));
    const { aplicaciones, sobranteCentavos } = aplicarPago(aCentavos('500.00'), saldadas);
    expect(aplicaciones).toEqual([]);
    expect(sobranteCentavos).toBe(50_000);
  });
});

describe('recargo por mora: el Articulo 4, otra vez', () => {
  const base = {
    saldoCentavos: aCentavos('2450.00'),
    fechaLimiteSinRecargo: '2026-09-10',
    porcentaje: 3.5,
  };

  it('el dia limite todavia NO hay recargo (NO-camino)', () => {
    expect(recargoAplicable({ ...base, hoy: '2026-09-10' })).toBe(0);
    expect(recargoAplicable({ ...base, hoy: '2026-09-01' })).toBe(0);
  });

  it('al dia siguiente si, y sale de la fecha congelada en el cargo', () => {
    expect(recargoAplicable({ ...base, hoy: '2026-09-11' })).toBe(8_575);
  });

  it('sin saldo no hay recargo, por mucho que haya pasado la fecha', () => {
    expect(recargoAplicable({ ...base, saldoCentavos: 0, hoy: '2026-12-31' })).toBe(0);
  });

  it('una escuela con recargo en cero no cobra nada', () => {
    expect(recargoAplicable({ ...base, porcentaje: 0, hoy: '2026-09-11' })).toBe(0);
  });
});

describe('Articulo 7: se cuentan MESES, no pesos', () => {
  const hoy = '2026-11-20';
  const cargo = (periodo: string, saldo: number, limite: string, esColegiatura = true) => ({
    periodo,
    saldoCentavos: saldo,
    fechaLimiteSinRecargo: limite,
    esColegiatura,
  });

  it('dos conceptos del mismo mes son UN mes de atraso, no dos', () => {
    // La ley habla de colegiaturas equivalentes a meses. Contar cargos inflaria
    // el atraso y llevaria a la escuela a suspender antes de tiempo.
    const cargos = [
      cargo('2026-09', 245_000, '2026-09-10'),
      cargo('2026-09', 85_000, '2026-09-10'),
    ];
    expect(periodosEnMora(cargos, hoy)).toBe(1);
  });

  it('lo que aun no vence no cuenta como mora', () => {
    const cargos = [
      cargo('2026-09', 245_000, '2026-09-10'),
      cargo('2026-12', 245_000, '2026-12-10'),
    ];
    expect(periodosEnMora(cargos, hoy)).toBe(1);
  });

  it('lo vencido pero PAGADO tampoco cuenta', () => {
    const cargos = [cargo('2026-09', 0, '2026-09-10'), cargo('2026-10', 245_000, '2026-10-10')];
    expect(periodosEnMora(cargos, hoy)).toBe(1);
  });

  it('con menos de tres meses el sistema dice cuantos faltan, no "no se puede"', () => {
    const situacion = situacionLegal(
      [cargo('2026-09', 245_000, '2026-09-10'), cargo('2026-10', 245_000, '2026-10-10')],
      hoy,
    );
    expect(situacion.puedeSuspender).toBe(false);
    expect(situacion.periodosEnMora).toBe(2);
    expect(situacion.explicacion).toMatch(/falta\(n\) 1/);
  });

  it('con tres, la ley lo permite — y el sistema recuerda las condiciones', () => {
    const situacion = situacionLegal(
      [
        cargo('2026-08', 245_000, '2026-08-10'),
        cargo('2026-09', 245_000, '2026-09-10'),
        cargo('2026-10', 245_000, '2026-10-10'),
      ],
      hoy,
    );
    expect(situacion.puedeSuspender).toBe(true);
    expect(PERIODOS_PARA_SUSPENDER).toBe(3);
    // Suspender NUNCA es automatico: 15 dias de aviso y el alumno conserva su
    // documentacion y sus examenes (Art. 7, fracciones I y II).
    expect(situacion.explicacion).toMatch(/15 días/);
    expect(situacion.explicacion).toMatch(/documentación/);
  });

  it('una familia al corriente se dice al corriente, sin rodeos', () => {
    expect(situacionLegal([cargo('2026-09', 0, '2026-09-10')], hoy)).toMatchObject({
      periodosEnMora: 0,
      puedeSuspender: false,
      // NO "Al corriente": esa frase convive con el saldo y los dias de atraso,
      // y se puede deber dinero sin tener una sola COLEGIATURA vencida (§52).
      explicacion: 'Sin causal de suspensión (Art. 7).',
    });
  });
});

/**
 * EL DEFECTO QUE ESTAS PRUEBAS FIJAN (§52, Sprint 5).
 *
 * Hasta la ampliacion del Sprint 5 el contador sumaba cualquier cargo vencido.
 * Tres excursiones impagas en tres meses distintos ponian a una familia en el
 * umbral de suspension sin deber una sola colegiatura — y el panel se lo decia
 * al director como si fuera la ley. Estas pruebas existen para que ese contador
 * no vuelva a ensancharse.
 */
describe('Articulo 7: se cuentan COLEGIATURAS, no adeudos', () => {
  const hoy = '2026-11-20';
  const cargo = (periodo: string, saldo: number, limite: string, esColegiatura = true) => ({
    periodo,
    saldoCentavos: saldo,
    fechaLimiteSinRecargo: limite,
    esColegiatura,
  });

  it('tres excursiones vencidas NO habilitan a suspender el servicio', () => {
    const situacion = situacionLegal(
      [
        cargo('2026-08', 80_000, '2026-08-10', false),
        cargo('2026-09', 80_000, '2026-09-10', false),
        cargo('2026-10', 80_000, '2026-10-10', false),
      ],
      hoy,
    );
    expect(situacion.periodosEnMora).toBe(0);
    expect(situacion.puedeSuspender).toBe(false);
  });

  it('el comedor del mismo mes no agrega un mes al contador', () => {
    // Comedor y colegiatura de septiembre: UNA colegiatura vencida.
    const cargos = [
      cargo('2026-09', 245_000, '2026-09-10'),
      cargo('2026-09', 60_000, '2026-09-10', false),
    ];
    expect(periodosEnMora(cargos, hoy)).toBe(1);
  });

  it('dos colegiaturas mas una excursion siguen siendo DOS, no tres', () => {
    // El caso exacto que el defecto convertia en suspension habilitada.
    const situacion = situacionLegal(
      [
        cargo('2026-09', 245_000, '2026-09-10'),
        cargo('2026-10', 245_000, '2026-10-10'),
        cargo('2026-08', 95_000, '2026-08-10', false),
      ],
      hoy,
    );
    expect(situacion.periodosEnMora).toBe(2);
    expect(situacion.puedeSuspender).toBe(false);
    expect(situacion.explicacion).toMatch(/falta\(n\) 1/);
  });
});

/**
 * §51 — a quien obliga la ley que estamos aplicando.
 */
describe('el Acuerdo no alcanza a todos los tenants', () => {
  const hoy = '2026-11-20';
  const tresColegiaturas = [
    {
      periodo: '2026-08',
      saldoCentavos: 245_000,
      fechaLimiteSinRecargo: '2026-08-10',
      esColegiatura: true,
    },
    {
      periodo: '2026-09',
      saldoCentavos: 245_000,
      fechaLimiteSinRecargo: '2026-09-10',
      esColegiatura: true,
    },
    {
      periodo: '2026-10',
      saldoCentavos: 245_000,
      fechaLimiteSinRecargo: '2026-10-10',
      esColegiatura: true,
    },
  ];

  it('a un colegio se le dice que la ley ya se lo permite', () => {
    expect(situacionLegal(tresColegiaturas, hoy, true).puedeSuspender).toBe(true);
  });

  it('a una universidad NO se le afirma un permiso que la ley no le da', () => {
    const situacion = situacionLegal(tresColegiaturas, hoy, false);
    // Los meses se siguen contando —el dato es util— pero el sistema no dice
    // "la ley permite": remite al reglamento de la institucion.
    expect(situacion.periodosEnMora).toBe(3);
    expect(situacion.puedeSuspender).toBe(false);
    expect(situacion.explicacion).toMatch(/no aplica a esta institución/);
    expect(situacion.explicacion).not.toMatch(/La ley permite/);
  });

  it('y si esta al corriente, se dice igual que a cualquiera', () => {
    expect(situacionLegal([], hoy, false).explicacion).toBe(
      'Sin colegiaturas vencidas. El límite lo fija su reglamento.',
    );
  });
});

describe('marco legal por vertical (§51)', () => {
  it('solo el colegio queda dentro del Acuerdo de PROFECO', () => {
    expect(aplicaAcuerdoProfeco('COLEGIO')).toBe(true);
    for (const v of ['UNIVERSIDAD', 'ACADEMIA_DEPORTIVA', 'ESCUELA_IDIOMAS', 'TALLER'] as const) {
      expect(aplicaAcuerdoProfeco(v)).toBe(false);
    }
  });

  it('el piso de diez dias se impone solo a quien la ley obliga', () => {
    expect(pisoDeGracia('COLEGIO')).toBe(DIAS_GRACIA_MINIMOS);
    expect(pisoDeGracia('UNIVERSIDAD')).toBe(0);
  });

  it('los 60 dias de aviso, igual', () => {
    expect(diasDeAvisoExigidos('COLEGIO')).toBe(DIAS_AVISO_AJUSTE);
    expect(diasDeAvisoExigidos('ACADEMIA_DEPORTIVA')).toBe(0);
  });

  it('piso cero NO significa recargo desde el dia uno', () => {
    // El maximo con el dia de vencimiento sigue mandando: una universidad que
    // vence el 16 acepta sin recargo hasta el 16, no hasta el 1.
    expect(fechaLimiteSinRecargo('2026-09', 16, 0, 0)).toBe('2026-09-16');
    // Y un colegio no puede bajar del dia 10 ni configurando menos.
    expect(fechaLimiteSinRecargo('2026-09', 5, 3, DIAS_GRACIA_MINIMOS)).toBe('2026-09-10');
  });
});

// ---------------------------------------------------------------------------
// AZ-M4.10 — el saldo a favor se aplica solo
// ---------------------------------------------------------------------------

describe('saldo a favor aplicado a cargos futuros', () => {
  const parte = (referencia: string, vence: string, saldoCentavos: number) => ({
    referencia,
    vence,
    saldoCentavos,
  });
  const credito = (pagoId: string, fecha: string, sobranteCentavos: number) => ({
    pagoId,
    fecha,
    sobranteCentavos,
  });

  it('el sobrante de un pago salda el cargo que se acaba de generar', () => {
    // EL HUECO ORIGINAL: la madre pago el semestre completo en agosto; en
    // septiembre se genera su colegiatura y hasta hoy nacia intacta.
    const { aplicaciones, sinAplicarCentavos } = aplicarSaldoAFavor(
      [credito('pago-1', '2026-08-05', 500_000)],
      [parte('sep', '2026-09-05', 245_000)],
    );
    expect(aplicaciones).toEqual([{ pagoId: 'pago-1', referencia: 'sep', centavos: 245_000 }]);
    expect(sinAplicarCentavos).toBe(255_000);
  });

  it('se consume el credito mas viejo primero', () => {
    const { aplicaciones } = aplicarSaldoAFavor(
      [credito('nuevo', '2026-08-20', 100_000), credito('viejo', '2026-07-01', 100_000)],
      [parte('sep', '2026-09-05', 150_000)],
    );
    expect(aplicaciones[0]).toMatchObject({ pagoId: 'viejo', centavos: 100_000 });
    expect(aplicaciones[1]).toMatchObject({ pagoId: 'nuevo', centavos: 50_000 });
  });

  it('y la deuda mas vieja primero, igual que un pago', () => {
    const { aplicaciones } = aplicarSaldoAFavor(
      [credito('pago-1', '2026-08-05', 300_000)],
      [parte('oct', '2026-10-05', 245_000), parte('sep', '2026-09-05', 245_000)],
    );
    expect(aplicaciones[0]?.referencia).toBe('sep');
    expect(aplicaciones[1]?.referencia).toBe('oct');
  });

  it('un credito reparte entre varias partes sin perder un centavo', () => {
    const { aplicaciones, sinAplicarCentavos } = aplicarSaldoAFavor(
      [credito('pago-1', '2026-08-05', 300_000)],
      [parte('sep', '2026-09-05', 245_000), parte('oct', '2026-10-05', 245_000)],
    );
    const total = aplicaciones.reduce((a, x) => a + x.centavos, 0);
    expect(total + sinAplicarCentavos).toBe(300_000);
    expect(total).toBe(300_000);
  });

  it('NO-camino: sin deuda abierta no se aplica nada y el credito sigue entero', () => {
    const { aplicaciones, sinAplicarCentavos } = aplicarSaldoAFavor(
      [credito('pago-1', '2026-08-05', 500_000)],
      [],
    );
    expect(aplicaciones).toEqual([]);
    expect(sinAplicarCentavos).toBe(500_000);
  });

  it('NO-camino: correrlo dos veces no aplica de mas (idempotencia)', () => {
    const partes = [parte('sep', '2026-09-05', 245_000)];
    const primera = aplicarSaldoAFavor([credito('pago-1', '2026-08-05', 500_000)], partes);
    expect(primera.aplicaciones).toHaveLength(1);

    // Segunda corrida: el sobrante ya no es 500_000 sino lo que quedo, y la
    // parte ya no tiene saldo. Asi es como lo llama el servicio, derivando
    // ambas cosas de la base — no guardandolas.
    const segunda = aplicarSaldoAFavor(
      [credito('pago-1', '2026-08-05', primera.sinAplicarCentavos)],
      [parte('sep', '2026-09-05', 0)],
    );
    expect(segunda.aplicaciones).toEqual([]);
  });

  it('NO-camino: nunca se aplica mas de lo que la parte debe', () => {
    const { aplicaciones } = aplicarSaldoAFavor(
      [credito('pago-1', '2026-08-05', 1_000_000)],
      [parte('sep', '2026-09-05', 245_000)],
    );
    expect(aplicaciones[0]?.centavos).toBe(245_000);
  });
});

describe('devolución del saldo a favor', () => {
  const vencido = {
    periodo: '2026-09',
    saldoCentavos: 245_000,
    fechaLimiteSinRecargo: '2026-09-10',
    esColegiatura: true,
  };

  it('no se devuelve mientras haya un cargo vencido sin pagar', () => {
    // El caso real: el adeudo vencido es de un concepto que NO acepta saldo a
    // favor, asi que la aplicacion automatica no lo cubrio. Devolver el dinero
    // ahi seria financiar una mora con la caja de la escuela.
    const veredicto = puedeDevolverse(150_000, [vencido], '2026-11-20');
    expect(veredicto.permitido).toBe(false);
    expect(veredicto.motivo).toMatch(/cargos vencidos/);
  });

  it('sin adeudo vencido, se puede', () => {
    expect(puedeDevolverse(150_000, [], '2026-11-20').permitido).toBe(true);
  });

  it('lo que aun no vence no bloquea la devolución', () => {
    const porVencer = { ...vencido, periodo: '2026-12', fechaLimiteSinRecargo: '2026-12-10' };
    expect(puedeDevolverse(150_000, [porVencer], '2026-11-20').permitido).toBe(true);
  });

  it('sin saldo a favor no hay nada que devolver, y se dice', () => {
    expect(puedeDevolverse(0, [], '2026-11-20')).toMatchObject({ permitido: false });
  });
});

describe('avisos fiscales en el estado de cuenta (AZ-M4.5b)', () => {
  it('si hay conceptos deducibles, se advierte que el efectivo mata la deducción', () => {
    const avisos = avisosFiscales({ hayConceptosDeducibles: true });
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toMatch(/efectivo/);
  });

  it('si no los hay, no se dice nada: un aviso que no aplica es ruido', () => {
    expect(avisosFiscales({ hayConceptosDeducibles: false })).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AZ-M4.3b — descuento por pronto pago, en el momento del pago
// ---------------------------------------------------------------------------

describe('pronto pago: el descuento cambia cuánto dinero hace falta', () => {
  const parte = (
    referencia: string,
    vence: string,
    saldoCentavos: number,
    prontoPago: { hasta: string; porcentaje: number } | null = null,
  ) => ({ referencia, vence, saldoCentavos, prontoPago });

  it('pagar dentro de la ventana salda la parte con MENOS dinero', () => {
    // Debe 1,000 con 10 % de pronto pago: con 900 queda saldada.
    const r = aplicarPagoConProntoPago(
      90_000,
      [parte('sep', '2026-09-05', 100_000, { hasta: '2026-09-03', porcentaje: 10 })],
      '2026-09-01',
    );
    expect(r.aplicaciones).toEqual([
      { referencia: 'sep', centavos: 90_000, descuentoCentavos: 10_000 },
    ]);
    expect(r.sobranteCentavos).toBe(0);
    expect(r.descuentoTotalCentavos).toBe(10_000);
  });

  it('EL DEFECTO QUE ESTE DISEÑO EVITA: sin calcularlo antes, sobraría dinero', () => {
    // Si el pago se repartiera primero y el descuento se restara después, los
    // 900 se aplicarían íntegros a la parte —quedando 100 abiertos— y luego el
    // descuento dejaría 100 de sobrante que iría a la parte SIGUIENTE, que no
    // le tocaba. Aquí la segunda parte no recibe un peso.
    const r = aplicarPagoConProntoPago(
      90_000,
      [
        parte('sep', '2026-09-05', 100_000, { hasta: '2026-09-03', porcentaje: 10 }),
        parte('oct', '2026-10-05', 100_000),
      ],
      '2026-09-01',
    );
    expect(r.aplicaciones).toHaveLength(1);
    expect(r.sobranteCentavos).toBe(0);
  });

  it('un día tarde y no hay premio: se cobra completo', () => {
    const r = aplicarPagoConProntoPago(
      90_000,
      [parte('sep', '2026-09-05', 100_000, { hasta: '2026-09-03', porcentaje: 10 })],
      '2026-09-04',
    );
    expect(r.descuentoTotalCentavos).toBe(0);
    expect(r.aplicaciones[0]!.centavos).toBe(90_000);
  });

  it('el último día de la ventana SÍ cuenta', () => {
    const r = aplicarPagoConProntoPago(
      90_000,
      [parte('sep', '2026-09-05', 100_000, { hasta: '2026-09-03', porcentaje: 10 })],
      '2026-09-03',
    );
    expect(r.descuentoTotalCentavos).toBe(10_000);
  });

  it('NO-camino: un abono parcial NO gana el descuento', () => {
    // El pronto pago premia liquidar temprano, no dar un anticipo temprano.
    // Descontar sobre deuda que sigue abierta sería regalar dinero.
    const r = aplicarPagoConProntoPago(
      50_000,
      [parte('sep', '2026-09-05', 100_000, { hasta: '2026-09-03', porcentaje: 10 })],
      '2026-09-01',
    );
    expect(r.descuentoTotalCentavos).toBe(0);
    expect(r.aplicaciones[0]!.centavos).toBe(50_000);
  });

  it('sin pronto pago configurado se comporta igual que un pago normal', () => {
    const r = aplicarPagoConProntoPago(
      150_000,
      [parte('ago', '2026-08-05', 100_000), parte('sep', '2026-09-05', 100_000)],
      '2026-09-01',
    );
    expect(r.aplicaciones.map((a) => a.centavos)).toEqual([100_000, 50_000]);
    expect(r.descuentoTotalCentavos).toBe(0);
  });

  it('sigue siendo FIFO: lo más viejo primero, aunque el premio esté en lo nuevo', () => {
    // Saldar septiembre para ganar el descuento y dejar agosto abierto dejaría
    // a la familia con un mes vencido más — que es lo que cuenta el Artículo 7.
    const r = aplicarPagoConProntoPago(
      100_000,
      [
        parte('sep', '2026-09-05', 100_000, { hasta: '2026-09-03', porcentaje: 10 }),
        parte('ago', '2026-08-05', 100_000),
      ],
      '2026-09-01',
    );
    expect(r.aplicaciones[0]!.referencia).toBe('ago');
    expect(r.descuentoTotalCentavos).toBe(0);
  });

  it('INVARIANTE: dinero aplicado + sobrante = lo que entró, siempre', () => {
    for (let monto = 1; monto <= 400_000; monto += 3_137) {
      const r = aplicarPagoConProntoPago(
        monto,
        [
          parte('ago', '2026-08-05', 120_000, { hasta: '2026-08-03', porcentaje: 7.5 }),
          parte('sep', '2026-09-05', 100_000, { hasta: '2026-09-03', porcentaje: 10 }),
        ],
        '2026-08-01',
      );
      const aplicado = r.aplicaciones.reduce((a, x) => a + x.centavos, 0);
      expect(aplicado + r.sobranteCentavos, `pago ${monto}`).toBe(monto);
      for (const a of r.aplicaciones) {
        expect(a.centavos + a.descuentoCentavos).toBeLessThanOrEqual(120_000);
      }
    }
  });
});
