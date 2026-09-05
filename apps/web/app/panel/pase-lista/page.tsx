'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, Insignia, Tarjeta } from '@azahar/ui';
import { enviarJson, pedirApi } from '../../api';

type Estado = 'PRESENTE' | 'AUSENTE' | 'RETARDO' | 'JUSTIFICADA';

interface Grupo {
  id: string;
  nombre: string;
  tipo: string;
  sede: string;
  inscritos: number;
  listaDeHoy: boolean;
}

interface AlumnoEnLista {
  alumnoId: string;
  nombre: string;
  apellidos: string;
  estado: Estado | null;
}

/** Lo que responde el API. Declarado aqui para que el compilador vuelva a
 *  proteger en cuanto el dato cruza la frontera de red (ver app/api.ts). */
interface RespuestaGrupos {
  hoy: string;
  grupos: Grupo[];
}

interface RespuestaLista {
  cohorte: { id: string; nombre: string; tipo: string; sede: string };
  fecha: string;
  yaRegistrada: boolean;
  alumnos: AlumnoEnLista[];
}

interface ResultadoGuardado {
  fecha: string;
  guardados: number;
  resumen: { presentes: number; ausentes: number; retardos: number; justificadas: number };
  avisosGenerados: number;
}

/** El vocabulario es el de la escuela, nunca el identificador del sistema. */
const TIPO_COHORTE: Record<string, string> = {
  GRADO: 'Grupo',
  CATEGORIA: 'Categoría',
  NIVEL: 'Nivel',
  TALLER: 'Taller',
};

/**
 * Las tres opciones. El texto viaja SIEMPRE junto al simbolo: el color no
 * puede portar solo el significado (WCAG 2.2 SC 1.4.1), y un docente daltonico
 * tiene que poder pasar lista igual de rapido.
 */
const OPCIONES: Array<{ estado: Estado; glifo: string; texto: string }> = [
  { estado: 'PRESENTE', glifo: '✓', texto: 'Asistió' },
  { estado: 'RETARDO', glifo: '◷', texto: 'Tarde' },
  { estado: 'AUSENTE', glifo: '✕', texto: 'Faltó' },
];

/**
 * Pase de lista (AZ-M3.1) — pantalla 6 de la matriz D10.
 *
 * OBJETIVO DURO: menos de 30 segundos por grupo, con el pulgar, a 360 px.
 * De ahi salen las tres decisiones que se ven abajo:
 *   1. "Todos presentes" primero: es el caso del 90% de los dias, un toque.
 *   2. Cada control mide 44 px (Apple HIG / Material). Un boton elegante de
 *      32 px falla en el telefono de un docente con prisa entre clases.
 *   3. Se guarda al final, no en cada toque: la conexion de un salon de clases
 *      no es la de una oficina, y 30 peticiones sueltas es como se pierde
 *      media lista.
 * Si el docente tarda mas, vuelve al papel — y sin asistencia capturada no hay
 * alertas automaticas a las familias, que es la funcion con mejor evidencia de
 * impacto academico del producto.
 */
