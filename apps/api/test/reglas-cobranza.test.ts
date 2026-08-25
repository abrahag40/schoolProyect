/**
 * Las reglas del dinero, probadas SIN base de datos (§13 capa 1).
 *
 * Aqui viven los dos modos de fallo mas caros de un sistema de cobranza, y los
 * dos son invisibles hasta que ya costaron dinero o una queja:
 *   1. El centavo que se pierde al repartir. Aparece meses despues como "el
 *      corte no cuadra" y para entonces nadie asocia el sintoma con su causa.
 *   2. El recargo cobrado antes de tiempo. Aparece como una queja ante PROFECO.
 */
import { describe, it, expect } from 'vitest';
import {
  aCentavos,
  aMonto,
  anticipacionDeAjuste,
  calcularRecargo,
  claveDeCargo,
  diasDelMes,
  fechaDelPeriodo,
  fechaLimiteSinRecargo,
  hayRecargo,
  periodoDe,
  repartir,
  RepartoInvalidoError,
  DIAS_GRACIA_MINIMOS,
} from '../src/cobranza/reglas.js';

describe('el dinero no pasa por punto flotante (§4)', () => {
  it('convierte importes a centavos y de vuelta sin perder nada', () => {
    expect(aCentavos('2450.00')).toBe(245_000);
    expect(aCentavos('2450.5')).toBe(245_050);
    expect(aCentavos('2450')).toBe(245_000);
    expect(aCentavos('0.01')).toBe(1);
    expect(aMonto(245_050)).toBe('2450.50');
    expect(aMonto(1)).toBe('0.01');
    expect(aMonto(0)).toBe('0.00');
  });

  it('el viaje de ida y vuelta es exacto para los importes tipicos de una escuela', () => {
    for (const monto of ['2450.00', '890.50', '1.05', '12345.67', '0.99']) {
      expect(aMonto(aCentavos(monto))).toBe(Number(monto).toFixed(2));
    }
  });

  it('el recargo se redondea al centavo, con el medio hacia arriba', () => {
    // 2450.00 al 3.5% = 85.75 exactos.
    expect(calcularRecargo(245_000, 3.5)).toBe(8_575);
    // 1.05 al 5% = 0.0525 -> 0.05
    expect(calcularRecargo(105, 5)).toBe(5);
    // Un recargo de 0% no inventa centavos.
    expect(calcularRecargo(245_000, 0)).toBe(0);
  });
});

describe('reparto entre pagadores: ni un centavo de mas ni de menos', () => {
  it('el caso de la familia demo: 60/40 de una colegiatura de 2,450', () => {
    const partes = repartir(aCentavos('2450.00'), [
      { referencia: 'elena', porcentaje: 60 },
      { referencia: 'jorge', porcentaje: 40 },
    ]);
    expect(partes.map((p) => aMonto(p.centavos))).toEqual(['1470.00', '980.00']);
  });

  it('cuando el reparto NO es exacto, el sobrante se asigna, no se pierde', () => {
    // 1.00 en tres partes: el camino obvio —redondear cada una— daria 0.99.
    const partes = repartir(100, [
      { referencia: 'a', porcentaje: 33.33 },
      { referencia: 'b', porcentaje: 33.33 },
      { referencia: 'c', porcentaje: 33.34 },
    ]);
    expect(partes.map((p) => p.centavos)).toEqual([33, 33, 34]);
    expect(partes.reduce((a, p) => a + p.centavos, 0)).toBe(100);
  });

  it('con empate en el resto, gana quien llego primero: el resultado es reproducible', () => {
    const entrada = [
      { referencia: 'a', porcentaje: 50 },
      { referencia: 'b', porcentaje: 50 },
    ];
    // 3 centavos entre dos: alguien recibe 2 y alguien 1, siempre el mismo.
    expect(repartir(3, entrada).map((p) => p.centavos)).toEqual([2, 1]);
    expect(repartir(3, entrada)).toEqual(repartir(3, entrada));
  });

  it('INVARIANTE: la suma de las partes es exactamente el total, siempre', () => {
    // Un ejemplo bonito no prueba nada sobre el redondeo. Se barre un rango de
    // importes contra varios repartos reales del sector: dos padres separados,
    // tres tutores, una beca del 15%, un pagador unico.
    const repartos = [
      [50, 50],
      [60, 40],
      [33.33, 33.33, 33.34],
      [85, 15],
      [100],
      [25, 25, 25, 25],
      [70.5, 29.5],
      [16.67, 16.67, 16.66, 50],
    ];

    for (const porcentajes of repartos) {
      const pagadores = porcentajes.map((porcentaje, i) => ({
        referencia: `p${i}`,
        porcentaje,
      }));
      // Importes de 1 centavo a 9,999.99 pesos, con paso primo para no caer
      // siempre en multiplos redondos que ocultarian el defecto.
      for (let total = 1; total <= 1_000_000; total += 4_637) {
        const suma = repartir(total, pagadores).reduce((a, p) => a + p.centavos, 0);
        expect(suma, `total ${total} con ${porcentajes.join('/')}`).toBe(total);
      }
    }
  });

  it('si los porcentajes no suman 100, falla RUIDOSAMENTE', () => {
    // El alumno cuyos pagadores suman 90% cobraria de menos todos los meses, y
    // eso se descubre en la auditoria anual. Mejor detener la generacion.
    expect(() =>
      repartir(245_000, [
        { referencia: 'a', porcentaje: 60 },
        { referencia: 'b', porcentaje: 30 },
      ]),
    ).toThrow(RepartoInvalidoError);
  });

  it('sin pagadores registrados devuelve vacio: lo decide quien llama', () => {
    expect(repartir(245_000, [])).toEqual([]);
  });
});

