'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, Insignia, Tarjeta } from '@azahar/ui';
import { enviarJson, pedirApi } from '../../api';

interface Concepto {
  id: string;
  clave: string;
  nombre: string;
  periodicidad: string;
  monto: string;
  diaVencimiento: number;
  alcance: { cohorteId: string; nombre: string } | null;
  deducibleIedu: boolean;
  nivelEducativo: string | null;
  esColegiatura: boolean;
  aceptaSaldoAFavor: boolean;
  vigenteDesde: string;
  activo: boolean;
}

/**
 * Lo que la ley obliga a ESTA escuela, ya resuelto por el API (§51).
 *
 * La pantalla no traduce vertical -> ley: eso viviria en dos sitios y uno de
 * los dos se quedaria viejo. Aqui solo se decide que frase mostrar.
 */
interface MarcoLegal {
  aplicaAcuerdoProfeco: boolean;
  pisoSinRecargo: number;
  avisoDeAjuste: number;
}

interface ProblemaDeGeneracion {
  alumno: string;
  concepto: string;
  motivo: string;
}

interface ResultadoGeneracion {
  periodo: string;
  generados: number;
  omitidos: number;
  importeTotal: string;
  problemas: ProblemaDeGeneracion[];
  saldoAFavorAplicado: string;
  familiasConSaldoAplicado: number;
}

const PERIODICIDAD: Record<string, string> = {
  MENSUAL: 'Cada mes',
  UNICO: 'Una sola vez',
  ANUAL: 'Una vez al año',
};

const NIVEL: Record<string, string> = {
  PREESCOLAR: 'Preescolar',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  PROFESIONAL_TECNICO: 'Profesional técnico',
  BACHILLERATO: 'Bachillerato',
};

/**
 * Lee un campo de texto de un formulario.
 *
 * `FormData.get()` devuelve `string | File`, y convertir un File a texto
 * produce "[object File]" — una cadena que parece un dato y pasa validaciones
 * de longitud. Estrecharlo aqui evita esa clase de basura silenciosa. Lo
 * senalo el gate de analisis estatico del Sprint 4.
 */
function campoTexto(formulario: FormData, nombre: string): string {
  const valor = formulario.get(nombre);
  return typeof valor === 'string' ? valor : '';
}