export default function PaginaPaseLista() {
  const router = useRouter();
  const [grupos, setGrupos] = useState<Grupo[] | null>(null);
  const [grupoId, setGrupoId] = useState<string | null>(null);
  const [fecha, setFecha] = useState<string>('');
  const [alumnos, setAlumnos] = useState<AlumnoEnLista[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `vigente` evita escribir estado sobre una pantalla que el docente ya
    // abandono: sin esta guarda, salir mientras carga deja una escritura
    // huerfana.
    let vigente = true;

    void (async () => {
      const { estado, datos } = await pedirApi<RespuestaGrupos>('/pase-lista/grupos');
      if (!vigente) return;

      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (estado === 403) {
        setError('El pase de lista es para el personal de la escuela.');
        return;
      }
      if (!datos) {
        setError('No pudimos cargar tus grupos.');
        return;
      }

      setGrupos(datos.grupos);
      setFecha(datos.hoy);
      // Con un solo grupo no se le pide elegir: se abre. Un selector de una
      // opcion es un paso que no decide nada.
      if (datos.grupos.length === 1) setGrupoId(datos.grupos[0]!.id);
    })();

    return () => {
      vigente = false;
    };
  }, [router]);

  useEffect(() => {
    if (!grupoId || !fecha) return;
    let vigente = true;

    void (async () => {
      const { ok, datos } = await pedirApi<RespuestaLista>(`/pase-lista/${grupoId}?fecha=${fecha}`);
      if (!vigente) return;

      // El estado se toca DESPUES de la espera, nunca antes. Un setState
      // sincrono dentro de un efecto encadena renders — defecto real que cazo
      // el gate de analisis estatico del Sprint 4, no una preferencia de estilo.
      if (!ok || !datos) {
        setError('No pudimos abrir la lista de ese grupo.');
        return;
      }
      setMensaje(null);
      setAlumnos(datos.alumnos);
    })();

    return () => {
      vigente = false;
    };
  }, [grupoId, fecha]);

  function marcar(alumnoId: string, estado: Estado) {
    setAlumnos((previos) =>
      (previos ?? []).map((a) => (a.alumnoId === alumnoId ? { ...a, estado } : a)),
    );
    setMensaje(null);
  }

  function todosPresentes() {
    setAlumnos((previos) => (previos ?? []).map((a) => ({ ...a, estado: 'PRESENTE' })));
    setMensaje(null);
  }

  async function guardar() {
    if (!alumnos || !grupoId) return;
    setGuardando(true);
    setMensaje(null);
    try {
      const { ok, datos, error } = await enviarJson<ResultadoGuardado>('/pase-lista', {
        cohorteId: grupoId,
        fecha,
        registros: alumnos
          .filter((a) => a.estado)
          .map((a) => ({ alumnoId: a.alumnoId, estado: a.estado })),
      });

      if (!ok || !datos) {
        setError(error?.message ?? 'No pudimos guardar la lista.');
        return;
      }
      // Se dice cuantos avisos salieron: el docente debe SABER que la familia
      // fue notificada. Un aviso que se manda a espaldas de quien lo origina
      // es como se pierde la confianza del personal en el sistema.
      //
      // Se cuentan AVISOS y no familias, y la diferencia importa: una alumna
      // con tres tutores registrados que ademas cruza el umbral produce seis
      // avisos. Poner "6 familias" seria una cifra falsa en la pantalla del
      // docente — exactamente el tipo de dato que despues nadie vuelve a creer.
      setMensaje(
        `Lista guardada: ${datos.resumen.presentes} presentes, ` +
          `${datos.resumen.ausentes} faltas.` +
          (datos.avisosGenerados > 0
            ? ` Se enviaron ${datos.avisosGenerados} aviso(s) a las familias.`
            : ' Sin avisos nuevos.'),
      );
    } catch {
      setError('No pudimos contactar al servidor. Revisa tu conexión.');
    } finally {
      setGuardando(false);
    }
  }

  const grupo = grupos?.find((g) => g.id === grupoId);
  const sinMarcar = alumnos?.filter((a) => !a.estado).length ?? 0;

  if (error) {
    return (
      <main>
        <Tarjeta>
          <p role="alert">{error}</p>
        </Tarjeta>
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Boton variante="secundario" onClick={() => router.push('/panel')}>
            Volver al panel
          </Boton>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header style={{ marginBottom: 'var(--space-4)' }}>
        <Boton variante="texto" onClick={() => router.push('/panel')} style={{ padding: 0 }}>
          ‹ Panel
        </Boton>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', marginTop: 'var(--space-2)' }}>
          Pase de lista
        </h1>
        {grupo && (
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            <Insignia tono="info">
              {TIPO_COHORTE[grupo.tipo] ?? 'Grupo'} {grupo.nombre}
            </Insignia>
            <Insignia tono="neutro">{grupo.sede}</Insignia>
          </div>
        )}
      </header>

      {grupos && grupos.length === 0 && (
        <Tarjeta>
          <p>
            No tienes grupos asignados todavía. La dirección de tu escuela puede asignártelos desde
            el panel.
          </p>
        </Tarjeta>
      )}

      {grupos && grupos.length > 1 && (
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <label
            htmlFor="grupo"
            style={{
              display: 'block',
              fontSize: 'var(--font-size-sm)',
              marginBottom: 'var(--space-1)',
            }}
          >
            Grupo
          </label>
          <select
            id="grupo"
            value={grupoId ?? ''}
            onChange={(e) => setGrupoId(e.target.value || null)}
            style={{
              width: '100%',
              minHeight: 'var(--size-touch-target)',
              padding: '0 var(--space-3)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--borde)',
              background: 'var(--superficie)',
              color: 'var(--texto)',
              fontSize: 'var(--font-size-base)',
            }}
          >
            <option value="">Elige un grupo…</option>
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>
                {TIPO_COHORTE[g.tipo] ?? 'Grupo'} {g.nombre} · {g.inscritos} inscritos
                {/* Se dice si ya se paso lista hoy: el docente necesita saber
                    si captura o corrige, no adivinarlo por la pantalla. */}
                {g.listaDeHoy ? ' · ya registrada hoy' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {grupoId && alumnos && (
        <>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-3)',
              alignItems: 'center',
              flexWrap: 'wrap',
              marginBottom: 'var(--space-3)',
            }}
          >
            <label htmlFor="fecha" style={{ fontSize: 'var(--font-size-sm)' }}>
              Día
            </label>
            <input
              id="fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              style={{
                minHeight: 'var(--size-touch-target)',
                padding: '0 var(--space-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--borde)',
                background: 'var(--superficie)',
                color: 'var(--texto)',
              }}
            />
          </div>

          {/* El caso del 90% de los dias, en un toque. Va ARRIBA de la lista
              porque es lo primero que hace el docente, no una opcion escondida. */}
          <Boton onClick={todosPresentes} style={{ width: '100%' }}>
            Todos presentes
          </Boton>

          <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-4) 0 0' }}>
            {alumnos.map((a) => (
              <li
                key={a.alumnoId}
                style={{
                  padding: 'var(--space-3) 0',
                  borderBottom: '1px solid var(--borde)',
                }}
              >
                <p
                  style={{ margin: '0 0 var(--space-2)', fontWeight: 'var(--font-weight-medium)' }}
                >
                  {a.apellidos}, {a.nombre}
                </p>
                <div
                  role="group"
                  aria-label={`Asistencia de ${a.nombre} ${a.apellidos}`}
                  style={{ display: 'flex', gap: 'var(--space-2)' }}
                >
                  {OPCIONES.map((o) => {
                    const activo = a.estado === o.estado;
                    return (
                      <button
                        key={o.estado}
                        type="button"
                        onClick={() => marcar(a.alumnoId, o.estado)}
                        aria-pressed={activo}
                        style={{
                          flex: 1,
                          minHeight: 'var(--size-touch-target)',
                          borderRadius: 'var(--radius-md)',
                          // El estado seleccionado se marca con GROSOR y peso
                          // de letra, no con color de relleno: asi no depende
                          // del color y evita el problema de contraste del azul
                          // de marca sobre texto claro (§30).
                          border: activo
                            ? '2px solid var(--texto-primario)'
                            : '1px solid var(--borde)',
                          background: activo ? 'var(--superficie-alt)' : 'var(--superficie)',
                          color: 'var(--texto)',
                          fontWeight: activo
                            ? 'var(--font-weight-semibold)'
                            : 'var(--font-weight-regular)',
                          fontSize: 'var(--font-size-sm)',
                          fontFamily: 'var(--font-family-sans)',
                          cursor: 'pointer',
                        }}
                      >
                        {o.glifo} {o.texto}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ul>

          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--fondo)',
              paddingTop: 'var(--space-3)',
              paddingBottom: 'var(--space-3)',
              marginTop: 'var(--space-3)',
            }}
          >
            {/* aria-live: el conteo cambia sin recargar, y un lector de
                pantalla debe enterarse igual que quien lo ve. */}
            <p
              aria-live="polite"
              style={{
                color: 'var(--texto-tenue)',
                fontSize: 'var(--font-size-sm)',
                margin: '0 0 var(--space-2)',
              }}
            >
              {sinMarcar > 0
                ? `Faltan ${sinMarcar} por marcar.`
                : `${alumnos.length} alumnos listos para guardar.`}
            </p>
            <Boton
              onClick={() => {
                void guardar();
              }}
              cargando={guardando}
              disabled={alumnos.length === 0 || sinMarcar > 0}
              style={{ width: '100%' }}
            >
              Guardar lista
            </Boton>
            {mensaje && (
              <p
                role="status"
                style={{
                  marginTop: 'var(--space-3)',
                  color: 'var(--texto)',
                  fontSize: 'var(--font-size-sm)',
                }}
              >
                {mensaje}
              </p>
            )}
          </div>
        </>
      )}
    </main>
  );
}
