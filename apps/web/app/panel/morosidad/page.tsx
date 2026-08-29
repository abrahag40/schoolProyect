'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, Insignia, Tarjeta } from '@azahar/ui';
import { enviarJson, pedirApi } from '../../api';

interface Pagador {
  tutorId: string;
  nombre: string;
}

interface SituacionLegal {
  periodosEnMora: number;
  puedeSuspender: boolean;
  explicacion: string;
}

interface FamiliaMorosa {
  alumnoId: string;
  alumno: string;
  pagadores: Pagador[];
  saldo: string;
  diasDeAtraso: number;
  situacion: SituacionLegal;
}

interface Morosidad {
  hoy: string;
  cobrado: string;
  porCobrar: string;
  vencido: string;
  familias: FamiliaMorosa[];
}

interface ResultadoPago {
  pagoId: string;
  aplicado: string;
  saldoAFavor: string;
  aplicaciones: Array<{ concepto: string; periodo: string; monto: string }>;
}

/**
 * "41000.00" -> "41,000.00". Separadores de millar para que la cifra se lea de
 * un vistazo.
 *
 * Se formatea la CADENA, no un número: convertir el importe a `number` para
 * darle formato lo haría pasar por punto flotante, que es justo lo que §4
 * prohíbe. Aquí solo se insertan comas en la parte entera.
 */
function conSeparadores(monto: string): string {
  const [entero = '0', decimales = '00'] = monto.split('.');
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
}

/** Lee un campo de texto de un formulario, sin dejar pasar un File como texto. */
function campoTexto(formulario: FormData, nombre: string): string {
  const valor = formulario.get(nombre);
  return typeof valor === 'string' ? valor : '';
}

/**
 * Panel de morosidad (AZ-M4.8) — pantalla 5 de la matriz D10.
 *
 * Tres decisiones que vienen del wireframe aprobado y de la ley:
 *
 *  1. **Los tres números arriba y siempre visibles.** Es lo que el director
 *     mira primero, antes que cualquier tabla.
 *  2. **La lectura legal ya hecha.** El Artículo 7 del Acuerdo de PROFECO
 *     permite suspender el servicio tras tres colegiaturas impagas, con 15 días
 *     de aviso. La escuela no debería tener que recordarlo: el panel le dice
 *     dónde está parada, y cuántos meses faltan si aún no puede.
 *  3. **El pago se registra aquí mismo.** Ver quién debe y tener que ir a otra
 *     sección a capturar el abono es la fricción que hace que caja siga usando
 *     su libreta.
 */