describe('Articulo 4 del Acuerdo de PROFECO: diez dias sin recargo', () => {
  it('aunque la escuela venza el dia 5, no hay recargo antes del dia 10', () => {
    expect(fechaLimiteSinRecargo('2026-09', 5)).toBe('2026-09-10');
    expect(DIAS_GRACIA_MINIMOS).toBe(10);
  });

  it('si la escuela vence DESPUES del dia 10, manda su fecha', () => {
    // Cobrar recargo antes de que algo venza no tiene sentido.
    expect(fechaLimiteSinRecargo('2026-09', 15)).toBe('2026-09-15');
  });

  it('la escuela puede ser mas generosa que la ley, nunca mas estricta', () => {
    expect(fechaLimiteSinRecargo('2026-09', 5, 20)).toBe('2026-09-20');
    // Configurar 3 dias de gracia no baja el piso legal.
    expect(fechaLimiteSinRecargo('2026-09', 5, 3)).toBe('2026-09-10');
  });

  it('el dia 10 TODAVIA es gratis; el recargo empieza el 11 (NO-camino)', () => {
    const limite = fechaLimiteSinRecargo('2026-09', 5);
    expect(hayRecargo('2026-09-01', limite)).toBe(false);
    expect(hayRecargo('2026-09-10', limite)).toBe(false);
    expect(hayRecargo('2026-09-11', limite)).toBe(true);
  });
});

describe('fechas de un periodo de cobro', () => {
  it('un vencimiento el dia 31 se recorta al ultimo dia real del mes', () => {
    // Sin el recorte, JavaScript saltaria a marzo en silencio: peor que fallar.
    expect(fechaDelPeriodo('2026-02', 31)).toBe('2026-02-28');
    expect(fechaDelPeriodo('2026-04', 31)).toBe('2026-04-30');
    expect(fechaDelPeriodo('2026-01', 31)).toBe('2026-01-31');
  });

  it('los bisiestos salen bien porque no se calculan a mano', () => {
    expect(diasDelMes('2028-02')).toBe(29);
    expect(diasDelMes('2026-02')).toBe(28);
    expect(fechaDelPeriodo('2028-02', 31)).toBe('2028-02-29');
  });

  it('una fecha pertenece al periodo de su mes', () => {
    expect(periodoDe('2026-09-14')).toBe('2026-09');
  });
});

describe('Articulo 5-I: los ajustes se avisan con 60 dias', () => {
  it('dos meses de anticipacion alcanzan', () => {
    const { dias, suficiente } = anticipacionDeAjuste('2026-06-01', '2026-08-01');
    expect(dias).toBe(61);
    expect(suficiente).toBe(true);
  });

  it('un mes NO alcanza, y se dice cuantos dias hay (NO-camino)', () => {
    const { dias, suficiente } = anticipacionDeAjuste('2026-07-01', '2026-08-01');
    expect(dias).toBe(31);
    expect(suficiente).toBe(false);
  });

  it('exactamente 60 dias es suficiente: el limite se incluye', () => {
    expect(anticipacionDeAjuste('2026-06-02', '2026-08-01').suficiente).toBe(true);
  });
});

describe('identidad del cargo (§15)', () => {
  it('un alumno, un concepto y un periodo producen siempre la misma clave', () => {
    const clave = claveDeCargo('alumno-1', 'concepto-1', '2026-09');
    expect(clave).toBe('alumno-1:concepto-1:2026-09');
    expect(claveDeCargo('alumno-1', 'concepto-1', '2026-09')).toBe(clave);
    // Y cambiar cualquiera de los tres produce otra.
    expect(claveDeCargo('alumno-1', 'concepto-1', '2026-10')).not.toBe(clave);
  });
});
