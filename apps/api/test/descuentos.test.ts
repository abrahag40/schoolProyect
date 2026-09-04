/**
 * Becas y descuentos — probados sin base de datos (§13 capa 1).
 *
 * Lo que esta capa protege es el importe que la familia acaba pagando. Un
 * defecto aqui no rompe una pantalla: cobra de mas todos los meses a todas las
 * familias becadas, y se descubre en la auditoria anual.
 */
import { describe, it, expect } from 'vitest';
import { aCentavos } from '../src/cobranza/reglas.js';
import {
  BecaInvalidaError,
  becasAplicables,
  calcularDescuentos,
  descuentoPorProrrateo,
  estaVigente,
  proporcionDelPeriodo,
  validarPorcentaje,
  type DescuentoAplicable,
} from '../src/cobranza/descuentos.js';

const COLEGIATURA = aCentavos('2450.00');

const beca = (
  referencia: string,
  valor: number,
  tipo: 'PORCENTAJE' | 'MONTO_FIJO' = 'PORCENTAJE',
): DescuentoAplicable => ({
  referencia,
  categoria: 'BECA',
  tipo,
  valor,
  concepto: `Beca ${referencia}`,
});

const descuento = (
  referencia: string,
  valor: number,
  tipo: 'PORCENTAJE' | 'MONTO_FIJO' = 'PORCENTAJE',
): DescuentoAplicable => ({
  referencia,
  categoria: 'DESCUENTO',
  tipo,
  valor,
  concepto: `Descuento ${referencia}`,
});

describe('el importe con un solo descuento', () => {
  it('un porcentaje se calcula sobre el precio de lista', () => {
    const r = calcularDescuentos(COLEGIATURA, [beca('hermanos', 10)]);
    expect(r.totalCentavos).toBe(24_500);
    expect(r.netoCentavos).toBe(220_500);
  });

  it('un monto fijo se resta tal cual', () => {
    const r = calcularDescuentos(COLEGIATURA, [beca('convenio', 50_000, 'MONTO_FIJO')]);
    expect(r.totalCentavos).toBe(50_000);
    expect(r.netoCentavos).toBe(195_000);
  });

  it('sin descuentos, el neto es el precio de lista', () => {
    const r = calcularDescuentos(COLEGIATURA, []);
    expect(r.aplicados).toEqual([]);
    expect(r.netoCentavos).toBe(COLEGIATURA);
  });

  it('la beca del 5 % que exige la ley cae exacta', () => {
    // LGE art. 149-III: 5 % de la matricula. Sobre 2,450 son 122.50.
    const r = calcularDescuentos(COLEGIATURA, [beca('legal-5', 5)]);
    expect(r.totalCentavos).toBe(12_250);
    expect(r.netoCentavos).toBe(232_750);
  });
});

/**
 * EL BLOQUE QUE JUSTIFICA TODO EL ARCHIVO.
 *
 * Con una beca del 50 % y un pronto pago del 10 %, hay dos respuestas posibles y
 * difieren en 122.50 pesos AL MES sobre una sola colegiatura. Lo que hace daño
 * no es elegir una: es que dos partes del sistema elijan distinto.
 */
describe('el orden declarado: beca primero, y en cascada', () => {
  const caso = [beca('hermanos', 50), descuento('pronto-pago', 10)];

  it('la beca se aplica antes que el descuento', () => {
    const r = calcularDescuentos(COLEGIATURA, caso);
    expect(r.aplicados[0]!.referencia).toBe('hermanos');
    expect(r.aplicados[1]!.referencia).toBe('pronto-pago');
  });

  it('el pronto pago se calcula sobre lo que quedó, no sobre el precio de lista', () => {
    const r = calcularDescuentos(COLEGIATURA, caso);
    // 2450 − 1225 = 1225; 10 % de 1225 = 122.50; neto 1102.50.
    expect(r.aplicados[0]!.centavos).toBe(122_500);
    expect(r.aplicados[1]!.centavos).toBe(12_250);
    expect(r.netoCentavos).toBe(110_250);
    // Y NO 980.00, que es lo que daria sumar los porcentajes (60 % de 2450).
    expect(r.netoCentavos).not.toBe(98_000);
  });

  it('el orden de entrada NO cambia el resultado: lo decide la categoría', () => {
    const alDerecho = calcularDescuentos(COLEGIATURA, caso);
    const alReves = calcularDescuentos(COLEGIATURA, [...caso].reverse());
    expect(alReves).toEqual(alDerecho);
  });

  it('es determinista con varias becas: se ordena por referencia', () => {
    const muchas = [beca('zeta', 10), beca('alfa', 10), descuento('pronto', 5)];
    const a = calcularDescuentos(COLEGIATURA, muchas);
    const b = calcularDescuentos(COLEGIATURA, [...muchas].reverse());
    expect(a).toEqual(b);
    expect(a.aplicados.map((x) => x.referencia)).toEqual(['alfa', 'zeta', 'pronto']);
  });
});