export default function PaginaMorosidad() {
  const router = useRouter();
  const [datos, setDatos] = useState<Morosidad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<FamiliaMorosa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [recibo, setRecibo] = useState<ResultadoPago | null>(null);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;

    void (async () => {
      const { estado, datos: cuerpo } = await pedirApi<Morosidad>('/morosidad');
      if (!vigente) return;

      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (estado === 403) {
        setError('Esta sección es para administración y cobranza.');
        return;
      }
      if (!cuerpo) {
        setError('No pudimos cargar la cobranza.');
        return;
      }
      setDatos(cuerpo);
    })();

    return () => {
      vigente = false;
    };
  }, [router, recarga]);

  async function registrarPago(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!cobrando) return;

    setGuardando(true);
    setError(null);
    const formulario = new FormData(evento.currentTarget);

    const {
      ok,
      datos: resultado,
      error: fallo,
    } = await enviarJson<ResultadoPago>('/pagos', {
      tutorId: campoTexto(formulario, 'tutorId'),
      monto: campoTexto(formulario, 'monto'),
      fecha: campoTexto(formulario, 'fecha'),
      metodo: campoTexto(formulario, 'metodo'),
      ...(campoTexto(formulario, 'referencia')
        ? { referencia: campoTexto(formulario, 'referencia') }
        : {}),
    });

    setGuardando(false);
    if (!ok || !resultado) {
      setError(fallo?.detalles?.[0]?.mensaje ?? fallo?.message ?? 'No pudimos registrar el pago.');
      return;
    }

    setRecibo(resultado);
    setCobrando(null);
    setRecarga((n) => n + 1);
  }

  return (
    <main style={{ maxWidth: 880, margin: '0 auto', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <Boton variante="texto" onClick={() => router.push('/panel')} style={{ padding: 0 }}>
          ‹ Panel
        </Boton>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginTop: 'var(--space-2)' }}>Cobranza</h1>
        <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-2)' }}>
          Quién debe, desde cuándo y cuánto. Al {datos?.hoy ?? '…'}.
        </p>
      </header>

      {error && (
        <Tarjeta>
          <p role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        </Tarjeta>
      )}

      {/* Los tres números, arriba y JUNTOS.
          `minmax(0, 1fr)` en tres columnas fijas y no `auto-fit`: con auto-fit
          los tres se apilaban a 360 px y empujaban la tabla fuera de pantalla,
          que es exactamente lo contrario de lo que pide el wireframe D10 —
          "arriba y siempre visibles". Verificado en el navegador a 360 px. */}
      {datos && (
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-2)',
            // 9rem de mínimo: a 360 px caben dos por fila y la tercera baja,
            // así los tres siguen visibles sin que la página scrollee de lado
            // ni se corten los importes. Con tres columnas fijas, "$41,000.00"
            // se desbordaba — visto en el navegador, no supuesto.
            gridTemplateColumns: 'repeat(auto-fit, minmax(9rem, 1fr))',
            marginBottom: 'var(--space-4)',
          }}
        >
          <Cifra etiqueta="Cobrado" valor={datos.cobrado} />
          <Cifra etiqueta="Por cobrar" valor={datos.porCobrar} />
          <Cifra
            etiqueta="Vencido"
            valor={datos.vencido}
            pie={`${datos.familias.length} ${datos.familias.length === 1 ? 'familia' : 'familias'}`}
          />
        </div>
      )}

      {recibo && (
        <Tarjeta titulo="Pago registrado">
          <div role="status">
            <p style={{ margin: 'var(--space-2) 0' }}>
              Se aplicaron <strong>${conSeparadores(recibo.aplicado)}</strong>
              {recibo.saldoAFavor !== '0.00' && (
                <>
                  {' '}
                  y quedaron <strong>${conSeparadores(recibo.saldoAFavor)}</strong> a favor de la
                  familia
                </>
              )}
              .
            </p>
            {recibo.aplicaciones.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 'var(--space-4)' }}>
                {recibo.aplicaciones.map((a, i) => (
                  <li key={`${a.periodo}-${i}`}>
                    {a.concepto} de {a.periodo}: ${conSeparadores(a.monto)}
                  </li>
                ))}
              </ul>
            )}
            <div style={{ marginTop: 'var(--space-3)' }}>
              <Boton variante="secundario" onClick={() => setRecibo(null)}>
                Cerrar
              </Boton>
            </div>
          </div>
        </Tarjeta>
      )}

      {datos?.familias.length === 0 && (
        <Tarjeta>
          <p style={{ margin: 0 }}>
            Nadie debe nada. Toda la escuela está al corriente — vale la pena decirlo.
          </p>
        </Tarjeta>
      )}

      <div style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
        {datos?.familias.map((f) => (
          <Tarjeta key={f.alumnoId}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--space-3)',
                flexWrap: 'wrap',
                alignItems: 'flex-start',
              }}
            >
              <div>
                <strong style={{ fontSize: 'var(--font-size-lg)' }}>{f.alumno}</strong>
                <p
                  style={{
                    margin: 'var(--space-1) 0 0',
                    color: 'var(--texto-tenue)',
                    fontSize: 'var(--font-size-sm)',
                  }}
                >
                  {/* Vacío ≠ error: una familia sin pagadores registrados es el
                      estado real de una escuela recién migrada, y decirlo es
                      más útil que dejar un hueco que parece una falla de carga. */}
                  {f.pagadores.length === 0
                    ? 'Sin pagador registrado — hay que darlo de alta para poder cobrarle'
                    : `Paga${f.pagadores.length > 1 ? 'n' : ''}: ${f.pagadores
                        .map((p) => p.nombre)
                        .join(' · ')}`}
                </p>
              </div>
              <span
                style={{
                  fontSize: 'var(--font-size-2xl)',
                  fontWeight: 'var(--font-weight-bold)',
                  color: 'var(--texto-primario)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                ${conSeparadores(f.saldo)}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-3)',
                flexWrap: 'wrap',
              }}
            >
              {/* Las insignias llevan TEXTO, no solo tono: el estado nunca se
                  comunica únicamente con color (WCAG 2.2 SC 1.4.1). */}
              <Insignia tono={f.diasDeAtraso > 0 ? 'peligro' : 'neutro'}>
                {f.diasDeAtraso > 0 ? `${f.diasDeAtraso} días de atraso` : 'Sin vencer'}
              </Insignia>
              <Insignia tono={f.situacion.puedeSuspender ? 'peligro' : 'neutro'}>
                {f.situacion.periodosEnMora}{' '}
                {f.situacion.periodosEnMora === 1 ? 'mes vencido' : 'meses vencidos'}
              </Insignia>
            </div>

            {/* La lectura legal, hecha por el sistema. */}
            <p
              style={{
                margin: 'var(--space-3) 0 0',
                fontSize: 'var(--font-size-sm)',
                color: 'var(--texto-tenue)',
              }}
            >
              {f.situacion.explicacion}
            </p>

            {f.pagadores.length > 0 && (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <Boton
                  variante="secundario"
                  onClick={() => {
                    setRecibo(null);
                    setCobrando(cobrando?.alumnoId === f.alumnoId ? null : f);
                  }}
                  aria-expanded={cobrando?.alumnoId === f.alumnoId}
                >
                  {cobrando?.alumnoId === f.alumnoId ? 'Cancelar' : 'Registrar un pago'}
                </Boton>
              </div>
            )}

            {cobrando?.alumnoId === f.alumnoId && (
              <form
                onSubmit={(evento) => {
                  void registrarPago(evento);
                }}
                style={{
                  display: 'grid',
                  gap: 'var(--space-3)',
                  marginTop: 'var(--space-3)',
                  paddingTop: 'var(--space-3)',
                  borderTop: '1px solid var(--borde)',
                }}
              >
                <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                  <label htmlFor={`tutor-${f.alumnoId}`} style={etiquetaEstilo}>
                    Quién paga
                  </label>
                  <select id={`tutor-${f.alumnoId}`} name="tutorId" style={campoEstilo}>
                    {f.pagadores.map((p) => (
                      <option key={p.tutorId} value={p.tutorId}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                  <label htmlFor={`monto-${f.alumnoId}`} style={etiquetaEstilo}>
                    Importe recibido
                  </label>
                  <input
                    id={`monto-${f.alumnoId}`}
                    name="monto"
                    inputMode="decimal"
                    placeholder="1470.00"
                    style={campoEstilo}
                  />
                  <span style={ayudaEstilo}>
                    Se aplica automáticamente al mes más antiguo. Lo que sobre queda a favor de la
                    familia.
                  </span>
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                  <label htmlFor={`fecha-${f.alumnoId}`} style={etiquetaEstilo}>
                    Fecha del pago
                  </label>
                  <input
                    id={`fecha-${f.alumnoId}`}
                    name="fecha"
                    type="date"
                    defaultValue={datos?.hoy}
                    style={campoEstilo}
                  />
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                  <label htmlFor={`metodo-${f.alumnoId}`} style={etiquetaEstilo}>
                    Cómo pagó
                  </label>
                  <select
                    id={`metodo-${f.alumnoId}`}
                    name="metodo"
                    defaultValue="TRANSFERENCIA"
                    style={campoEstilo}
                  >
                    <option value="TRANSFERENCIA">Transferencia</option>
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="DEPOSITO">Depósito</option>
                    <option value="TARJETA">Tarjeta</option>
                    <option value="OTRO">Otro</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                  <label htmlFor={`ref-${f.alumnoId}`} style={etiquetaEstilo}>
                    Folio o referencia
                  </label>
                  <input id={`ref-${f.alumnoId}`} name="referencia" style={campoEstilo} />
                  <span style={ayudaEstilo}>
                    Opcional, pero es lo que permite encontrar el pago en el estado de cuenta del
                    banco.
                  </span>
                </div>

                <Boton type="submit" cargando={guardando}>
                  Registrar pago
                </Boton>
              </form>
            )}
          </Tarjeta>
        ))}
      </div>
    </main>
  );
}

