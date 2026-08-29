'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, Insignia, Tarjeta } from '@azahar/ui';
import { enviarJson, pedirApi } from '../../api';

interface Beca {
  id: string;
  alumno: string;
  alumnoId: string;
  tipo: string;
  valor: string;
  concepto: { id: string; nombre: string } | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  motivo: string;
  esObligacionLegal: boolean;
  activa: boolean;
  vigenteHoy: boolean;
}

interface AlumnoParaBeca {
  id: string;
  nombre: string;
  cohorte: string | null;
}

interface ConceptoBreve {
  id: string;
  nombre: string;
}

function campoTexto(formulario: FormData, nombre: string): string {
  const valor = formulario.get(nombre);
  return typeof valor === 'string' ? valor : '';
}

/** "2026-08-01" -> "1 ago 2026". La vigencia se lee de un vistazo o no se lee. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${Number(dia)} ${MESES[Number(mes) - 1] ?? mes} ${anio}`;
}

/**
 * Becas y convenios (AZ-M4.3a).
 *
 * TRES DECISIONES QUE NO SON COSMÉTICAS:
 *
 *  1. **El motivo es obligatorio y se muestra.** La beca del 5 % de la matrícula
 *     es obligación legal (LGE 149-III), no cortesía. Una autoridad puede pedir
 *     a quién se otorgó y con qué criterio, y un descuento sin motivo no prueba
 *     nada. Por eso el campo no es opcional ni está escondido en un detalle.
 *  2. **La vigencia se dice en positivo y en negativo.** Una beca vencida sigue
 *     en la lista, marcada como vencida: desaparecerla haría creer que nunca
 *     existió, y los cargos que ya descontó seguirían ahí sin explicación.
 *  3. **Retirar no borra.** El botón dice "Retirar" porque eso es lo que hace.
 */
