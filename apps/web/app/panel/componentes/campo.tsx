'use client';

import { useId, type ComponentProps, type ReactNode } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * PIEZAS DE FORMULARIO DE AZAHAR (AZ-D2.10).
 *
 * No son componentes de Metronic: son la composicion de los suyos —`Label`,
 * `Input`, `Checkbox`— que Azahar repite en todas sus pantallas de captura.
 *
 * POR QUE EXISTEN. Sin ellas, cada campo son cinco lineas de marcado y hay que
 * acordarse de tres cosas cada vez: `htmlFor` atado al `id`, un `id` unico, y
 * `aria-describedby` apuntando a la ayuda. Olvidar la tercera no rompe nada
 * visible —el texto se ve— pero un lector de pantalla lee la etiqueta y se
 * salta la explicacion, y es justo donde vive lo importante en este producto:
 * "esto cuenta para el Articulo 7", "esto no consume saldo a favor".
 *
 * `useId` genera el identificador: escribirlo a mano funciona hasta que dos
 * formularios coinciden en la misma pantalla y dos etiquetas apuntan al mismo
 * campo.
 */

export function Campo({
  etiqueta,
  ayuda,
  ...resto
}: { etiqueta: string; ayuda?: ReactNode } & ComponentProps<typeof Input>) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <Input id={id} {...(ayuda ? { 'aria-describedby': idAyuda } : {})} {...resto} />
      {ayuda && (
        <p id={idAyuda} className="text-muted-foreground text-xs">
          {ayuda}
        </p>
      )}
    </div>
  );
}

export function CampoSelect({
  etiqueta,
  ayuda,
  children,
  ...resto
}: { etiqueta: string; ayuda?: ReactNode } & ComponentProps<'select'>) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      {/* `<select>` nativo y no el `Select` de Radix: en movil el nativo abre
          el selector del sistema, que es mas rapido de usar con el pulgar y no
          se pelea con el teclado. El de Radix se reserva para donde haga falta
          contenido rico dentro de la opcion. */}
      <select
        id={id}
        className="border-input bg-background focus-visible:ring-ring h-8.5 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
        {...(ayuda ? { 'aria-describedby': idAyuda } : {})}
        {...resto}
      >
        {children}
      </select>
      {ayuda && (
        <p id={idAyuda} className="text-muted-foreground text-xs">
          {ayuda}
        </p>
      )}
    </div>
  );
}

/**
 * Una casilla CON su explicacion, no una casilla suelta.
 *
 * En este producto ninguna casilla es obvia: «Es una colegiatura» decide si el
 * cargo cuenta para el limite del Articulo 7, y «Puede pagarse con saldo a
 * favor» decide si el dinero que la familia dejo a cuenta se consume solo. Una
 * casilla sin su porque al lado se marca o se desmarca a ciegas.
 */
export function CampoCasilla({
  etiqueta,
  ayuda,
  marcada,
  alCambiar,
}: {
  etiqueta: string;
  ayuda: ReactNode;
  marcada: boolean;
  alCambiar: (valor: boolean) => void;
}) {
  const id = useId();
  const idAyuda = `${id}-ayuda`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2.5">
        <Checkbox
          id={id}
          checked={marcada}
          onCheckedChange={(v) => {
            // `onCheckedChange` puede entregar 'indeterminate'; aqui solo hay
            // dos estados, asi que se normaliza en vez de propagar el tercero.
            alCambiar(v === true);
          }}
          aria-describedby={idAyuda}
        />
        <Label htmlFor={id} className="cursor-pointer">
          {etiqueta}
        </Label>
      </div>
      <p id={idAyuda} className="text-muted-foreground ps-6 text-xs">
        {ayuda}
      </p>
    </div>
  );
}