/** El periodo del mes en curso, en el formato que espera el API. */
function periodoActual(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Catálogo de cargos (AZ-M4.1) — pantalla 8 de la matriz D10.
 *
 * Es donde la escuela declara QUÉ cobra. Dos decisiones de diseño que no son
 * cosméticas:
 *
 *  1. **La ventana legal se muestra, no se deduce.** Cada cargo generado dice
 *     hasta cuándo se acepta sin recargo. La administración no debería tener
 *     que recordar el Artículo 4 del Acuerdo de PROFECO: el sistema se lo dice.
 *  2. **Los problemas de la generación se listan, no se esconden.** Un alumno
 *     sin pagadores registrados produce un cargo que nadie debe. Ocultarlo en
 *     un log lo convierte en un faltante que aparece en la auditoría.
 */
export default function PaginaCatalogo() {
  const router = useRouter();
  const [conceptos, setConceptos] = useState<Concepto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoGeneracion | null>(null);
  const [periodo, setPeriodo] = useState(periodoActual);
  const [deducible, setDeducible] = useState(false);
  const [marco, setMarco] = useState<MarcoLegal | null>(null);
  const [esColegiatura, setEsColegiatura] = useState(false);
  const [aceptaSaldo, setAceptaSaldo] = useState(true);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;

    void (async () => {
      const { estado, datos } = await pedirApi<Concepto[]>('/catalogo-cargos');
      if (!vigente) return;

      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (estado === 403) {
        setError('Esta sección es para administración y cobranza.');
        return;
      }
      if (!datos) {
        setError('No pudimos cargar el catálogo.');
        return;
      }
      setConceptos(datos);

      // El marco legal se pide aparte y NO bloquea el catálogo: si falla, la
      // pantalla sigue sirviendo y solo se calla la frase sobre la ley. Decir
      // "cargando la ley" mientras se ve la lista sería ruido; afirmar la ley
      // equivocada, un defecto (§51).
      const { datos: escuela } = await pedirApi<{ marcoLegal: MarcoLegal }>('/mi-escuela');
      if (vigente && escuela) setMarco(escuela.marcoLegal);
    })();

    return () => {
      vigente = false;
    };
  }, [router, recarga]);

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    const formulario = new FormData(evento.currentTarget);
    const nivel = campoTexto(formulario, 'nivelEducativo');

    const { ok, error: fallo } = await enviarJson('/catalogo-cargos', {
      clave: campoTexto(formulario, 'clave'),
      nombre: campoTexto(formulario, 'nombre'),
      periodicidad: campoTexto(formulario, 'periodicidad') || 'MENSUAL',
      monto: campoTexto(formulario, 'monto'),
      diaVencimiento: Number(campoTexto(formulario, 'diaVencimiento') || 5),
      deducibleIedu: deducible,
      ...(deducible && nivel ? { nivelEducativo: nivel } : {}),
      esColegiatura,
      aceptaSaldoAFavor: aceptaSaldo,
      vigenteDesde: campoTexto(formulario, 'vigenteDesde'),
    });

    setGuardando(false);
    if (!ok) {
      setError(
        fallo?.detalles?.[0]?.mensaje ?? fallo?.message ?? 'No pudimos guardar el concepto.',
      );
      return;
    }

    evento.currentTarget.reset();
    setDeducible(false);
    setEsColegiatura(false);
    setAceptaSaldo(true);
    setRecarga((n) => n + 1);
  }

  async function generar() {
    setGenerando(true);
    setError(null);
    const {
      ok,
      datos,
      error: fallo,
    } = await enviarJson<ResultadoGeneracion>('/cargos/generar', {
      periodo,
    });
    setGenerando(false);

    if (!ok || !datos) {
      setError(fallo?.message ?? 'No pudimos generar los cargos.');
      return;
    }
    setResultado(datos);
  }

  return (
    <main style={{ maxWidth: 820, margin: '0 auto', padding: 'var(--space-4)' }}>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <Boton variante="texto" onClick={() => router.push('/panel')} style={{ padding: 0 }}>
          ‹ Panel
        </Boton>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginTop: 'var(--space-2)' }}>
          Catálogo de cargos
        </h1>
        <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-2)' }}>
          Lo que cobra tu escuela. De aquí salen los cargos de cada mes.
        </p>
      </header>

      {error && (
        <Tarjeta>
          <p role="alert" style={{ margin: 0 }}>
            {error}
          </p>
        </Tarjeta>
      )}

      <div style={{ display: 'grid', gap: 'var(--space-4)', marginTop: 'var(--space-4)' }}>
        <Tarjeta titulo="Conceptos">
          {conceptos === null && (
            <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-3)' }}>Cargando…</p>
          )}

          {conceptos?.length === 0 && (
            <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-3)' }}>
              Todavía no hay conceptos. Agrega el primero abajo — normalmente, la colegiatura.
            </p>
          )}

          <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0' }}>
            {conceptos?.map((c) => (
              <li
                key={c.id}
                style={{
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--borde)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <strong>{c.nombre}</strong>
                  <div
                    style={{
                      display: 'flex',
                      gap: 'var(--space-2)',
                      marginTop: 'var(--space-2)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Insignia tono="neutro">
                      {PERIODICIDAD[c.periodicidad] ?? c.periodicidad}
                    </Insignia>
                    <Insignia tono="neutro">Vence el día {c.diaVencimiento}</Insignia>
                    {c.alcance && <Insignia tono="info">Solo {c.alcance.nombre}</Insignia>}
                    {/* La insignia lleva TEXTO, no solo color: el estado nunca
                        se comunica únicamente con un tono (SC 1.4.1). */}
                    {c.deducibleIedu && (
                      <Insignia tono="exito">
                        Deducible{c.nivelEducativo ? ` · ${NIVEL[c.nivelEducativo]}` : ''}
                      </Insignia>
                    )}
                    {/* Las dos marcas que deciden reglas de dinero se muestran
                        SIEMPRE, en positivo o en negativo: si "cuenta para la
                        suspensión" solo apareciera cuando es cierto, nadie
                        notaría que a su colegiatura le falta la marca. */}
                    <Insignia tono={c.esColegiatura ? 'info' : 'neutro'}>
                      {c.esColegiatura ? 'Cuenta para el Art. 7' : 'No cuenta para el Art. 7'}
                    </Insignia>
                    {!c.aceptaSaldoAFavor && <Insignia tono="neutro">Sin saldo a favor</Insignia>}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 'var(--font-size-xl)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--texto-primario)',
                    // Los importes alineados en columna se comparan de un vistazo.
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  ${c.monto}
                </span>
              </li>
            ))}
          </ul>
        </Tarjeta>

        <Tarjeta titulo="Agregar un concepto">
          <form
            onSubmit={(evento) => {
              void crear(evento);
            }}
            style={{ display: 'grid', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}
          >
            <Campo etiqueta="Nombre" nombre="nombre" placeholder="Colegiatura de primaria" />
            <Campo
              etiqueta="Clave"
              nombre="clave"
              placeholder="colegiatura-primaria"
              ayuda="Minúsculas y guiones. No cambia aunque cambie el nombre."
            />
            <Campo etiqueta="Importe" nombre="monto" placeholder="2450.00" inputMode="decimal" />

            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
              <label htmlFor="periodicidad" style={etiquetaEstilo}>
                Cada cuándo se cobra
              </label>
              <select
                id="periodicidad"
                name="periodicidad"
                defaultValue="MENSUAL"
                style={campoEstilo}
              >
                <option value="MENSUAL">Cada mes</option>
                <option value="UNICO">Una sola vez</option>
                <option value="ANUAL">Una vez al año</option>
              </select>
            </div>

            <Campo
              etiqueta="Día de vencimiento"
              nombre="diaVencimiento"
              type="number"
              defaultValue="5"
              ayuda={
                marco?.aplicaAcuerdoProfeco
                  ? `Por ley se aceptan pagos sin recargo durante los primeros ${marco.pisoSinRecargo} días del mes, aunque venza antes.`
                  : 'A esta institución no la alcanza el Acuerdo de PROFECO: la ventana sin recargo es la que fije tu reglamento.'
              }
            />
            <Campo
              etiqueta="Vigente desde"
              nombre="vigenteDesde"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
            />

            <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={deducible}
                onChange={(e) => setDeducible(e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              <span>Es deducible de impuestos (colegiatura)</span>
            </label>

            {deducible && (
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
                  El SAT lo exige en el complemento de colegiaturas. Sin él, la familia no puede
                  deducir.
                </span>
              </div>
            )}

            <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={esColegiatura}
                onChange={(e) => setEsColegiatura(e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              <span>Es una colegiatura</span>
            </label>
            <span style={ayudaEstilo}>
              La ley permite suspender el servicio por tres colegiaturas impagas, y cuenta solo
              colegiaturas. Un comedor o una excursión sin pagar no acercan a la familia a ese
              límite, aunque sumen dinero.
            </span>

            <label style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={aceptaSaldo}
                onChange={(e) => setAceptaSaldo(e.target.checked)}
                style={{ width: 20, height: 20 }}
              />
              <span>Puede pagarse con saldo a favor</span>
            </label>
            <span style={ayudaEstilo}>
              Quítalo cuando cobres por cuenta de alguien más —una excursión, un examen externo—:
              así el dinero que la familia dejó a cuenta no se consume sin que nadie lo decida.
            </span>

            <Boton type="submit" cargando={guardando}>
              Guardar concepto
            </Boton>
          </form>
        </Tarjeta>

        <Tarjeta titulo="Generar los cargos del mes">
          <p style={{ color: 'var(--texto-tenue)', margin: 'var(--space-2) 0 var(--space-3)' }}>
            Crea el cargo de cada alumno según el catálogo y lo reparte entre quienes pagan.
            Generarlo dos veces no duplica nada.
          </p>

          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'flex-end',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
              <label htmlFor="periodo" style={etiquetaEstilo}>
                Mes
              </label>
              <input
                id="periodo"
                type="month"
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                style={campoEstilo}
              />
            </div>
            <Boton
              onClick={() => {
                void generar();
              }}
              cargando={generando}
            >
              Generar cargos
            </Boton>
          </div>

          {resultado && (
            <div role="status" style={{ marginTop: 'var(--space-4)' }}>
              <p style={{ margin: 0 }}>
                <strong>{resultado.generados}</strong> cargo(s) nuevo(s) por{' '}
                <strong>${resultado.importeTotal}</strong>.
                {resultado.omitidos > 0 && <> {resultado.omitidos} ya existían y no se tocaron.</>}
              </p>

              {/* Dinero que ya estaba en la caja y acaba de dejar de estar
                  disponible. Callarlo haría que el corte del mes no cuadrara
                  con lo que la administración cree que se cobró. */}
              {resultado.saldoAFavorAplicado !== '0.00' && (
                <p style={{ margin: 'var(--space-2) 0 0' }}>
                  Se aplicaron <strong>${resultado.saldoAFavorAplicado}</strong> de saldo a favor de{' '}
                  {resultado.familiasConSaldoAplicado} familia(s) que ya habían pagado por
                  adelantado.
                </p>
              )}

              {resultado.problemas.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)' }}>
                  <strong>Requieren tu atención:</strong>
                  <ul style={{ margin: 'var(--space-2) 0 0', paddingLeft: 'var(--space-4)' }}>
                    {resultado.problemas.map((p, i) => (
                      <li key={`${p.alumno}-${i}`} style={{ marginBottom: 'var(--space-1)' }}>
                        {p.alumno} · {p.concepto}: {p.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </Tarjeta>
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
  const idAyuda = ayuda ? `${nombre}-ayuda` : undefined;
  return (
    <div style={{ display: 'grid', gap: 'var(--space-1)' }}>
      <label htmlFor={nombre} style={etiquetaEstilo}>
        {etiqueta}
      </label>
      <input id={nombre} name={nombre} aria-describedby={idAyuda} style={campoEstilo} {...resto} />
      {ayuda && (
        <span id={idAyuda} style={ayudaEstilo}>
          {ayuda}
        </span>
      )}
    </div>
  );
}