export default function PaginaBecas() {
  const router = useRouter();
  const [becas, setBecas] = useState<Beca[] | null>(null);
  const [alumnos, setAlumnos] = useState<AlumnoParaBeca[]>([]);
  const [conceptos, setConceptos] = useState<ConceptoBreve[]>([]);
  const [error, setError] = useState<string | null>(null);
  /// Sin permiso NO se muestra el formulario ni la lista: dejar un formulario
  /// que no se puede enviar, y un "Cargando…" eterno debajo, es peor que un
  /// mensaje seco. Lo cazo la revision en el navegador.
  const [sinPermiso, setSinPermiso] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tipo, setTipo] = useState<'PORCENTAJE' | 'MONTO_FIJO'>('PORCENTAJE');
  const [esLegal, setEsLegal] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;

    void (async () => {
      const { estado, datos } = await pedirApi<Beca[]>('/becas');
      if (!vigente) return;

      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (estado === 403) {
        setError('Esta sección es para administración y cobranza.');
        setSinPermiso(true);
        return;
      }
      if (!datos) {
        setError('No pudimos cargar las becas.');
        return;
      }
      setBecas(datos);

      // El catálogo y los alumnos alimentan el formulario; si fallan, la lista
      // sigue sirviendo. No se bloquea lo que ya se puede mostrar.
      const [{ datos: as }, { datos: cs }] = await Promise.all([
        pedirApi<AlumnoParaBeca[]>('/becas/alumnos'),
        pedirApi<ConceptoBreve[]>('/catalogo-cargos'),
      ]);
      if (!vigente) return;
      if (as) setAlumnos(as);
      if (cs) setConceptos(cs.map((c) => ({ id: c.id, nombre: c.nombre })));
    })();

    return () => {
      vigente = false;
    };
  }, [router, recarga]);

  async function otorgar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    const f = new FormData(evento.currentTarget);
    const hasta = campoTexto(f, 'vigenteHasta');
    const concepto = campoTexto(f, 'conceptoId');

    const { ok, error: fallo } = await enviarJson('/becas', {
      alumnoId: campoTexto(f, 'alumnoId'),
      tipo,
      valor: campoTexto(f, 'valor'),
      ...(concepto ? { conceptoId: concepto } : {}),
      vigenteDesde: campoTexto(f, 'vigenteDesde'),
      ...(hasta ? { vigenteHasta: hasta } : {}),
      motivo: campoTexto(f, 'motivo'),
      esObligacionLegal: esLegal,
    });

    setGuardando(false);
    if (!ok) {
      setError(fallo?.detalles?.[0]?.mensaje ?? fallo?.message ?? 'No pudimos guardar la beca.');
      return;
    }

    evento.currentTarget.reset();
    setEsLegal(false);
    setRecarga((n) => n + 1);
  }

  async function retirar(beca: Beca) {
    const motivo = window.prompt(
      `Retirar la beca de ${beca.alumno}. ¿Por qué? (queda en la bitácora)`,
    );
    if (motivo === null || motivo.trim().length < 3) return;

    const { ok, error: fallo } = await enviarJson(`/becas/${beca.id}/retirar`, { motivo });
    if (!ok) {
      setError(fallo?.message ?? 'No pudimos retirar la beca.');
      return;
    }
    setRecarga((n) => n + 1);
  }

  const legales = becas?.filter((b) => b.esObligacionLegal && b.vigenteHoy).length ?? 0;

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <Boton variante="texto" onClick={() => router.push('/panel')} style={{ padding: 0 }}>
          ‹ Panel
        </Boton>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginTop: 'var(--space-2)' }}>
          Becas y convenios
        </h1>
        <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-2)' }}>
          Se aplican solas al generar los cargos, y dejan de aplicarse solas cuando vencen.
        </p>
      </header>

      {error && (
        <Tarjeta>
          <p role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        </Tarjeta>
      )}

      {!sinPermiso && (
        <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
          <Tarjeta titulo="Otorgadas">
            {becas === null && (
              <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-3)' }}>Cargando…</p>
            )}

            {becas?.length === 0 && (
              <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-3)' }}>
                Todavía no hay becas registradas. La primera suele ser la del 5 % que exige la ley.
              </p>
            )}

            {/* El contador del cumplimiento legal, arriba y sin tener que sumarlo
              a mano: es el número que una autoridad puede venir a pedir. */}
            {legales > 0 && (
              <p style={{ marginTop: 'var(--space-3)', color: 'var(--texto-tenue)' }}>
                <strong>{legales}</strong> beca(s) vigente(s) marcada(s) como obligación legal.
              </p>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0' }}>
              {becas?.map((b) => (
                <li
                  key={b.id}
                  style={{
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--borde)',
                    display: 'grid',
                    gap: 'var(--space-2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 'var(--space-3)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <strong>{b.alumno}</strong>
                    <span
                      style={{
                        fontWeight: 'var(--font-weight-bold)',
                        color: 'var(--texto-primario)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {b.tipo === 'PORCENTAJE' ? `${b.valor} %` : `$${b.valor}`}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                    {/* El estado lleva TEXTO, no solo color (SC 1.4.1). */}
                    <Insignia tono={b.vigenteHoy ? 'exito' : 'neutro'}>
                      {!b.activa ? 'Retirada' : b.vigenteHoy ? 'Vigente hoy' : 'Fuera de vigencia'}
                    </Insignia>
                    {b.esObligacionLegal && <Insignia tono="info">Obligación legal</Insignia>}
                    <Insignia tono="neutro">
                      {b.concepto ? `Solo ${b.concepto.nombre}` : 'Todos los conceptos'}
                    </Insignia>
                  </div>

                  <p
                    style={{
                      margin: 0,
                      color: 'var(--texto-tenue)',
                      fontSize: 'var(--font-size-sm)',
                    }}
                  >
                    {fechaCorta(b.vigenteDesde)} —{' '}
                    {b.vigenteHasta ? fechaCorta(b.vigenteHasta) : 'sin fecha de fin'} · {b.motivo}
                  </p>

                  {b.activa && (
                    <div>
                      <Boton
                        variante="texto"
                        style={{ padding: 0 }}
                        onClick={() => {
                          void retirar(b);
                        }}
                      >
                        Retirar
                      </Boton>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Otorgar una beca">
            <form
              onSubmit={(e) => {
                void otorgar(e);
              }}
              style={{ display: 'grid', gap: 'var(--space-3)' }}
            >
              <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <label htmlFor="alumnoId" style={etiquetaEstilo}>
                  Alumna o alumno
                </label>
                <select id="alumnoId" name="alumnoId" required style={campoEstilo}>
                  {alumnos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nombre}
                      {a.cohorte ? ` · ${a.cohorte}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <label htmlFor="tipo" style={etiquetaEstilo}>
                  Tipo
                </label>
                <select
                  id="tipo"
                  value={tipo}
                  onChange={(e) =>
                    setTipo(e.target.value === 'MONTO_FIJO' ? 'MONTO_FIJO' : 'PORCENTAJE')
                  }
                  style={campoEstilo}
                >
                  <option value="PORCENTAJE">Porcentaje</option>
                  <option value="MONTO_FIJO">Monto fijo</option>
                </select>
              </div>

              <Campo
                etiqueta={tipo === 'PORCENTAJE' ? 'Porcentaje' : 'Importe'}
                nombre="valor"
                placeholder={tipo === 'PORCENTAJE' ? '5.00' : '500.00'}
                inputMode="decimal"
                ayuda={
                  tipo === 'PORCENTAJE'
                    ? 'Entre 0 y 100. El 5 % de la matrícula es el mínimo que exige la ley.'
                    : 'En pesos. Se descuenta del precio de lista del concepto.'
                }
              />

              <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <label htmlFor="conceptoId" style={etiquetaEstilo}>
                  Se aplica a
                </label>
                <select id="conceptoId" name="conceptoId" style={campoEstilo}>
                  <option value="">Todos los conceptos</option>
                  {conceptos.map((c) => (
                    <option key={c.id} value={c.id}>
                      Solo {c.nombre}
                    </option>
                  ))}
                </select>
                <span style={ayudaEstilo}>Lo normal es becar la colegiatura y no el comedor.</span>
              </div>

              <Campo
                etiqueta="Vigente desde"
                nombre="vigenteDesde"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
              />
              <Campo
                etiqueta="Vigente hasta"
                nombre="vigenteHasta"
                type="date"
                ayuda="Opcional. Si la dejas vacía, la beca no caduca — y entonces alguien tiene que acordarse de retirarla."
              />

              <Campo
                etiqueta="Motivo"
                nombre="motivo"
                placeholder="Beca de hermanos: segundo hijo inscrito"
                ayuda="Obligatorio. Es la prueba de por qué se otorgó, y una autoridad puede pedirla."
              />

              <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={esLegal}
                  onChange={(e) => setEsLegal(e.target.checked)}
                  style={{ width: 20, height: 20 }}
                />
                <span>Cuenta para el 5 % que exige la ley</span>
              </label>
              <span style={ayudaEstilo}>
                Márcalo en las becas con las que cumples la obligación de la Ley General de
                Educación (art. 149-III). Así puedes demostrar el cumplimiento sin revisar los
                motivos uno por uno.
              </span>

              <Boton type="submit" cargando={guardando}>
                Otorgar beca
              </Boton>
            </form>
          </Tarjeta>
        </div>
      )}
    </main>
  );
}

const etiquetaEstilo = {
  fontSize: 'var(--font-size-sm)',
  fontWeight: 'var(--font-weight-medium)',
  color: 'var(--texto-primario)',
} as const;

const campoEstilo = {
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radio-md)',
  border: '1px solid var(--borde)',
  background: 'var(--superficie)',
  color: 'var(--texto-primario)',
  fontSize: 'var(--font-size-md)',
  // 44 px de alto mínimo: es el objetivo táctil que la matriz D10 exige en
  // todas las pantallas, también en las de escritorio.
  minHeight: 44,
} as const;

const ayudaEstilo = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--texto-tenue)',
} as const;

function Campo({
  etiqueta,
  nombre,
  ayuda,
  ...resto
}: {
  etiqueta: string;
  nombre: string;
  ayuda?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <label htmlFor={nombre} style={etiquetaEstilo}>
        {etiqueta}
      </label>
      <input id={nombre} name={nombre} style={campoEstilo} {...resto} />
      {ayuda && <span style={ayudaEstilo}>{ayuda}</span>}
    </div>
  );
}
