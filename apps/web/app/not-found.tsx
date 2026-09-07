import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

/**
 * 404 (AZ-D2.7).
 *
 * NO DICE «PÁGINA NO ENCONTRADA» Y YA. Quien llega aquí en un producto de
 * gestion escolar suele venir de un enlace viejo en un correo o de una
 * direccion escrita a mano; decirle solo el codigo lo deja sin salida. Se le
 * da el camino de vuelta, que es lo unico accionable.
 *
 * SIN NUMEROS GIGANTES NI ILUSTRACION. Su plantilla trae una version con un
 * dibujo a pantalla completa; aqui el 404 tiene que caber en el mismo armazon
 * que el resto y no pedir 3 MB de imagen para decir una frase.
 */
export default function NoEncontrada() {
  return (
    <div className="flex grow items-center justify-center p-8">
      <Card className="w-full max-w-[420px]">
        <CardContent className="flex flex-col gap-4 p-6">
          <span className="text-muted-foreground text-sm font-medium">Error 404</span>
          <h1 className="text-mono text-xl font-semibold">Esta página no existe</h1>
          <p className="text-secondary-foreground text-sm">
            Puede que el enlace sea de una versión anterior, o que la dirección tenga un error de
            escritura.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button asChild>
              <Link href="/panel">Ir al panel</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Entrar con otra cuenta</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
