/**
 * Las reglas del motor de avisos, probadas SIN base de datos (§13 capa 1).
 *
 * El valor de esta capa es el NO-camino: comprobar que algo NO se avisa exige
 * montar la escuela entera si la regla vive dentro del controlador, y por eso
 * casi nadie lo prueba. Aqui cuesta tres lineas — y el sobre-aviso es el modo
 * de fallo mas probable de esta funcion: una familia que silencia la app deja
 * de recibir tambien lo importante.
 */
import { describe, it, expect } from 'vitest';
import {
  avisosPorRegistro,
  fechaEscolar,
  fechaFueraDeRango,
  fechaLegible,
  inicioDeVentana,
  TIPO_ACUMULADA,
  TIPO_FALTA,
  type ParametrosAviso,
} from '../src/asistencia/reglas.js';

const BASE: ParametrosAviso = { umbralFaltas: 3, ventanaDias: 30, avisarFaltaDelDia: true };

const registro = (extra: Partial<Parameters<typeof avisosPorRegistro>[0]> = {}) =>
  avisosPorRegistro({
    alumnoId: 'a1',
    nombreAlumno: 'Sofía',
    fecha: '2026-09-03',
    estado: 'AUSENTE',
    faltasEnVentana: 1,
    parametros: BASE,
    ...extra,
  });

describe('que SI avisa', () => {
  it('una falta genera el aviso del dia, con la fecha en lenguaje de persona', () => {
    const avisos = registro();
    expect(avisos).toHaveLength(1);
    expect(avisos[0]!.tipo).toBe(TIPO_FALTA);
    expect(avisos[0]!.titulo).toContain('Sofía');
    expect(avisos[0]!.cuerpo).toContain('3 de septiembre');
    // Y dice que hacer si el aviso es un error: acusar sin salida pone a la
    // familia a la defensiva.
    expect(avisos[0]!.cuerpo).toMatch(/no necesitas hacer nada/i);
  });

  it('al alcanzar el umbral se suma el aviso acumulado, que dice CUANTAS faltas van', () => {
    const avisos = registro({ faltasEnVentana: 3 });
    expect(avisos.map((a) => a.tipo)).toEqual([TIPO_FALTA, TIPO_ACUMULADA]);
    // El mecanismo con evidencia (Rogers & Feller 2018) es corregir la
    // creencia del padre sobre el acumulado: el numero DEBE estar en el texto.
    expect(avisos[1]!.titulo).toContain('3 faltas');
    expect(avisos[1]!.cuerpo).toContain('30 días');
  });

  it('pasado el umbral tambien avisa: una carga masiva puede saltarse el numero exacto', () => {
    const avisos = registro({ faltasEnVentana: 7 });
    expect(avisos.map((a) => a.tipo)).toContain(TIPO_ACUMULADA);
  });
});

describe('que NO avisa (el caso que nadie prueba)', () => {
  it('estar presente no genera nada', () => {
    expect(registro({ estado: 'PRESENTE', faltasEnVentana: 9 })).toEqual([]);
  });

  it('un retardo NO es una falta: no avisa aunque el alumno acumule', () => {
    expect(registro({ estado: 'RETARDO', faltasEnVentana: 9 })).toEqual([]);
  });

  it('una falta justificada no dispara alarma: la escuela ya conoce la causa', () => {
    expect(registro({ estado: 'JUSTIFICADA', faltasEnVentana: 9 })).toEqual([]);
  });

  it('bajo el umbral no hay aviso acumulado', () => {
    const avisos = registro({ faltasEnVentana: 2 });
    expect(avisos.map((a) => a.tipo)).toEqual([TIPO_FALTA]);
  });

  it('una escuela puede apagar el aviso diario y quedarse solo con el acumulado', () => {
    const avisos = registro({
      faltasEnVentana: 3,
      parametros: { ...BASE, avisarFaltaDelDia: false },
    });
    expect(avisos.map((a) => a.tipo)).toEqual([TIPO_ACUMULADA]);
  });
});

describe('idempotencia por clave estable (§15)', () => {
  it('la falta se identifica por alumno y dia: dos calculos, la misma clave', () => {
    expect(registro()[0]!.clave).toBe('falta:a1:2026-09-03');
    expect(registro()[0]!.clave).toBe(registro()[0]!.clave);
  });

  it('el acumulado se topa a uno por mes, aunque el alumno siga faltando', () => {
    const dia3 = registro({ fecha: '2026-09-03', faltasEnVentana: 3 })[1]!;
    const dia20 = registro({ fecha: '2026-09-20', faltasEnVentana: 6 })[1]!;
    // Misma clave => la base rechaza el segundo. La cadencia sale del estudio
    // (recordatorios espaciados), no del gusto: el goteo entrena a ignorar.
    expect(dia3.clave).toBe(dia20.clave);
    expect(dia3.clave).toBe('acumulada:a1:2026-09');
    // Y en octubre vuelve a poder avisar.
    expect(registro({ fecha: '2026-10-01', faltasEnVentana: 4 })[1]!.clave).toBe(
      'acumulada:a1:2026-10',
    );
  });
});

describe('fechas', () => {
  it('el dia escolar se calcula en la zona de LA ESCUELA, no en la del servidor', () => {
    // 03-sep 01:00 UTC es todavia el 2 de septiembre en Mexico. Un servidor en
    // UTC marcaria la falta del dia equivocado a las escuelas del noroeste.
    const instante = new Date('2026-09-03T01:00:00Z');
    expect(fechaEscolar(instante, 'America/Mexico_City')).toBe('2026-09-02');
    expect(fechaEscolar(instante, 'America/Tijuana')).toBe('2026-09-02');
    expect(fechaEscolar(instante, 'UTC')).toBe('2026-09-03');
  });

  it('no se pasa lista de un dia que todavia no ocurre', () => {
    expect(fechaFueraDeRango('2026-09-04', '2026-09-03')).toBe(true);
    expect(fechaFueraDeRango('2026-09-03', '2026-09-03')).toBe(false);
    // El pasado si: la justificacion llega dos dias despues, y hay que poder
    // corregir.
    expect(fechaFueraDeRango('2026-08-30', '2026-09-03')).toBe(false);
  });

  it('la ventana es inclusiva: 30 dias son hoy y los 29 anteriores', () => {
    expect(inicioDeVentana('2026-09-30', 30)).toBe('2026-09-01');
    expect(inicioDeVentana('2026-09-03', 1)).toBe('2026-09-03');
  });

  it('una fecha rara no revienta el formateo: se muestra tal cual', () => {
    expect(fechaLegible('no-es-fecha')).toBe('no-es-fecha');
  });
});
