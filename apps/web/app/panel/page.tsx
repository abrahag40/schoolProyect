'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarCheck, ScrollText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/common/container';
import { pedirApi } from '../api';
import { TarjetasCobranza, type CifrasCobranza } from './componentes/tarjetas-cobranza';

/**
 * EL DASHBOARD (AZ-D2.6, AZ-D2.7).
 *
 * Copia la REJILLA del demo1 de Metronic —fila de cifras 2x2 junto a un bloque
 * ancho, luego una columna estrecha junto a una ancha— y le mete el contenido
 * de Azahar. Las cifras son reales: salen de `/morosidad`, el mismo endpoint
 * que alimenta la pantalla de cobranza.
 *
 * POR QUE DATOS REALES Y NO LOS DE LA PLANTILLA. Decision del CEO del
 * 6-sep-2026. Un dashboard de demostracion con cifras inventadas se ve igual de
 * bien y no prueba nada: el dia de la demo hay que explicar que no son de
 * verdad. Con datos reales, la pantalla ES la prueba de que el sistema calcula.
 *
 * LOS BLOQUES QUE NO TIENEN FUENTE se dejaron fuera en vez de rellenarse con
 * los del demo1 (grafica de ingresos, equipos, reunion). Traerlos con datos
 * falsos habria hecho la pantalla mas parecida al demo y menos verdadera, y en
 * una pantalla de dinero eso no se hace.
 */

interface Familia {
  alumnoId: string;
  alumno: string;
  saldo: string;
  diasDeAtraso: number;
  situacion: { periodosEnMora: number; puedeSuspender: boolean; explicacion: string };
}

interface Morosidad {
  hoy: string;
  cobrado: string;
  porCobrar: string;
  vencido: string;
  familias: Familia[];
}

interface Resumen {
  escuela: { nombre: string; vertical: string } | null;
  periodo: { nombre: string; tipo: string } | null;
  totales: { alumnos: number; tutores: number; usuarios: number };
  misRoles: string[];
}

const ROLES_COBRANZA = ['DUENO', 'DIRECTOR', 'ADMIN', 'COBRANZA'];
const ROLES_PASE_LISTA = ['DOCENTE', 'DIRECTOR', 'ADMIN', 'DUENO'];

function conSeparadores(monto: string): string {
  const [entero = '0', decimales = '00'] = monto.split('.');
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
}

