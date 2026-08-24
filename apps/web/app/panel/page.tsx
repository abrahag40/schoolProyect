'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, Insignia, Tarjeta } from '@azahar/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

interface Resumen {
  escuela: { nombre: string; vertical: string } | null;
  sedes: Array<{ id: string; nombre: string; cct: string | null; rvoe: string | null }>;
  totalUsuarios: number;
}

/** Nombres legibles: el usuario ve "Academia deportiva", no ACADEMIA_DEPORTIVA. */
const NOMBRE_VERTICAL: Record<string, string> = {
  COLEGIO: 'Colegio',
  UNIVERSIDAD: 'Universidad',
  ACADEMIA_DEPORTIVA: 'Academia deportiva',
  ESCUELA_IDIOMAS: 'Escuela de idiomas',
  TALLER: 'Taller',
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

  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: 'var(--space-5) var(--space-4)' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-5)',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-size-3xl)', fontWeight: 'var(--font-weight-bold)' }}>
            {resumen?.escuela?.nombre ?? 'Cargando…'}
          </h1>
          {resumen?.escuela && (
            <div style={{ marginTop: 'var(--space-2)' }}>
              <Insignia tono="info">
                {NOMBRE_VERTICAL[resumen.escuela.vertical] ?? resumen.escuela.vertical}
              </Insignia>
            </div>
          )}
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
          <Tarjeta titulo="Sedes">
            <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-3) 0 0' }}>
              {resumen.sedes.map((sede) => (
                <li
                  key={sede.id}
                  style={{
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--borde)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                    flexWrap: 'wrap',
                  }}
                >
                  <strong>{sede.nombre}</strong>
                  <span style={{ color: 'var(--texto-tenue)', fontSize: 'var(--font-size-sm)' }}>
                    {/* Una academia no tiene CCT ni RVOE: se dice, no se deja
                        un hueco que parezca un error de carga. */}
                    {sede.cct ? `CCT ${sede.cct}` : 'Sin clave SEP'}
                    {sede.rvoe ? ` · ${sede.rvoe}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </Tarjeta>

          <Tarjeta titulo="Personal con acceso">
            <p
              style={{
                fontSize: 'var(--font-size-4xl)',
                fontWeight: 'var(--font-weight-extrabold)',
                color: 'var(--texto-primario)',
                margin: 'var(--space-2) 0 0',
              }}
            >
              {resumen.totalUsuarios}
            </p>
          </Tarjeta>
        </div>
      )}
    </main>
  );
}
