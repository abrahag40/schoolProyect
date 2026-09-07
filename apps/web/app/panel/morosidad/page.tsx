'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { Search, TriangleAlert, X } from 'lucide-react';
import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardFooter,
  CardHeader,
  CardHeading,
  CardTable,
  CardTitle,
} from '@/components/ui/card';
import { Container } from '@/components/common/container';
import { DataGrid } from '@/components/ui/data-grid';
import { DataGridColumnHeader } from '@/components/ui/data-grid-column-header';
import { DataGridPagination } from '@/components/ui/data-grid-pagination';
import { DataGridTable } from '@/components/ui/data-grid-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { enviarJson, pedirApi } from '../../api';
import { TarjetasCobranza, type CifrasCobranza } from '../componentes/tarjetas-cobranza';

/**
 * COBRANZA (AZ-M4.8, reconstruida sobre el `DataGrid` en AZ-D2.5/AZ-D2.6).
 *
 * Tres decisiones que vienen del wireframe aprobado y de la ley, y que NO
 * cambian al cambiar de tecnologia:
 *
 *  1. **Las cifras arriba y siempre visibles.** Es lo que el director mira
 *     primero, antes que cualquier tabla.
 *  2. **La lectura legal ya hecha.** El Articulo 7 del Acuerdo de PROFECO
 *     permite suspender el servicio tras tres colegiaturas impagas, con 15 dias
 *     de aviso. La escuela no deberia tener que recordarlo.
 *  3. **El pago se registra aqui mismo.** Ver quien debe y tener que ir a otra
 *     seccion a capturar el abono es la friccion que hace que caja siga usando
 *     su libreta.
 *
 * --- POR QUE ESTAS COLUMNAS (estudio del 6-sep-2026) ----------------------
 *
 * El endpoint ordena por «mas dias de atraso, y a igualdad, mas dinero». Eso no
 * es una tabla de consulta: es una COLA DE TRABAJO. Las columnas responden a
 * «¿a quien le hablo hoy, que le digo, y que puedo hacer legalmente?».
 *
 * LAS COLUMNAS 3, 4 Y 5 PARECEN REDUNDANTES Y NO LO SON. Una familia puede
 * deber mucho sin meses vencidos (un cargo grande de inscripcion) o tener tres
 * meses vencidos con poco dinero (colegiaturas becadas). El Articulo 7 se
 * activa con la 5; la presion de caja esta en la 3. Colapsarlas repetiria el
 * error de §52, que ya se corrigio una vez.
 *
 * DECLARACION DE METODO: no hay investigacion primaria con personal de cobranza
 * escolar. Esto es hipotesis con evidencia —el esquema, el orden del endpoint y
 * la ley—, no hecho validado.
 *
 * PENDIENTE EN EL API para completar el estudio: grado/grupo del alumno, el
 * porcentaje de cada pagador, y el periodo mas antiguo vencido.
 */

interface Pagador {
  tutorId: string;
  nombre: string;
}

interface SituacionLegal {
  periodosEnMora: number;
  puedeSuspender: boolean;
  explicacion: string;
}

interface FamiliaMorosa {
  alumnoId: string;
  alumno: string;
  pagadores: Pagador[];
  saldo: string;
  diasDeAtraso: number;
  situacion: SituacionLegal;
}

interface Morosidad {
  hoy: string;
  cobrado: string;
  porCobrar: string;
  vencido: string;
  familias: FamiliaMorosa[];
}

interface ResultadoPago {
  pagoId: string;
  aplicado: string;
  saldoAFavor: string;
  aplicaciones: Array<{ concepto: string; periodo: string; monto: string }>;
}

/**
 * "41000.00" -> "41,000.00".
 *
 * Se formatea la CADENA, no un numero: convertir el importe a `number` para
 * darle formato lo haria pasar por punto flotante, que es justo lo que §43
 * prohibe. Aqui solo se insertan comas en la parte entera.
 */