describe('NO-camino: el neto nunca es negativo', () => {
  it('una beca del 100 % deja el cargo en cero, no en negativo', () => {
    const r = calcularDescuentos(COLEGIATURA, [beca('completa', 100)]);
    expect(r.netoCentavos).toBe(0);
    expect(r.totalCentavos).toBe(COLEGIATURA);
  });

  it('un monto fijo mayor que el cargo se RECORTA, y el asiento registra lo real', () => {
    // Guardar la intencion (500000) en vez de lo aplicado (245000) produciria
    // un total de descuentos que no cuadra con la diferencia de importes.
    const r = calcularDescuentos(COLEGIATURA, [beca('generosa', 500_000, 'MONTO_FIJO')]);
    expect(r.aplicados[0]!.centavos).toBe(COLEGIATURA);
    expect(r.netoCentavos).toBe(0);
  });

  it('descuentos que suman más que el cargo se recortan al remanente', () => {
    const r = calcularDescuentos(COLEGIATURA, [beca('a', 80), descuento('b', 100)]);
    expect(r.netoCentavos).toBe(0);
    expect(r.totalCentavos).toBe(COLEGIATURA);
  });

  it('lo que sigue después de agotar el cargo no genera asiento', () => {
    const r = calcularDescuentos(COLEGIATURA, [beca('a', 100), descuento('b', 50)]);
    expect(r.aplicados).toHaveLength(1);
  });

  it('un cargo en cero no produce descuentos', () => {
    expect(calcularDescuentos(0, [beca('a', 50)]).aplicados).toEqual([]);
  });
});

describe('INVARIANTE: el precio de lista siempre se explica', () => {
  it('lista − Σ descuentos = neto, para cualquier combinación', () => {
    // La propiedad que el estado de cuenta necesita para poder mostrar el
    // desglose: si no cierra, hay un renglón que nadie puede justificar.
    for (let base = 1; base <= 1_000_000; base += 7_919) {
      for (const combinacion of [
        [beca('a', 5)],
        [beca('a', 50), descuento('b', 10)],
        [beca('a', 33.33), descuento('b', 7.77)],
        [beca('a', 12_345, 'MONTO_FIJO'), descuento('b', 15)],
        [beca('a', 100), descuento('b', 20)],
      ]) {
        const r = calcularDescuentos(base, combinacion);
        expect(r.totalCentavos + r.netoCentavos, `base ${base}`).toBe(base);
        expect(r.netoCentavos).toBeGreaterThanOrEqual(0);
        expect(r.totalCentavos).toBeLessThanOrEqual(base);
      }
    }
  });
});

describe('validación al capturar la beca, no al generar el cargo', () => {
  it('rechaza un porcentaje mayor que 100', () => {
    // Para cuando se generan los cargos ya hay cuatrocientas familias con el
    // importe equivocado. Se detiene en la captura.
    expect(() => validarPorcentaje(120)).toThrow(BecaInvalidaError);
  });

  it('rechaza cero y negativos', () => {
    expect(() => validarPorcentaje(0)).toThrow(BecaInvalidaError);
    expect(() => validarPorcentaje(-10)).toThrow(BecaInvalidaError);
  });

  it('acepta el 100 %, que es condonar el cargo completo', () => {
    expect(() => validarPorcentaje(100)).not.toThrow();
    expect(() => validarPorcentaje(5)).not.toThrow();
  });
});

describe('vigencia: la beca caduca sola', () => {
  const conFin = { vigenteDesde: '2026-08-01', vigenteHasta: '2026-12-31' };
  const sinFin = { vigenteDesde: '2026-08-01', vigenteHasta: null };

  it('antes de empezar, no aplica', () => {
    expect(estaVigente(conFin, '2026-07-31')).toBe(false);
  });

  it('los dos extremos son inclusivos', () => {
    // "Vigente hasta el 31 de diciembre" cubre el 31 de diciembre. Excluir el
    // último día es la interpretación que genera la llamada a soporte.
    expect(estaVigente(conFin, '2026-08-01')).toBe(true);
    expect(estaVigente(conFin, '2026-12-31')).toBe(true);
  });

  it('el día siguiente al fin, deja de aplicar SOLA', () => {
    expect(estaVigente(conFin, '2027-01-01')).toBe(false);
  });

  it('una beca sin fecha de fin sigue vigente', () => {
    expect(estaVigente(sinFin, '2030-01-01')).toBe(true);
  });
});

describe('alcance: toda la escuela o un solo concepto', () => {
  const becas = [
    { referencia: 'general', vigenteDesde: '2026-08-01', vigenteHasta: null, conceptoId: null },
    {
      referencia: 'comedor',
      vigenteDesde: '2026-08-01',
      vigenteHasta: null,
      conceptoId: 'c-comedor',
    },
    {
      referencia: 'vencida',
      vigenteDesde: '2025-08-01',
      vigenteHasta: '2026-07-31',
      conceptoId: null,
    },
  ];

  it('la beca general aplica a cualquier concepto', () => {
    const r = becasAplicables(becas, { conceptoId: 'c-colegiatura', fecha: '2026-09-01' });
    expect(r.map((b) => b.referencia)).toEqual(['general']);
  });

  it('la beca de un concepto solo aplica a ese concepto', () => {
    const r = becasAplicables(becas, { conceptoId: 'c-comedor', fecha: '2026-09-01' });
    expect(r.map((b) => b.referencia)).toEqual(['general', 'comedor']);
  });

  it('la beca vencida no aparece, aunque su alcance encaje', () => {
    const r = becasAplicables(becas, { conceptoId: 'c-colegiatura', fecha: '2026-09-01' });
    expect(r.map((b) => b.referencia)).not.toContain('vencida');
  });
});

