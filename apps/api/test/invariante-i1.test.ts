/**
 * INVARIANTE I1 DEL LEDGER — property-based (AZ-M4.1, Definition of Done del S6).
 *
 * Las demas pruebas del dinero verifican casos que a alguien se le ocurrieron.
 * Esta verifica una PROPIEDAD sobre secuencias aleatorias de operaciones: da
 * igual en que orden lleguen los cargos, las becas, los prorrateos, los pagos y
 * los descuentos por pronto pago — el dinero tiene que cerrar.
 *
 * Por que hace falta ademas de las otras: los defectos del dinero rara vez viven
 * en el caso que se te ocurre probar. Viven en la tercera aplicacion parcial
 * despues de un descuento que se recorto, sobre un importe cuyo redondeo cae
 * justo en el medio centavo. Un generador aleatorio llega ahi en dos segundos;
 * una persona escribiendo casos, nunca.
 *
 * ============================================================================
 * QUE DICE I1, EN NUESTRO MODELO
 * ============================================================================
 * El Plan Maestro la enuncio como "Σ cargos = Σ abonos + saldo". Con el modelo
 * que el Sprint 6 dejo —precio de lista mas asientos— se descompone en tres
 * propiedades que se prueban por separado, porque cada una puede romperse sin
 * la otra y mezclarlas haria que un fallo no dijera donde esta el defecto:
 *
 *   I1a  precio de lista = Σ descuentos de emision + neto repartible
 *   I1b  para cada parte: importe = Σ pagado + Σ condonado + saldo
 *   I1c  el dinero que entra no se pierde: Σ aplicado + sobrante = pago
 *
 * NO se prueba contra la base: se prueba contra las funciones puras, que son
 * las que deciden. El cableado contra Postgres lo cubren `cobranza.test.ts` y
 * `saldo-a-favor.test.ts` con sus consultas de cuadre.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { repartir } from '../src/cobranza/reglas.js';
import {
  calcularDescuentos,
  descuentoPorProrrateo,
  proporcionDelPeriodo,
  type CategoriaDescuento,
  type DescuentoAplicable,
} from '../src/cobranza/descuentos.js';
import { aplicarPagoConProntoPago, saldoDeParte } from '../src/cobranza/saldos.js';

/// Importes de escuela real: de un peso a cien mil. En centavos enteros (§43).
const importe = fc.integer({ min: 1, max: 10_000_000 });

/// Porcentajes con dos decimales, como los admite la base.
const porcentaje = fc
  .integer({ min: 1, max: 10_000 })
  .map((n) => Math.round(n) / 100);

const categoria: fc.Arbitrary<CategoriaDescuento> = fc.constantFrom(
  'PRORRATEO',
  'BECA',
  'DESCUENTO',
);

const descuento: fc.Arbitrary<DescuentoAplicable> = fc
  .tuple(fc.string({ minLength: 1, maxLength: 6 }), categoria, fc.boolean(), porcentaje, importe)
  .map(([referencia, cat, esPorcentaje, pct, centavos]) => ({
    referencia,
    categoria: cat,
    tipo: esPorcentaje ? ('PORCENTAJE' as const) : ('MONTO_FIJO' as const),
    valor: esPorcentaje ? pct : centavos,
    concepto: `Descuento ${referencia}`,
  }));

describe('I1a · el precio de lista siempre se explica entero', () => {
  it('lista = Σ descuentos + neto, para cualquier combinación', () => {
    fc.assert(
      fc.property(importe, fc.array(descuento, { maxLength: 6 }), (base, ds) => {
        const r = calcularDescuentos(base, ds);
        // Si esto no cierra, hay un renglón del estado de cuenta que nadie
        // puede justificar — y la familia se entera antes que nosotros.
        expect(r.totalCentavos + r.netoCentavos).toBe(base);
        expect(r.netoCentavos).toBeGreaterThanOrEqual(0);
        // Ningún asiento puede ser de cero o negativo: la base lo rechazaría.
        for (const a of r.aplicados) expect(a.centavos).toBeGreaterThan(0);
      }),
      { numRuns: 2000 },
    );
  });

  it('el orden de llegada NUNCA cambia el resultado', () => {
    // Dos administradoras capturando las mismas becas en distinto orden tienen
    // que producir el mismo importe. Si no, el corte depende de quién capturó.
    fc.assert(
      fc.property(importe, fc.array(descuento, { maxLength: 6 }), (base, ds) => {
        const directo = calcularDescuentos(base, ds);
        const alReves = calcularDescuentos(base, [...ds].reverse());
        expect(alReves.netoCentavos).toBe(directo.netoCentavos);
      }),
      { numRuns: 1000 },
    );
  });

  it('el prorrateo nunca cobra más que el periodo completo ni menos que cero', () => {
    fc.assert(
      fc.property(
        importe,
        fc.integer({ min: 0, max: 400 }),
        fc.integer({ min: 1, max: 400 }),
        (base, diasDeAlta, duracion) => {
          const inicio = Date.UTC(2026, 7, 1);
          const dia = 86_400_000;
          const fecha = (ms: number) => new Date(ms).toISOString().slice(0, 10);
          const p = proporcionDelPeriodo({
            inicioDelPeriodo: fecha(inicio),
            finDelPeriodo: fecha(inicio + duracion * dia),
            altaEn: fecha(inicio + diasDeAlta * dia),
          });
          const d = descuentoPorProrrateo(base, p);
          expect(d).toBeGreaterThanOrEqual(0);
          expect(d).toBeLessThanOrEqual(base);
        },
      ),
      { numRuns: 2000 },
    );
  });
});

describe('I1b · el reparto entre pagadores no pierde ni inventa centavos', () => {
  it('Σ partes = neto exacto, con cualquier reparto que sume 100', () => {
    // El defecto que esto persigue: repartir 100.00 en tres partes iguales
    // redondeando cada una da 99.99, y ese centavo reaparece meses después
    // como "el corte no cuadra" sin que nadie asocie el síntoma con la causa.
    const reparto = fc
      .array(fc.integer({ min: 1, max: 99 }), { minLength: 1, maxLength: 5 })
      .map((pesos) => {
        const total = pesos.reduce((a, b) => a + b, 0);
        // Se normaliza a 100 exacto, que es lo que el dominio exige.
        const partes = pesos.map((p) => Math.floor((p * 10_000) / total));
        const falta = 10_000 - partes.reduce((a, b) => a + b, 0);
        partes[0] = (partes[0] ?? 0) + falta;
        return partes.map((p, i) => ({ referencia: `t${i}`, porcentaje: p / 100 }));
      })
      .filter((ps) => ps.every((p) => p.porcentaje > 0));

    fc.assert(
      fc.property(importe, reparto, (neto, pagadores) => {
        const partes = repartir(neto, pagadores);
        expect(partes.reduce((a, p) => a + p.centavos, 0)).toBe(neto);
        for (const p of partes) expect(p.centavos).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 2000 },
    );
  });
});

describe('I1c · el dinero que entra no se pierde ni se duplica', () => {
  const parte = fc
    .tuple(fc.string({ minLength: 1, maxLength: 4 }), importe, fc.boolean(), porcentaje)
    .map(([referencia, saldoCentavos, conProntoPago, pct]) => ({
      referencia,
      vence: '2026-09-05',
      saldoCentavos,
      prontoPago: conProntoPago ? { hasta: '2026-09-03', porcentaje: pct } : null,
    }));

  /**
   * Partes con referencia UNICA.
   *
   * El generador ingenuo permitia dos partes con la misma referencia, y la
   * propiedad se puso roja con un contraejemplo de dos centavos. NO era un
   * defecto del codigo: era del generador. Una referencia es el UUID de la
   * parte, y dos partes del mismo cargo para el mismo pagador no existen — la
   * base lo impide con `@@unique([cargoId, tutorId])`.
   *
   * Se deja escrito porque relajar una propiedad que se pone roja es
   * exactamente como se pierde un gate, y la diferencia entre "el generador
   * miente" y "el codigo falla" hay que argumentarla, no suponerla.
   */
  const partesUnicas = fc.uniqueArray(parte, {
    maxLength: 5,
    selector: (p) => p.referencia,
  });

  it('aplicado + sobrante = lo que entró, con o sin pronto pago', () => {
    fc.assert(
      fc.property(
        importe,
        partesUnicas,
        fc.constantFrom('2026-09-01', '2026-09-03', '2026-09-04'),
        (monto, partes, fecha) => {
          const r = aplicarPagoConProntoPago(monto, partes, fecha);
          const aplicado = r.aplicaciones.reduce((a, x) => a + x.centavos, 0);
          expect(aplicado + r.sobranteCentavos).toBe(monto);
        },
      ),
      { numRuns: 3000 },
    );
  });

  it('ninguna parte recibe —en dinero más condonación— más de lo que debía', () => {
    // Aplicar de más a una parte deja saldo negativo, que se leería como "la
    // escuela le debe al padre". Ese número no existe en este dominio.
    fc.assert(
      fc.property(
        importe,
        partesUnicas,
        fc.constantFrom('2026-09-01', '2026-09-04'),
        (monto, partes, fecha) => {
          const r = aplicarPagoConProntoPago(monto, partes, fecha);
          for (const a of r.aplicaciones) {
            const original = partes.find((p) => p.referencia === a.referencia)!;
            expect(a.centavos + a.descuentoCentavos).toBeLessThanOrEqual(original.saldoCentavos);
            expect(saldoDeParte(original.saldoCentavos, a.centavos + a.descuentoCentavos))
              .toBeGreaterThanOrEqual(0);
          }
        },
      ),
      { numRuns: 3000 },
    );
  });

  it('fuera de la ventana NUNCA se condona un peso', () => {
    // La regla legal al revés: cobrar de más está mal, pero regalar dinero de
    // la escuela sin que se haya ganado el premio también.
    fc.assert(
      fc.property(importe, partesUnicas, (monto, partes) => {
        const r = aplicarPagoConProntoPago(monto, partes, '2026-12-31');
        expect(r.descuentoTotalCentavos).toBe(0);
      }),
      { numRuns: 1000 },
    );
  });
});