function conSeparadores(monto: string): string {
  const [entero = '0', decimales = '00'] = monto.split('.');
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${decimales}`;
}

/** Lee un campo de texto de un formulario, sin dejar pasar un File como texto. */
function campoTexto(formulario: FormData, nombre: string): string {
  const valor = formulario.get(nombre);
  return typeof valor === 'string' ? valor : '';
}

/** Centavos, para ordenar por importe sin pasar por punto flotante (§43). */
function aCentavos(monto: string): number {
  const [entero = '0', decimales = '00'] = monto.split('.');
  return Number(entero) * 100 + Number(decimales.padEnd(2, '0').slice(0, 2));
}

export default function PaginaMorosidad() {
  const router = useRouter();
  const [datos, setDatos] = useState<Morosidad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cobrando, setCobrando] = useState<FamiliaMorosa | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [recibo, setRecibo] = useState<ResultadoPago | null>(null);
  const [recarga, setRecarga] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState<SortingState>([]);
  const [pagina, setPagina] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });

  useEffect(() => {
    let vigente = true;

    void (async () => {
      const { estado, datos: cuerpo } = await pedirApi<Morosidad>('/morosidad');
      if (!vigente) return;

      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (estado === 403) {
        setError('Esta sección es para administración y cobranza.');
        return;
      }
      if (!cuerpo) {
        setError('No pudimos cargar la cobranza.');
        return;
      }
      setDatos(cuerpo);
    })();

    return () => {
      vigente = false;
    };
  }, [router, recarga]);

  async function registrarPago(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!cobrando) return;

    setGuardando(true);
    setError(null);
    const formulario = new FormData(evento.currentTarget);

    const {
      ok,
      datos: resultado,
      error: fallo,
    } = await enviarJson<ResultadoPago>('/pagos', {
      tutorId: campoTexto(formulario, 'tutorId'),
      monto: campoTexto(formulario, 'monto'),
      fecha: campoTexto(formulario, 'fecha'),
      metodo: campoTexto(formulario, 'metodo'),
      ...(campoTexto(formulario, 'referencia')
        ? { referencia: campoTexto(formulario, 'referencia') }
        : {}),
    });

    setGuardando(false);
    if (!ok || !resultado) {
      setError(fallo?.detalles?.[0]?.mensaje ?? fallo?.message ?? 'No pudimos registrar el pago.');
      return;
    }

    setRecibo(resultado);
    setCobrando(null);
    setRecarga((n) => n + 1);
  }

  const familias = useMemo(() => {
    const todas = datos?.familias ?? [];
    const q = busqueda.trim().toLowerCase();
    if (!q) return todas;
    // Se busca por alumno Y por pagador: en el telefono, quien contesta es el
    // tutor, y el director muchas veces recuerda su nombre y no el del alumno.
    return todas.filter(
      (f) =>
        f.alumno.toLowerCase().includes(q) ||
        f.pagadores.some((p) => p.nombre.toLowerCase().includes(q)),
    );
  }, [datos, busqueda]);

  const columnas = useMemo<ColumnDef<FamiliaMorosa>[]>(
    () => [
      {
        id: 'alumno',
        accessorFn: (f) => f.alumno,
        header: ({ column }) => <DataGridColumnHeader title="Alumno" column={column} />,
        size: 240,
        cell: ({ row }) => (
          <div className="flex flex-col gap-0.5">
            <span className="text-mono font-medium">{row.original.alumno}</span>
            {/* Vacio ≠ error: una familia sin pagadores registrados es el estado
                real de una escuela recien migrada, y decirlo es mas util que
                dejar un hueco que parece una falla de carga. */}
            <span className="text-muted-foreground text-xs">
              {row.original.pagadores.length === 0
                ? 'Sin pagador registrado — hay que darlo de alta para poder cobrarle'
                : `Paga${row.original.pagadores.length > 1 ? 'n' : ''}: ${row.original.pagadores
                    .map((p) => p.nombre)
                    .join(' · ')}`}
            </span>
          </div>
        ),
      },
      {
        id: 'saldo',
        // Se ordena por CENTAVOS, no por la cadena: alfabeticamente "$9,796"
        // va despues de "$41,000", que es exactamente al reves de lo util.
        accessorFn: (f) => aCentavos(f.saldo),
        header: ({ column }) => <DataGridColumnHeader title="Saldo vencido" column={column} />,
        size: 140,
        cell: ({ row }) => (
          <span className="text-mono font-semibold tabular-nums">
            ${conSeparadores(row.original.saldo)}
          </span>
        ),
      },
      {
        id: 'dias',
        accessorFn: (f) => f.diasDeAtraso,
        header: ({ column }) => <DataGridColumnHeader title="Días de atraso" column={column} />,
        size: 140,
        cell: ({ row }) => (
          // La insignia lleva TEXTO, no solo tono: el estado nunca se comunica
          // unicamente con color (WCAG 2.2 SC 1.4.1).
          <Badge variant={row.original.diasDeAtraso > 0 ? 'destructive' : 'secondary'}>
            {row.original.diasDeAtraso > 0 ? `${row.original.diasDeAtraso} días` : 'Sin vencer'}
          </Badge>
        ),
      },
      {
        id: 'meses',
        accessorFn: (f) => f.situacion.periodosEnMora,
        header: ({ column }) => <DataGridColumnHeader title="Meses vencidos" column={column} />,
        size: 150,
        cell: ({ row }) => (
          <Badge variant={row.original.situacion.puedeSuspender ? 'destructive' : 'secondary'}>
            {row.original.situacion.periodosEnMora}{' '}
            {row.original.situacion.periodosEnMora === 1 ? 'colegiatura' : 'colegiaturas'}
          </Badge>
        ),
      },
      {
        id: 'situacion',
        enableSorting: false,
        header: () => 'Situación legal',
        size: 340,
        // El texto sale del DOMINIO, no de la pantalla (§45): la escuela puede
        // ser mas generosa que la ley, nunca mas estricta, y quien decide eso
        // es el API.
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {row.original.situacion.explicacion}
          </span>
        ),
      },
      {
        id: 'accion',
        enableSorting: false,
        header: () => '',
        size: 150,
        cell: ({ row }) =>
          row.original.pagadores.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setRecibo(null);
                setCobrando(row.original);
              }}
            >
              Registrar pago
            </Button>
          ) : null,
      },
    ],
    [],
  );

  const tabla = useReactTable({
    columns: columnas,
    data: familias,
    pageCount: Math.ceil(familias.length / pagina.pageSize),
    getRowId: (f) => f.alumnoId,
    state: { sorting: orden, pagination: pagina },
    onSortingChange: setOrden,
    onPaginationChange: setPagina,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const cifras: CifrasCobranza | null = datos
    ? {
        cobrado: datos.cobrado,
        porCobrar: datos.porCobrar,
        vencido: datos.vencido,
        familiasConAdeudo: datos.familias.length,
      }
    : null;

  return (
    <Container>
      <div className="grid gap-5 lg:gap-7.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-mono text-2xl font-semibold">Cobranza</h1>
          <p className="text-muted-foreground text-sm">
            Quién debe, desde cuándo y cuánto. Al {datos?.hoy ?? '…'}.
          </p>
        </div>

        {error && (
          <Alert variant="destructive" appearance="light">
            <AlertIcon>
              <TriangleAlert />
            </AlertIcon>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Las cifras arriba, como pide el wireframe D10. */}
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-7.5">
          <TarjetasCobranza cifras={cifras} />
        </div>

        {recibo && (
          <Alert appearance="light">
            <AlertDescription>
              Pago registrado: se aplicaron <strong>${conSeparadores(recibo.aplicado)}</strong>
              {recibo.aplicaciones.length > 0 && (
                <> a {recibo.aplicaciones.map((a) => `${a.concepto} ${a.periodo}`).join(', ')}</>
              )}
              {aCentavos(recibo.saldoAFavor) > 0 && (
                <> · Quedan ${conSeparadores(recibo.saldoAFavor)} a favor de la familia.</>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DataGrid
          table={tabla}
          recordCount={familias.length}
          isLoading={!datos && !error}
          emptyMessage="Ninguna familia tiene saldo vencido. Nada que perseguir hoy."
          tableLayout={{ rowBorder: true, headerBackground: true, columnsVisibility: true }}
        >
          <Card>
            <CardHeader>
              <CardHeading>
                <CardTitle>Familias con adeudo</CardTitle>
              </CardHeading>
              <div className="relative">
                <Search
                  className="text-muted-foreground absolute start-3 top-1/2 size-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <Input
                  aria-label="Buscar por alumno o pagador"
                  placeholder="Buscar familia…"
                  value={busqueda}
                  onChange={(e) => {
                    setBusqueda(e.target.value);
                    // Volver a la primera pagina al filtrar: sin esto, buscar
                    // desde la pagina 3 puede dejar la tabla vacia aunque haya
                    // resultados, y parece que no encontro nada.
                    setPagina((p) => ({ ...p, pageIndex: 0 }));
                  }}
                  className="w-48 ps-9"
                />
                {busqueda.length > 0 && (
                  <Button
                    mode="icon"
                    variant="ghost"
                    aria-label="Limpiar la búsqueda"
                    className="absolute end-1.5 top-1/2 size-6 -translate-y-1/2"
                    onClick={() => {
                      setBusqueda('');
                    }}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardTable>
              <ScrollArea>
                <DataGridTable />
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardTable>
            <CardFooter>
              {/* Los textos van por props: asi no hay que editar su componente
                  y la traduccion sobrevive a una version nueva de Metronic. */}
              <DataGridPagination
                sizesLabel="Mostrar"
                sizesDescription="por página"
                info="{from} - {to} de {count}"
              />
            </CardFooter>
          </Card>
        </DataGrid>
      </div>

      {/* El registro del pago en un dialogo y ya no incrustado en la fila: con
          una tabla paginada, un formulario que empuja las filas de abajo hace
          perder de vista a quien se le esta cobrando. */}
      <Dialog
        open={cobrando !== null}
        onOpenChange={(abierto) => {
          if (!abierto) setCobrando(null);
        }}
      >
        <DialogContent className="max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Registrar un pago</DialogTitle>
            <DialogDescription>{cobrando?.alumno}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form
              onSubmit={(evento) => {
                void registrarPago(evento);
              }}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="tutorId">Quién paga</Label>
                {/* `<select>` nativo y no el `Select` de Radix: dentro de un
                    dialogo, el suyo monta otro portal y en movil el teclado
                    tapa las opciones. El nativo usa el selector del sistema. */}
                <select
                  id="tutorId"
                  name="tutorId"
                  className="border-input bg-background h-8.5 rounded-md border px-3 text-sm"
                >
                  {cobrando?.pagadores.map((p) => (
                    <option key={p.tutorId} value={p.tutorId}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="monto">Importe recibido</Label>
                <Input
                  id="monto"
                  name="monto"
                  inputMode="decimal"
                  placeholder="1470.00"
                  required
                  aria-describedby="ayuda-monto"
                />
                <p id="ayuda-monto" className="text-muted-foreground text-xs">
                  Se aplica automáticamente al mes más antiguo. Lo que sobre queda a favor de la
                  familia.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fecha">Fecha del pago</Label>
                <Input id="fecha" name="fecha" type="date" defaultValue={datos?.hoy} required />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="metodo">Cómo pagó</Label>
                <select
                  id="metodo"
                  name="metodo"
                  defaultValue="TRANSFERENCIA"
                  className="border-input bg-background h-8.5 rounded-md border px-3 text-sm"
                >
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="DEPOSITO">Depósito</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="OTRO">Otro</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="referencia">Folio o referencia</Label>
                <Input id="referencia" name="referencia" />
              </div>

              <Button type="submit" disabled={guardando} className="w-full">
                {guardando ? 'Guardando…' : 'Registrar el pago'}
              </Button>
            </form>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </Container>
  );
}
