/**
 * Saldos, aplicacion de pagos y mora — probados sin base de datos (§13 capa 1).
 *
 * Los dos numeros que esta capa protege son los que un ser humano mira antes de
 * actuar: lo que un padre debe antes de pagar, y los meses de atraso que un
 * director mira antes de llamar. Equivocarse aqui no rompe una pantalla:
 * cobra de mas o suspende a un alumno antes de que la ley lo permita.
 */
import { describe, it, expect } from 'vitest';
import { aCentavos } from '../src/cobranza/reglas.js';
import {
  aplicarPago,
  periodosEnMora,
  recargoAplicable,
  saldoDeParte,
  situacionLegal,
  PERIODOS_PARA_SUSPENDER,
} from '../src/cobranza/saldos.js';

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
  const cargo = (periodo: string, saldo: number, limite: string) => ({
    periodo,
    saldoCentavos: saldo,
    fechaLimiteSinRecargo: limite,
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
      explicacion: 'Al corriente.',
    });
  });
});
