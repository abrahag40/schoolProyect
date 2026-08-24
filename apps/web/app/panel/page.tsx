'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, Insignia, Tarjeta } from '@azahar/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

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
};

export default function PaginaPanel() {
  const router = useRouter();
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const guardada = sessionStorage.getItem('azahar.sesion');
    if (!guardada) {
      router.replace('/');
      return;
    }
    const { token } = JSON.parse(guardada) as { token: string };

    fetch(`${API}/mi-escuela`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        if (r.status === 401) {
          sessionStorage.removeItem('azahar.sesion');
          router.replace('/');
          return null;
        }
        if (!r.ok) throw new Error('respuesta no ok');
        return r.json();
      })
      .then((datos) => datos && setResumen(datos))
      .catch(() => setError('No pudimos cargar los datos de tu escuela.'));
  }, [router]);

  function salir() {
    sessionStorage.removeItem('azahar.sesion');
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
        <Boton variante="secundario" onClick={salir}>
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
