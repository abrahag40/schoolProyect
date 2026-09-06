'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut, School, UserRound } from 'lucide-react';
import { pedirApi } from '@/app/api';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * EL MENU DE USUARIO DE AZAHAR (AZ-D2.7).
 *
 * Ocupa el lugar del `UserDropdownMenu` del demo1, que dependia de `next-auth`
 * y de su i18n. Azahar autentica con una cookie httpOnly contra nuestro propio
 * API, asi que la pieza se reescribe; lo que se conserva es su composicion de
 * componentes (`DropdownMenu` + `Avatar`), que es lo que le da el aspecto.
 *
 * SIN FOTO DE PERFIL, A PROPOSITO. El demo1 pinta un avatar de archivo. Azahar
 * no guarda fotos de usuario todavia, y poner una generica haria creer que el
 * dato existe. Se muestran las iniciales de la escuela: es informacion real.
 */

/** Forma REAL de `/mi-escuela`. `escuela` es null mientras no hay sede dada de alta. */
interface Resumen {
  escuela: { nombre: string; vertical: string } | null;
  misRoles: string[];
}

/** "Colegio Azahar" -> "CA". Dos letras como maximo: tres ya no se leen. */
function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function MenuUsuario() {
  const router = useRouter();
  const [sesion, setSesion] = useState<Resumen | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const { estado, datos } = await pedirApi<Resumen>('/mi-escuela');
      if (!vigente) return;
      // La verdad de la sesion la tiene el servidor, no una copia en el cliente.
      if (estado === 401) router.replace('/');
      else if (datos) setSesion(datos);
    })();
    return () => {
      vigente = false;
    };
  }, [router]);

  async function salir() {
    // El Content-Type no es decorativo: el API rechaza con 415 los POST que no
    // lo declaran, porque es lo que fuerza el preflight y con el la defensa CSRF.
    await pedirApi('/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }).catch(() => null);
    router.replace('/');
  }

  const nombre = sesion?.escuela?.nombre ?? 'Azahar';
  const roles = sesion?.misRoles ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" mode="icon" shape="circle" aria-label="Menú de la cuenta">
          <Avatar className="size-9">
            <AvatarFallback>{iniciales(nombre)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-1">
          <span className="flex items-center gap-2 font-medium">
            <School className="size-4 shrink-0" aria-hidden="true" />
            {nombre}
          </span>
          {roles.length > 0 && (
            <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
              <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
              {/* El rol en minusculas con inicial mayuscula: los enums del API
                  vienen en MAYUSCULAS y gritarle al usuario no es informacion. */}
              {roles.map((r) => r.charAt(0) + r.slice(1).toLowerCase()).join(' · ')}
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={() => {
            // `void` explicito: una promesa sin manejar en un manejador de
            // evento se traga los errores en silencio.
            void salir();
          }}
        >
          <LogOut className="size-4" aria-hidden="true" />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
