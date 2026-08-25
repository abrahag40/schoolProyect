'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, Insignia, Tarjeta } from '@azahar/ui';
import { pedirApi } from '../api';

interface Resumen {
  escuela: { nombre: string; vertical: string } | null;
  sedes: Array<{ id: string; nombre: string; cct: string | null; rvoe: string | null }>;
  periodo: { nombre: string; tipo: string } | null;
  cohortes: Array<{ id: string; nombre: string; tipo: string; inscritos: number }>;
  totales: { alumnos: number; tutores: number; usuarios: number };
  misRoles: string[];
}

/**
 * Nombres legibles. El usuario ve "Academia deportiva", no ACADEMIA_DEPORTIVA:
 * los identificadores del sistema no se le muestran a una persona.
 */
const VERTICAL: Record<string, string> = {
  COLEGIO: 'Colegio',
  UNIVERSIDAD: 'Universidad',
  ACADEMIA_DEPORTIVA: 'Academia deportiva',
  ESCUELA_IDIOMAS: 'Escuela de idiomas',
  TALLER: 'Taller',
};

/**
 * El vocabulario cambia con la vertical: un colegio tiene "grupos" en un
 * "ciclo escolar"; una academia, "categorias" en una "temporada". Es la misma
 * estructura de datos hablando el idioma de cada escuela.
 */
const TIPO_PERIODO: Record<string, string> = {
  CICLO_ESCOLAR: 'Ciclo escolar',
  TEMPORADA: 'Temporada',
  CONTINUO: 'Inscripción continua',
};

const TIPO_COHORTE: Record<string, { singular: string; plural: string }> = {
  GRADO: { singular: 'Grupo', plural: 'Grupos' },
  CATEGORIA: { singular: 'Categoría', plural: 'Categorías' },
  NIVEL: { singular: 'Nivel', plural: 'Niveles' },
  TALLER: { singular: 'Taller', plural: 'Talleres' },
};

const ROL: Record<string, string> = {
  DUENO: 'Dueño',
  DIRECTOR: 'Dirección',
  ADMIN: 'Administración',
  COBRANZA: 'Cobranza',
  DOCENTE: 'Docente',
  STAFF: 'Personal',
  TUTOR: 'Madre, padre o tutor',
};

/// Quien ve el acceso al pase de lista. Misma lista que el API: si divergen,
/// la interfaz ofrece un boton que termina en 403 — peor que no ofrecerlo.
const ROLES_PASE_LISTA = ['DOCENTE', 'DIRECTOR', 'ADMIN', 'DUENO'];

