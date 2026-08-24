'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, CampoTexto, Tarjeta } from '@azahar/ui';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333';

export default function PaginaLogin() {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    const datos = new FormData(evento.currentTarget);
    try {
      const respuesta = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          escuela: datos.get('escuela'),
          email: datos.get('email'),
          contrasena: datos.get('contrasena'),
        }),
      });

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => null);
        // El mensaje del servidor ya esta redactado para una persona: se
        // muestra tal cual en vez de traducir codigos de estado a jerga.
        setError(cuerpo?.message ?? 'No pudimos entrar. Intenta de nuevo.');
        return;
      }

      const sesion = await respuesta.json();
      // DEUDA DECLARADA (dueno: equipo, vence en S1): el token vive en
      // sessionStorage, accesible desde JavaScript y por tanto expuesto a XSS.
      // La solucion correcta es cookie httpOnly + SameSite emitida por la API.
      // Se difiere a S1 con el resto de la sesion; queda anotada aqui y en el
      // CHANGELOG para que no se pierda.
      sessionStorage.setItem('azahar.sesion', JSON.stringify(sesion));
      router.push('/panel');
    } catch {
      setError('No pudimos contactar al servidor. Revisa tu conexion.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-4)',
      }}
    >
      <Tarjeta style={{ width: 'min(420px, 100%)' }}>
        <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 'var(--font-weight-bold)' }}>
          Azahar
        </h1>
        <p style={{ color: 'var(--texto-tenue)', marginTop: 'var(--space-1)' }}>
          Entra con la cuenta de tu escuela.
        </p>

        <form
          onSubmit={entrar}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
            marginTop: 'var(--space-5)',
          }}
        >
          <CampoTexto
            etiqueta="Escuela"
            name="escuela"
            required
            autoComplete="organization"
            defaultValue="colegio-azahar"
            ayuda="El identificador que te dimos, por ejemplo colegio-azahar."
          />
          <CampoTexto
            etiqueta="Correo"
            name="email"
            type="email"
            required
            autoComplete="username"
            defaultValue="directora@colegioazahar.mx"
          />
          <CampoTexto
            etiqueta="Contrasena"
            name="contrasena"
            type="password"
            required
            autoComplete="current-password"
            defaultValue="azahar-demo-2026"
          />

          {error && (
            <div
              role="alert"
              style={{
                background: 'var(--superficie-alt)',
                borderLeft: '3px solid var(--color-semantic-danger)',
                padding: 'var(--space-3)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 'var(--font-size-base)',
              }}
            >
              {error}
            </div>
          )}

          <Boton type="submit" cargando={enviando}>
            Entrar
          </Boton>
        </form>
      </Tarjeta>
    </main>
  );
}