const etiquetaEstilo = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--titulo)',
} as const;

const campoEstilo = {
  minHeight: 'var(--size-touch-target)',
  padding: '0 var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--borde)',
  background: 'var(--superficie)',
  color: 'var(--texto)',
  fontSize: 'var(--font-size-base)',
  fontFamily: 'var(--font-family-sans)',
} as const;

const ayudaEstilo = { fontSize: 'var(--font-size-sm)', color: 'var(--texto-tenue)' } as const;

function Cifra({ etiqueta, valor, pie }: { etiqueta: string; valor: string; pie?: string }) {
  return (
    <Tarjeta>
      <p style={{ color: 'var(--texto-tenue)', fontSize: 'var(--font-size-xs)', margin: 0 }}>
        {etiqueta}
      </p>
      <p
        style={{
          // Escala con el ancho: legible a 360 px sin partirse, grande en
          // escritorio, que es donde vive esta pantalla.
          fontSize: 'clamp(var(--font-size-lg), 4vw, var(--font-size-2xl))',
          fontWeight: 'var(--font-weight-extrabold)',
          color: 'var(--texto-primario)',
          margin: 'var(--space-1) 0 0',
          // Los dígitos alineados en columna se comparan de un vistazo.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        ${conSeparadores(valor)}
      </p>
      {pie && (
        <p style={{ color: 'var(--texto-tenue)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
          {pie}
        </p>
      )}
    </Tarjeta>
  );
}
