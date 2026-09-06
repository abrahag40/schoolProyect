'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { enviarJson } from './api';

/**
 * ENTRADA AL PANEL, sobre el layout `branded` de Metronic (AZ-D2.7).
 *
 * Dos columnas: el formulario a la izquierda y el panel de marca a la derecha,
 * que en movil pasa arriba. Es la estructura de su pantalla de `signin`.
 *
 * --- LAS CREDENCIALES DE DEMO YA NO SE PRECARGAN EN PRODUCCION ------------
 *
 * La version anterior traia `defaultValue` con la escuela, el correo Y LA
 * CONTRASEÑA de la directora. Comodo para la demo; inaceptable en un login
 * publico — y estaba desplegado en staging, que es internet.
 *
 * Ahora solo se rellenan cuando `NODE_ENV !== 'production'`. La comodidad se
 * conserva donde no hace daño y desaparece donde si. La constante se evalua al
 * compilar, asi que en el paquete de produccion las cadenas ni siquiera viajan.
 *
 * NOTA: las credenciales de demo siguen viviendo en `packages/db/scripts/seed.mjs`
 * y en CLAUDE.md, que es donde corresponde documentarlas.
 */

const ES_DEMO = process.env.NODE_ENV !== 'production';

/** Valores de cortesia SOLO fuera de produccion. En produccion, cadena vacia. */
const DEMO = {
  escuela: ES_DEMO ? 'colegio-azahar' : '',
  email: ES_DEMO ? 'directora@colegioazahar.mx' : '',
  contrasena: ES_DEMO ? 'azahar-demo-2026' : '',
};

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
      setError('No pudimos contactar al servidor. Revisa tu conexión.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <div className="grid grow lg:grid-cols-2">
        {/* El formulario. `order` lo pone SEGUNDO en escritorio y PRIMERO en
            movil: en un telefono lo que importa es entrar, no la marca. */}
        <div className="order-2 flex items-center justify-center p-8 lg:order-1 lg:p-10">
          <Card className="w-full max-w-[400px]">
            <CardContent className="flex flex-col gap-5 p-6">
              <div className="flex flex-col gap-1">
                <h1 className="text-mono text-xl font-semibold">Entrar a Azahar</h1>
                <p className="text-muted-foreground text-sm">
                  Con la cuenta que te dio tu escuela.
                </p>
              </div>

              <form
                onSubmit={(evento) => {
                  void entrar(evento);
                }}
                className="flex flex-col gap-4"
              >
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="escuela">Escuela</Label>
                  <Input
                    id="escuela"
                    name="escuela"
                    required
                    autoComplete="organization"
                    defaultValue={DEMO.escuela}
                    placeholder="colegio-azahar"
                    aria-describedby="ayuda-escuela"
                  />
                  {/* `aria-describedby` ata la ayuda al campo: sin el, un lector
                      de pantalla lee la etiqueta y se salta la explicacion. */}
                  <p id="ayuda-escuela" className="text-muted-foreground text-xs">
                    El identificador que te dimos, por ejemplo colegio-azahar.
                  </p>
                </div>

                {/* La web es el portal del PERSONAL de la escuela; la app movil
                    es la de las familias. Una cuenta de tutora aqui recibiria
                    403, que es justamente lo que debe pasar. */}
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Correo</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="username"
                    defaultValue={DEMO.email}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contrasena">Contraseña</Label>
                  <Input
                    id="contrasena"
                    name="contrasena"
                    type="password"
                    required
                    autoComplete="current-password"
                    defaultValue={DEMO.contrasena}
                  />
                </div>

                {error && (
                  // `role="alert"` lo trae el propio componente: el mensaje se
                  // anuncia solo al aparecer, sin que haya que mover el foco.
                  <Alert variant="destructive" appearance="light">
                    <AlertIcon>
                      <TriangleAlert />
                    </AlertIcon>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button type="submit" disabled={enviando} className="w-full">
                  {enviando ? 'Entrando…' : 'Entrar'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* EL PANEL DE MARCA, SIN LA IMAGEN DEL DEMO.
            Su layout `branded` pinta de fondo una captura del propio Metronic
            —su panel de temas, sus integraciones—. Poner el producto de un
            tercero en la entrada de Azahar es engañoso para quien lo ve y usa
            su arte, que la licencia permite usar pero no republicar (ADR-012).
            Se sustituye por un degradado con nuestros tokens: misma estructura
            de dos columnas, sin pedir prestada la pantalla de nadie. */}
        <div className="border-border from-primary/10 via-background to-background order-1 bg-gradient-to-br lg:order-2 lg:m-5 lg:rounded-xl lg:border">
          <div className="flex flex-col gap-4 p-8 lg:p-16">
            <span className="text-mono text-2xl font-bold tracking-tight">Azahar</span>

            <div className="flex flex-col gap-3">
              <h2 className="text-mono text-2xl font-semibold">La escuela, en un solo lugar</h2>
              <p className="text-secondary-foreground text-base font-medium">
                Cobranza, asistencia y comunicación con las familias.{' '}
                <span className="text-mono font-semibold">La familia nunca paga</span> por usar el
                sistema.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
