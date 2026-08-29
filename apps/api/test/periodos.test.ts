/**
 * Periodos de cobro (AZ-M4.1c) — probados sin base de datos (§13 capa 1).
 *
 * Lo que esta capa protege: que el cargo de una escuela que cobra por semestre
 * caiga en el semestre correcto. Equivocarse aqui no rompe una pantalla — cobra
 * dos veces el mismo periodo, o ninguna.
 *
 * El caso que ordena todo el archivo es el del ciclo escolar mexicano, que
 * arranca en agosto: el primer semestre va de agosto a enero y CRUZA el año.
 * Anclarlo al calendario daria "semestre de enero a junio", un periodo del que
 * nadie habla en esa escuela.
 */
import { describe, it, expect } from 'vitest';
import {
  esPeriodoValido,
  mesesDelPeriodo,
  periodoDeFecha,
  periodoLegible,
  periodosPorCiclo,
  primerMes,
} from '../src/cobranza/periodos.js';

/// Ciclo escolar K-12 mexicano: arranca en agosto y termina en julio.
const CICLO = '2026-08-17';
/// Ciclo de una universidad que arranca en enero, para probar que el anclaje
/// no esta escrito a la medida del caso de agosto.
const CICLO_ENERO = '2026-01-15';

describe('la forma de la clave', () => {
  it('acepta el mes de siempre', () => {
    expect(esPeriodoValido('2026-09')).toBe(true);
    expect(esPeriodoValido('2026-01')).toBe(true);
    expect(esPeriodoValido('2026-12')).toBe(true);
  });

  it('acepta bimestres, cuatrimestres, semestres y el ciclo entero', () => {
    expect(esPeriodoValido('2026-B1')).toBe(true);
    expect(esPeriodoValido('2026-B6')).toBe(true);
    expect(esPeriodoValido('2026-C3')).toBe(true);
    expect(esPeriodoValido('2026-S2')).toBe(true);
    expect(esPeriodoValido('2026-A1')).toBe(true);
  });

  it('NO-camino: rechaza periodos que no existen', () => {
    // Un tercer semestre no existe, igual que no existe el mes 13. Aceptarlo
    // produciria un cargo que nadie sabe cuando vence.
    expect(esPeriodoValido('2026-S3')).toBe(false);
    expect(esPeriodoValido('2026-B7')).toBe(false);
    expect(esPeriodoValido('2026-C4')).toBe(false);
    expect(esPeriodoValido('2026-A2')).toBe(false);
    expect(esPeriodoValido('2026-13')).toBe(false);
    expect(esPeriodoValido('2026-00')).toBe(false);
    expect(esPeriodoValido('2026-X1')).toBe(false);
    expect(esPeriodoValido('2026')).toBe(false);
    expect(esPeriodoValido('')).toBe(false);
  });

  it('toda clave valida cabe en los 7 caracteres de la columna', () => {
    // La migracion NO ensancha `periodo VarChar(7)`: solo admite mas formas.
    // Si algun formato creciera, la escritura fallaria en produccion y no aqui.
    for (const clave of ['2026-09', '2026-B6', '2026-C3', '2026-S2', '2026-A1']) {
      expect(clave.length, `${clave} no cabe en VarChar(7)`).toBeLessThanOrEqual(7);
    }
  });
});

describe('cuantos periodos caben en un ciclo', () => {
  it('la aritmetica no se escribe a mano en ningun otro lado', () => {
    expect(periodosPorCiclo('MENSUAL')).toBe(12);
    expect(periodosPorCiclo('BIMESTRAL')).toBe(6);
    expect(periodosPorCiclo('CUATRIMESTRAL')).toBe(3);
    expect(periodosPorCiclo('SEMESTRAL')).toBe(2);
    expect(periodosPorCiclo('ANUAL')).toBe(1);
    expect(periodosPorCiclo('UNICO')).toBe(1);
  });
});