export default function PaginaPanel() {
  const router = useRouter();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // No se consulta ningun almacenamiento local: la sesion vive en una cookie
    // httpOnly que el navegador envia sola. Si no hay sesion valida, el
    // servidor responde 401 y de ahi se decide — la verdad la tiene el
    // servidor, no una copia en el cliente que puede quedar desincronizada.
    //
    // `vigente` evita escribir estado sobre una pantalla que el usuario ya
    // abandono: sin esta guarda, salir del panel mientras carga produce un
    // aviso de React y, peor, una fuga de memoria silenciosa.
    let vigente = true;

    void (async () => {
      const { estado, datos } = await pedirApi<Resumen>('/mi-escuela');
      if (!vigente) return;
      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (datos) setResumen(datos);
      else setError('No pudimos cargar los datos de tu escuela.');
    })();

    return () => {
      vigente = false;
    };
  }, [router]);

  async function salir() {
    // Con cookie httpOnly el cliente NO puede borrarla: se le pide al servidor
    // que la retire. Antes bastaba con limpiar el almacenamiento local; ahora
    // cerrar sesion es una operacion real contra la API.
    await pedirApi('/auth/logout', { method: 'POST' }).catch(() => null);
    router.replace('/');
  }

  const etiquetaCohortes =
    resumen?.cohortes.length && resumen.cohortes[0]
      ? (TIPO_COHORTE[resumen.cohortes[0].tipo]?.plural ?? 'Grupos')
      : 'Grupos';

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 'var(--space-5) var(--space-4)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
            {resumen?.escuela?.nombre ?? 'Cargando…'}
          </h1>
          <div
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              marginTop: 'var(--space-2)',
              flexWrap: 'wrap',
            }}
          >
            {resumen?.escuela && (
              <Insignia tono="info">
                {VERTICAL[resumen.escuela.vertical] ?? resumen.escuela.vertical}
              </Insignia>
            )}
            {resumen?.periodo && (
              <Insignia tono="neutro">
                {TIPO_PERIODO[resumen.periodo.tipo] ?? resumen.periodo.tipo}:{' '}
                {resumen.periodo.nombre}
              </Insignia>
            )}
          </div>
        </div>
        <Boton
          variante="secundario"
          onClick={() => {
            void salir();
          }}
        >
          Salir
        </Boton>
      </header>

      {error && (
        <Tarjeta>
          <p role="alert">{error}</p>
        </Tarjeta>
      )}

      {resumen && (
        <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
          {resumen.misRoles.some((r) => ROLES_PASE_LISTA.includes(r)) && (
            <Tarjeta titulo="La operación de hoy">
              <p style={{ color: 'var(--texto-tenue)', margin: 'var(--space-2) 0 var(--space-3)' }}>
                Toma asistencia de tus grupos. Cuando un alumno acumula faltas, su familia recibe el
                aviso en la app automáticamente.
              </p>
              <Boton onClick={() => router.push('/panel/pase-lista')}>Pasar lista</Boton>
            </Tarjeta>
          )}
          <div
            style={{
              display: 'grid',
              gap: 'var(--space-4)',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            }}
          >
            <Cifra etiqueta="Alumnos" valor={resumen.totales.alumnos} />
            <Cifra etiqueta="Tutores" valor={resumen.totales.tutores} />
            <Cifra etiqueta="Personal con acceso" valor={resumen.totales.usuarios} />
          </div>

          <Tarjeta titulo={etiquetaCohortes}>
            {resumen.cohortes.length === 0 ? (
              <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-3)' }}>
                Aún no hay grupos en este periodo.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0' }}>
                {resumen.cohortes.map((c) => (
                  <li key={c.id} style={filaEstilo}>
                    <strong>{c.nombre}</strong>
                    <span style={{ color: 'var(--texto-tenue)', fontSize: 'var(--font-size-sm)' }}>
                      {c.inscritos} {c.inscritos === 1 ? 'inscrito' : 'inscritos'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>

          <Tarjeta titulo="Sedes">
            <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0' }}>
              {resumen.sedes.map((sede) => (
                <li key={sede.id} style={filaEstilo}>
                  <strong>{sede.nombre}</strong>
                  <span style={{ color: 'var(--texto-tenue)', fontSize: 'var(--font-size-sm)' }}>
                    {/* Una academia no tiene CCT ni RVOE: se dice, en vez de
                        dejar un hueco que parezca un error de carga. */}
                    {sede.cct ? `CCT ${sede.cct}` : 'Sin clave SEP'}
                    {sede.rvoe ? ` · ${sede.rvoe}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Tu acceso">
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-3)',
                flexWrap: 'wrap',
              }}
            >
              {resumen.misRoles.map((r) => (
                <Insignia key={r} tono="exito">
                  {ROL[r] ?? r}
                </Insignia>
              ))}
            </div>
            {resumen.misRoles.length > 1 && (
              <p
                style={{
                  color: 'var(--texto-tenue)',
                  fontSize: 'var(--font-size-sm)',
                  marginTop: 'var(--space-3)',
                }}
              >
                Tienes varios roles en esta escuela: puedes hacer todo lo de cada uno sin cambiar de
                cuenta.
              </p>
            )}
          </Tarjeta>
        </div>
      )}
    </main>
  );
}

const filaEstilo = {
  padding: 'var(--space-3) 0',
  borderBottom: '1px solid var(--borde)',
  display: 'flex',
  justifyContent: 'space-between',
  gap: 'var(--space-3)',
  flexWrap: 'wrap' as const,
};

function Cifra({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <Tarjeta>
      <p style={{ color: 'var(--texto-tenue)', fontSize: 'var(--font-size-sm)', margin: 0 }}>
        {etiqueta}
      </p>
      <p
        style={{
          fontSize: 'var(--font-size-4xl)',
          fontWeight: 'var(--font-weight-extrabold)',
          color: 'var(--texto-primario)',
          margin: 'var(--space-1) 0 0',
          // Los digitos alineados en columna se comparan de un vistazo.
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {valor}
      </p>
    </Tarjeta>
  );
}