export default function Panel() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [morosidad, setMorosidad] = useState<Morosidad | null>(null);

  useEffect(() => {
    let vigente = true;
    void (async () => {
      const escuela = await pedirApi<Resumen>('/mi-escuela');
      if (!vigente) return;
      if (escuela.datos) setResumen(escuela.datos);

      // La cobranza se pide aparte y su fallo NO tumba el panel: una docente
      // recibe 403 aqui, y para ella el resto de la pantalla sigue siendo util.
      const mora = await pedirApi<Morosidad>('/morosidad');
      if (!vigente) return;
      if (mora.datos) setMorosidad(mora.datos);
    })();
    return () => {
      vigente = false;
    };
  }, []);

  const roles = resumen?.misRoles ?? [];
  const puede = (permitidos: string[]) => roles.some((r) => permitidos.includes(r));

  const cifras: CifrasCobranza | null = morosidad
    ? {
        cobrado: morosidad.cobrado,
        porCobrar: morosidad.porCobrar,
        vencido: morosidad.vencido,
        familiasConAdeudo: morosidad.familias.length,
      }
    : null;

  // Las cinco mas urgentes. El endpoint ya viene ordenado por dias de atraso y,
  // a igualdad, por importe: aqui no se reordena, se recorta.
  const urgentes = (morosidad?.familias ?? []).slice(0, 5);

  return (
    <Container>
      <div className="grid gap-5 lg:gap-7.5">
        {/* Encabezado */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-mono text-2xl font-semibold">
              {resumen?.escuela?.nombre ?? 'Panel'}
            </h1>
            {resumen?.periodo && (
              <span className="text-muted-foreground text-sm">
                Ciclo escolar: {resumen.periodo.nombre}
              </span>
            )}
          </div>
          {resumen?.escuela && <Badge variant="secondary">{resumen.escuela.vertical}</Badge>}
        </div>

        {/* Fila 1: cifras 2x2 + la operacion de hoy — la rejilla del demo1.
         *
         * SE PARTE EN `xl` (1200px) Y NO EN `lg` (992px) COMO EL DEMO1. A 1024
         * px su rejilla deja 92 px utiles por tarjeta: suficiente para el
         * "9.3k" de sus ejemplos, no para "$49,147.08". Medido, y cazado por la
         * prueba de `panel-metronic.spec.ts` — no por el ojo.
         *
         * Es la unica desviacion de su rejilla, y va aqui declarada: el
         * contenido de Azahar es mas ancho que el suyo, y el punto de quiebre
         * tiene que responder al contenido real, no al del ejemplo. */}
        <div className="grid items-stretch gap-y-5 xl:grid-cols-3 xl:gap-7.5">
          <div className="xl:col-span-1">
            <div className="grid h-full grid-cols-2 items-stretch gap-5 xl:gap-7.5">
              <TarjetasCobranza cifras={cifras} />
            </div>
          </div>

          <div className="xl:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>La operación de hoy</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <p className="text-secondary-foreground text-sm leading-5.5">
                  Toma asistencia de tus grupos. Cuando un alumno acumula faltas, su familia recibe
                  el aviso en la app automáticamente.
                </p>
                {resumen && (
                  <div className="flex flex-wrap gap-6">
                    <div className="flex flex-col">
                      <span className="text-mono text-2xl font-semibold tabular-nums">
                        {resumen.totales.alumnos}
                      </span>
                      <span className="text-muted-foreground text-sm">Alumnos</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-mono text-2xl font-semibold tabular-nums">
                        {resumen.totales.tutores}
                      </span>
                      <span className="text-muted-foreground text-sm">Tutores</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-mono text-2xl font-semibold tabular-nums">
                        {resumen.totales.usuarios}
                      </span>
                      <span className="text-muted-foreground text-sm">Personal con acceso</span>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="gap-2.5">
                {puede(ROLES_PASE_LISTA) && (
                  <Button asChild>
                    <Link href="/panel/pase-lista">
                      <CalendarCheck className="size-4" aria-hidden="true" />
                      Pasar lista
                    </Link>
                  </Button>
                )}
                {puede(ROLES_COBRANZA) && (
                  <Button variant="outline" asChild>
                    <Link href="/panel/catalogo">
                      <ScrollText className="size-4" aria-hidden="true" />
                      Catálogo de cargos
                    </Link>
                  </Button>
                )}
              </CardFooter>
            </Card>
          </div>
        </div>

        {/* Fila 2: las familias que hay que atender primero. */}
        {puede(ROLES_COBRANZA) && (
          <Card>
            <CardHeader>
              <CardTitle>Familias que requieren atención</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-0 p-0">
              {urgentes.length === 0 ? (
                // Vacio ≠ error. Decirlo es mas util que dejar un hueco que
                // parece una falla de carga.
                <p className="text-muted-foreground p-5 text-sm">
                  {morosidad
                    ? 'Ninguna familia tiene saldo vencido. Nada que perseguir hoy.'
                    : 'Cargando…'}
                </p>
              ) : (
                urgentes.map((f) => (
                  <div
                    key={f.alumnoId}
                    className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 last:border-b-0"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-mono text-sm font-medium">{f.alumno}</span>
                      <span className="text-muted-foreground text-xs">
                        {f.situacion.explicacion}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {/* La insignia lleva TEXTO, no solo tono: el estado nunca
                          se comunica solo con color (WCAG 2.2 SC 1.4.1). */}
                      <Badge variant={f.diasDeAtraso > 0 ? 'destructive' : 'secondary'}>
                        {f.diasDeAtraso > 0 ? `${f.diasDeAtraso} días de atraso` : 'Sin vencer'}
                      </Badge>
                      <span className="text-mono text-base font-semibold tabular-nums">
                        ${conSeparadores(f.saldo)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
            <CardFooter className="justify-end">
              <Button variant="outline" asChild>
                <Link href="/panel/morosidad">
                  Ver toda la cobranza
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </Container>
  );
}