describe('en que periodo cae una fecha (ciclo de agosto)', () => {
  it('el mes sigue siendo el mes', () => {
    expect(periodoDeFecha('2026-09-14', 'MENSUAL', CICLO)).toBe('2026-09');
  });

  it('agosto abre el primer semestre y enero lo cierra: el semestre CRUZA el año', () => {
    // Este es el caso que el modelo viejo no podia expresar.
    expect(periodoDeFecha('2026-08-20', 'SEMESTRAL', CICLO)).toBe('2026-S1');
    expect(periodoDeFecha('2026-12-01', 'SEMESTRAL', CICLO)).toBe('2026-S1');
    expect(periodoDeFecha('2027-01-31', 'SEMESTRAL', CICLO)).toBe('2026-S1');
  });

  it('febrero abre el segundo semestre, y sigue llamandose ciclo 2026', () => {
    // El año de la clave es el de INICIO del ciclo: si cambiara en enero, el
    // mismo ciclo escolar quedaria partido en dos claves distintas.
    expect(periodoDeFecha('2027-02-01', 'SEMESTRAL', CICLO)).toBe('2026-S2');
    expect(periodoDeFecha('2027-07-31', 'SEMESTRAL', CICLO)).toBe('2026-S2');
  });

  it('los seis bimestres del ciclo, en orden', () => {
    const esperado: Array<[string, string]> = [
      ['2026-08-17', '2026-B1'],
      ['2026-09-30', '2026-B1'],
      ['2026-10-01', '2026-B2'],
      ['2026-12-15', '2026-B3'],
      ['2027-02-10', '2026-B4'],
      ['2027-04-05', '2026-B5'],
      ['2027-06-30', '2026-B6'],
    ];
    for (const [fecha, clave] of esperado) {
      expect(periodoDeFecha(fecha, 'BIMESTRAL', CICLO), fecha).toBe(clave);
    }
  });

  it('los tres cuatrimestres del ciclo', () => {
    expect(periodoDeFecha('2026-08-17', 'CUATRIMESTRAL', CICLO)).toBe('2026-C1');
    expect(periodoDeFecha('2026-12-01', 'CUATRIMESTRAL', CICLO)).toBe('2026-C2');
    expect(periodoDeFecha('2027-04-01', 'CUATRIMESTRAL', CICLO)).toBe('2026-C3');
  });

  it('lo anual y lo unico son el ciclo entero, una sola clave', () => {
    expect(periodoDeFecha('2026-08-17', 'ANUAL', CICLO)).toBe('2026-A1');
    expect(periodoDeFecha('2027-07-01', 'ANUAL', CICLO)).toBe('2026-A1');
    expect(periodoDeFecha('2026-11-11', 'UNICO', CICLO)).toBe('2026-A1');
  });

  it('NO-camino: fuera del ciclo no hay periodo, y se dice con null', () => {
    // Pedir los cargos de un mes anterior al arranque es una peticion legitima
    // que sencillamente no produce nada. No es un error que atrapar.
    expect(periodoDeFecha('2026-07-31', 'SEMESTRAL', CICLO)).toBeNull();
    expect(periodoDeFecha('2027-08-01', 'SEMESTRAL', CICLO)).toBeNull();
  });
});

describe('el anclaje no esta escrito a la medida de agosto', () => {
  it('una universidad que arranca en enero tiene su S1 de enero a junio', () => {
    expect(periodoDeFecha('2026-01-20', 'SEMESTRAL', CICLO_ENERO)).toBe('2026-S1');
    expect(periodoDeFecha('2026-06-30', 'SEMESTRAL', CICLO_ENERO)).toBe('2026-S1');
    expect(periodoDeFecha('2026-07-01', 'SEMESTRAL', CICLO_ENERO)).toBe('2026-S2');
    expect(periodoDeFecha('2026-12-31', 'SEMESTRAL', CICLO_ENERO)).toBe('2026-S2');
  });
});

describe('de que meses se compone un periodo', () => {
  it('un semestre de un ciclo de agosto son seis meses que cruzan el año', () => {
    expect(mesesDelPeriodo('2026-S1', CICLO)).toEqual([
      '2026-08',
      '2026-09',
      '2026-10',
      '2026-11',
      '2026-12',
      '2027-01',
    ]);
  });

  it('el segundo semestre continua donde termino el primero, sin huecos ni solapes', () => {
    const primero = mesesDelPeriodo('2026-S1', CICLO);
    const segundo = mesesDelPeriodo('2026-S2', CICLO);
    expect(segundo[0]).toBe('2027-02');
    expect(new Set([...primero, ...segundo]).size).toBe(12);
  });

  it('los seis bimestres cubren el ciclo completo exactamente una vez', () => {
    // INVARIANTE: sin huecos y sin solapes. Un mes en dos bimestres se cobraria
    // dos veces; un mes en ninguno no se cobraria nunca.
    const todos = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'].flatMap((b) =>
      mesesDelPeriodo(`2026-${b}`, CICLO),
    );
    expect(todos).toHaveLength(12);
    expect(new Set(todos).size).toBe(12);
  });

  it('lo mismo para cuatrimestres y para el ciclo entero', () => {
    const cuatri = ['C1', 'C2', 'C3'].flatMap((c) => mesesDelPeriodo(`2026-${c}`, CICLO));
    expect(new Set(cuatri).size).toBe(12);
    expect(mesesDelPeriodo('2026-A1', CICLO)).toHaveLength(12);
  });

  it('un mes se compone de si mismo', () => {
    expect(mesesDelPeriodo('2026-09', CICLO)).toEqual(['2026-09']);
  });

  it('el primer mes es donde vence el periodo', () => {
    expect(primerMes('2026-S2', CICLO)).toBe('2027-02');
    expect(primerMes('2026-09', CICLO)).toBe('2026-09');
  });
});

describe('como se lee en pantalla', () => {
  it('la familia no lee 2026-S1', () => {
    expect(periodoLegible('2026-S1')).toBe('1º semestre 2026');
    expect(periodoLegible('2026-B4')).toBe('4º bimestre 2026');
    expect(periodoLegible('2026-C2')).toBe('2º cuatrimestre 2026');
    expect(periodoLegible('2026-A1')).toBe('ciclo completo 2026');
  });

  it('un mes se deja como esta: la pantalla ya sabe traducirlo', () => {
    expect(periodoLegible('2026-09')).toBe('2026-09');
  });
});