/**
 * La cadena entera: precio de lista → descuentos → reparto → pago.
 *
 * Es la unica prueba que recorre las cuatro etapas de una vez, y existe porque
 * cada modulo puede estar bien por separado y perder un centavo en la costura.
 */
describe('I1 completa · de la lista al saldo, sin fugas', () => {
  it('lista = descuentos + pagado + condonado + pendiente', () => {
    fc.assert(
      fc.property(
        importe,
        fc.array(descuento, { maxLength: 4 }),
        fc.array(fc.integer({ min: 1, max: 99 }), { minLength: 1, maxLength: 3 }),
        importe,
        (lista, ds, pesos, pago) => {
          // 1 · Descuentos de emisión sobre el precio de lista.
          const { totalCentavos: descontado, netoCentavos: neto } = calcularDescuentos(lista, ds);

          // 2 · Reparto del neto entre pagadores.
          const total = pesos.reduce((a, b) => a + b, 0);
          const bp = pesos.map((p) => Math.floor((p * 10_000) / total));
          bp[0] = (bp[0] ?? 0) + (10_000 - bp.reduce((a, b) => a + b, 0));
          const pagadores = bp.map((p, i) => ({ referencia: `t${i}`, porcentaje: p / 100 }));
          if (pagadores.some((p) => p.porcentaje <= 0)) return;
          const partes = repartir(neto, pagadores);

          // 3 · Un pago contra esas partes.
          const r = aplicarPagoConProntoPago(
            pago,
            partes.map((p) => ({
              referencia: p.referencia,
              vence: '2026-09-05',
              saldoCentavos: p.centavos,
              prontoPago: null,
            })),
            '2026-09-01',
          );
          const pagado = r.aplicaciones.reduce((a, x) => a + x.centavos, 0);
          const condonado = r.aplicaciones.reduce((a, x) => a + x.descuentoCentavos, 0);
          const pendiente = partes.reduce((acumulado, p) => {
            const a = r.aplicaciones.find((x) => x.referencia === p.referencia);
            const cubierto = a ? a.centavos + a.descuentoCentavos : 0;
            return acumulado + saldoDeParte(p.centavos, cubierto);
          }, 0);

          // I1: el precio de lista se explica ENTERO, sin un centavo suelto.
          expect(descontado + pagado + condonado + pendiente).toBe(lista);
        },
      ),
      { numRuns: 3000 },
    );
  });
});