// ---------------------------------------------------------------------------
// Prorrateo por alta a mitad de periodo (AZ-M4.1)
// ---------------------------------------------------------------------------

describe('prorrateo: quien entra a mitad no paga el periodo completo', () => {
  const agosto = { inicioDelPeriodo: '2026-08-01', finDelPeriodo: '2026-08-31' };

  it('quien entra el día 1 paga el periodo completo', () => {
    const p = proporcionDelPeriodo({ ...agosto, altaEn: '2026-08-01' });
    expect(p).toEqual({ diasCubiertos: 31, diasTotales: 31 });
    expect(descuentoPorProrrateo(COLEGIATURA, p)).toBe(0);
  });

  it('quien se inscribió ANTES de que empezara también paga completo', () => {
    // No se le cobra de más por haberse inscrito temprano.
    const p = proporcionDelPeriodo({ ...agosto, altaEn: '2026-06-15' });
    expect(descuentoPorProrrateo(COLEGIATURA, p)).toBe(0);
  });

  it('quien entra el 17 de agosto cubre 15 de los 31 días', () => {
    const p = proporcionDelPeriodo({ ...agosto, altaEn: '2026-08-17' });
    expect(p).toEqual({ diasCubiertos: 15, diasTotales: 31 });
    // 2450 x 15/31 = 1185.48…; se cobran 1185.48 y se descuentan 1264.52.
    expect(descuentoPorProrrateo(COLEGIATURA, p)).toBe(126_452);
    expect(COLEGIATURA - descuentoPorProrrateo(COLEGIATURA, p)).toBe(118_548);
  });

  it('los dos extremos cuentan: el último día se debe un día, no cero', () => {
    const p = proporcionDelPeriodo({ ...agosto, altaEn: '2026-08-31' });
    expect(p.diasCubiertos).toBe(1);
    expect(descuentoPorProrrateo(COLEGIATURA, p)).toBeLessThan(COLEGIATURA);
  });

  it('EL CASO PELIGROSO: un alta POSTERIOR al periodo cobra completo, no cero', () => {
    // Una escuela que migra a Azahar en noviembre tiene a todos sus alumnos con
    // alta de noviembre. Prorratear los cargos de agosto a octubre los dejaría
    // en CERO, sin un solo error, y la escuela perdería un trimestre completo
    // sin enterarse hasta el corte. El error contrario —cobrarle un periodo
    // anterior a quien llegó tarde— lo reclama la familia el mismo día.
    const p = proporcionDelPeriodo({ ...agosto, altaEn: '2026-11-05' });
    expect(p.diasCubiertos).toBe(31);
    expect(descuentoPorProrrateo(COLEGIATURA, p)).toBe(0);
  });

  it('funciona igual sobre un semestre, que es donde más se nota', () => {
    // Seis meses: agosto a enero. Entrar en noviembre cubre poco más de la mitad.
    const semestre = { inicioDelPeriodo: '2026-08-01', finDelPeriodo: '2027-01-31' };
    const p = proporcionDelPeriodo({ ...semestre, altaEn: '2026-11-01' });
    expect(p.diasTotales).toBe(184);
    expect(p.diasCubiertos).toBe(92);
    // Justo la mitad, y el sistema no tuvo que saber cuántos días trae cada mes.
    expect(descuentoPorProrrateo(1_000_000, p)).toBe(500_000);
  });
});

describe('el orden con prorrateo: primero el precio real, luego la beca', () => {
  it('la beca se calcula sobre lo prorrateado, no sobre el periodo completo', () => {
    // Si la beca fuera primero, becaría días que el alumno no estuvo.
    const p = proporcionDelPeriodo({
      inicioDelPeriodo: '2026-08-01',
      finDelPeriodo: '2026-08-31',
      altaEn: '2026-08-17',
    });
    const r = calcularDescuentos(COLEGIATURA, [
      {
        referencia: 'prorrateo',
        categoria: 'PRORRATEO',
        tipo: 'MONTO_FIJO',
        valor: descuentoPorProrrateo(COLEGIATURA, p),
        concepto: 'Prorrateo por alta el 17 de agosto',
      },
      beca('hermanos', 10),
    ]);

    // Base prorrateada 1,185.48; la beca del 10 % son 118.55, no 245.00.
    expect(r.aplicados[0]!.referencia).toBe('prorrateo');
    expect(r.aplicados[1]!.centavos).toBe(11_855);
    expect(r.netoCentavos).toBe(106_693);
  });
});
