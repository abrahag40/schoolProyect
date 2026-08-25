'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Boton, CampoTexto, Tarjeta } from '@azahar/ui';
import { enviarJson } from './api';

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
      // La sesion viaja en una cookie httpOnly que el cliente NO puede leer, y
      // el cliente del API la envia sola (credentials: 'include'). Aqui no se
      // guarda nada: si hiciera falta saber quien inicio sesion, se le pregunta
      // al servidor, que es quien tiene la verdad.
      const { ok, error } = await enviarJson('/auth/login', {
        escuela: datos.get('escuela'),
        email: datos.get('email'),
        contrasena: datos.get('contrasena'),
      });

      if (!ok) {
        // El mensaje del servidor ya esta redactado para una persona: se
        // muestra tal cual en vez de traducir codigos de estado a jerga.
        setError(error?.message ?? 'No pudimos entrar. Intenta de nuevo.');
        return;
      }

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
          onSubmit={(evento) => {
            void entrar(evento);
          }}
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
          {/*
            La web es el portal del PERSONAL de la escuela; la app movil es la
            de las familias. Una cuenta de tutora aqui recibiria 403, que es
            justamente lo que debe pasar.
          */}
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
