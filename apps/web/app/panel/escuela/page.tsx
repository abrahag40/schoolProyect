'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, Insignia, Tarjeta } from '@azahar/ui';
import { enviarJson, pedirApi } from '../../api';

interface Rvoe {
  id: string;
  sedeId: string;
  sede: string;
  nivelEducativo: string;
  acuerdo: string;
}

interface Sede {
  id: string;
  nombre: string;
  cct: string | null;
  rvoes: Array<{ nivelEducativo: string; acuerdo: string }>;
}

interface Escuela {
  escuela: { nombre: string; vertical: string } | null;
  sedes: Sede[];
  marcoLegal: { aplicaAcuerdoProfeco: boolean; pisoSinRecargo: number; avisoDeAjuste: number };
}

const NIVEL: Record<string, string> = {
  PREESCOLAR: 'Preescolar',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  PROFESIONAL_TECNICO: 'Profesional técnico',
  BACHILLERATO: 'Bachillerato',
};

function campoTexto(formulario: FormData, nombre: string): string {
  const valor = formulario.get(nombre);
  return typeof valor === 'string' ? valor : '';
}

/**
 * Datos fiscales de la escuela — los acuerdos RVOE (AZ-A1).
 *
 * POR QUE ESTA PANTALLA EXISTE: desde el Sprint 6 el catálogo RECHAZA crear un
 * concepto deducible si no está capturado el RVOE de su nivel. Sin un lugar
 * donde capturarlo, ese gate deja de proteger y se vuelve un muro — la escuela
 * no puede avanzar y no sabe por qué. Una regla que no se puede satisfacer es
 * un defecto, por correcta que sea.
 *
 * Y va POR NIVEL, no por plantel: el RVOE se otorga por programa, así que una
 * escuela con primaria y secundaria tiene dos acuerdos distintos. Con uno solo,
 * la mitad de las facturas saldrían con el número equivocado.
 */
export default function PaginaEscuela() {
  const router = useRouter();
  const [escuela, setEscuela] = useState<Escuela | null>(null);
  const [rvoes, setRvoes] = useState<Rvoe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;

    void (async () => {
      const { estado, datos } = await pedirApi<Escuela>('/mi-escuela');
      if (!vigente) return;
      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (datos) setEscuela(datos);

      const { estado: e2, datos: rs } = await pedirApi<Rvoe[]>('/rvoe');
      if (!vigente) return;
      if (e2 === 403) {
        setError('Los datos fiscales los administra la dirección.');
        setSinPermiso(true);
        return;
      }
      if (rs) setRvoes(rs);
    })();

    return () => {
      vigente = false;
    };
  }, [router, recarga]);

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    const f = new FormData(evento.currentTarget);
    const { ok, error: fallo } = await enviarJson('/rvoe', {
      sedeId: campoTexto(f, 'sedeId'),
      nivelEducativo: campoTexto(f, 'nivelEducativo'),
      acuerdo: campoTexto(f, 'acuerdo'),
    });

    setGuardando(false);
    if (!ok) {
      setError(fallo?.detalles?.[0]?.mensaje ?? fallo?.message ?? 'No pudimos guardar el acuerdo.');
      return;
    }

    evento.currentTarget.reset();
    setRecarga((n) => n + 1);
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <Boton variante="texto" onClick={() => router.push('/panel')} style={{ padding: 0 }}>
          ‹ Panel
        </Boton>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginTop: 'var(--space-2)' }}>
          Datos fiscales
        </h1>
        <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-2)' }}>
          Los acuerdos RVOE con los que se facturan las colegiaturas deducibles.
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
          {/* Qué ley obliga a esta escuela, dicho por el dominio (§51). La
              pantalla no lo deduce del vertical: eso viviría en dos sitios. */}
          {escuela?.marcoLegal && (
            <Tarjeta titulo="Marco legal">
              <p style={{ marginTop: 'var(--space-2)' }}>
                {escuela.marcoLegal.aplicaAcuerdoProfeco ? (
                  <>
                    A esta escuela la alcanza el Acuerdo de PROFECO: se aceptan pagos sin recargo
                    durante los primeros <strong>{escuela.marcoLegal.pisoSinRecargo} días</strong> y
                    los ajustes de cuota se avisan con{' '}
                    <strong>{escuela.marcoLegal.avisoDeAjuste} días</strong> de anticipación.
                  </>
                ) : (
                  <>
                    El Acuerdo de PROFECO <strong>no alcanza</strong> a esta institución. Las
                    ventanas de pago y los avisos de ajuste los fija tu reglamento.
                  </>
                )}
              </p>
            </Tarjeta>
          )}

          <Tarjeta titulo="Acuerdos RVOE">
            <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-2)' }}>
              Uno por plantel y nivel educativo. Sin el acuerdo del nivel, no puedes crear un
              concepto deducible: el SAT rechaza la factura sin él.
            </p>

            {rvoes === null && (
              <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-3)' }}>Cargando…</p>
            )}

            {rvoes?.length === 0 && (
              <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-3)' }}>
                Todavía no hay acuerdos capturados. Si tu escuela emite facturas deducibles,
                empieza por aquí.
              </p>
            )}

            <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0' }}>
              {rvoes?.map((r) => (
                <li
                  key={r.id}
                  style={{
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--borde)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                    <strong>{NIVEL[r.nivelEducativo] ?? r.nivelEducativo}</strong>
                    <Insignia tono="neutro">{r.sede}</Insignia>
                  </div>
                  <span style={{ fontFamily: 'monospace', color: 'var(--texto-primario)' }}>
                    {r.acuerdo}
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Registrar o corregir un acuerdo">
            <form
              onSubmit={(e) => {
                void registrar(e);
              }}
              style={{ display: 'grid', gap: 'var(--space-3)' }}
            >
              <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <label htmlFor="sedeId" style={etiquetaEstilo}>
                  Plantel
                </label>
                <select id="sedeId" name="sedeId" required style={campoEstilo}>
                  {escuela?.sedes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <label htmlFor="nivelEducativo" style={etiquetaEstilo}>
                  Nivel educativo
                </label>
                <select id="nivelEducativo" name="nivelEducativo" style={campoEstilo}>
                  {Object.entries(NIVEL).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </select>
                <span style={ayudaEstilo}>
                  Si vuelves a capturar un nivel que ya tiene acuerdo, se corrige el número — no se
                  crea un segundo.
                </span>
              </div>

              <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
                <label htmlFor="acuerdo" style={etiquetaEstilo}>
                  Número de acuerdo
                </label>
                <input
                  id="acuerdo"
                  name="acuerdo"
                  placeholder="ACUERDO 123/2024"
                  required
                  style={campoEstilo}
                />
              </div>

              <Boton type="submit" cargando={guardando}>
                Guardar acuerdo
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
  minHeight: 44,
} as const;

const ayudaEstilo = {
  fontSize: 'var(--font-size-sm)',
  color: 'var(--texto-tenue)',
} as const;
