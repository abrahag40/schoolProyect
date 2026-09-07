'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { TriangleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertIcon } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardHeading, CardTitle } from '@/components/ui/card';
import { Container } from '@/components/common/container';
import { enviarJson, pedirApi } from '../../api';
import { Campo, CampoSelect } from '../componentes/campo';

/**
 * DATOS FISCALES DE LA ESCUELA — los acuerdos RVOE (AZ-A1).
 *
 * POR QUE ESTA PANTALLA EXISTE: desde el Sprint 6 el catalogo RECHAZA crear un
 * concepto deducible si no esta capturado el RVOE de su nivel. Sin un lugar
 * donde capturarlo, ese gate deja de proteger y se vuelve un muro — la escuela
 * no puede avanzar y no sabe por que. Una regla que no se puede satisfacer es
 * un defecto, por correcta que sea.
 *
 * Y va POR NIVEL, no por plantel: el RVOE se otorga por programa, asi que una
 * escuela con primaria y secundaria tiene dos acuerdos distintos. Con uno solo,
 * la mitad de las facturas saldrian con el numero equivocado.
 */

interface Rvoe {
  id: string;
  sedeId: string;
  sede: string;
  nivelEducativo: string;
  acuerdo: string;
}

interface Sede {
  id: string;
  nombre: string;
  cct: string | null;
  rvoes: Array<{ nivelEducativo: string; acuerdo: string }>;
}

interface Escuela {
  escuela: { nombre: string; vertical: string } | null;
  sedes: Sede[];
  marcoLegal: { aplicaAcuerdoProfeco: boolean; pisoSinRecargo: number; avisoDeAjuste: number };
}

const NIVEL: Record<string, string> = {
  PREESCOLAR: 'Preescolar',
  PRIMARIA: 'Primaria',
  SECUNDARIA: 'Secundaria',
  PROFESIONAL_TECNICO: 'Profesional técnico',
  BACHILLERATO: 'Bachillerato',
};

function campoTexto(formulario: FormData, nombre: string): string {
  const valor = formulario.get(nombre);
  return typeof valor === 'string' ? valor : '';
}

export default function PaginaEscuela() {
  const router = useRouter();
  const [escuela, setEscuela] = useState<Escuela | null>(null);
  const [rvoes, setRvoes] = useState<Rvoe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;

    void (async () => {
      const { estado, datos } = await pedirApi<Escuela>('/mi-escuela');
      if (!vigente) return;
      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (datos) setEscuela(datos);

      const { estado: e2, datos: rs } = await pedirApi<Rvoe[]>('/rvoe');
      if (!vigente) return;
      if (e2 === 403) {
        setError('Los datos fiscales los administra la dirección.');
        setSinPermiso(true);
        return;
      }
      if (rs) setRvoes(rs);
    })();

    return () => {
      vigente = false;
    };
  }, [router, recarga]);

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    const f = new FormData(evento.currentTarget);
    const { ok, error: fallo } = await enviarJson('/rvoe', {
      sedeId: campoTexto(f, 'sedeId'),
      nivelEducativo: campoTexto(f, 'nivelEducativo'),
      acuerdo: campoTexto(f, 'acuerdo'),
    });

    setGuardando(false);
    if (!ok) {
      setError(fallo?.detalles?.[0]?.mensaje ?? fallo?.message ?? 'No pudimos guardar el acuerdo.');
      return;
    }

    evento.currentTarget.reset();
    setRecarga((n) => n + 1);
  }

  return (
    <Container>
      <div className="grid gap-5 lg:gap-7.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-mono text-2xl font-semibold">Datos fiscales</h1>
          <p className="text-muted-foreground text-sm">
            Los acuerdos RVOE con los que se facturan las colegiaturas deducibles.
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

        {!sinPermiso && (
          <>
            {/* Que ley obliga a esta escuela, dicho por el DOMINIO (§51). La
                pantalla no lo deduce del vertical: eso viviria en dos sitios y
                uno de los dos se quedaria viejo. */}
            {escuela?.marcoLegal && (
              <Card>
                <CardHeader>
                  <CardHeading>
                    <CardTitle>Marco legal</CardTitle>
                  </CardHeading>
                </CardHeader>
                <CardContent className="p-5">
                  <p className="text-sm">
                    {escuela.marcoLegal.aplicaAcuerdoProfeco ? (
                      <>
                        A esta escuela la alcanza el Acuerdo de PROFECO: se aceptan pagos sin
                        recargo durante los primeros{' '}
                        <strong>{escuela.marcoLegal.pisoSinRecargo} días</strong> y los ajustes de
                        cuota se avisan con <strong>{escuela.marcoLegal.avisoDeAjuste} días</strong>{' '}
                        de anticipación.
                      </>
                    ) : (
                      <>
                        El Acuerdo de PROFECO <strong>no alcanza</strong> a esta institución. Las
                        ventanas de pago y los avisos de ajuste los fija tu reglamento.
                      </>
                    )}
                  </p>
                </CardContent>
              </Card>
            )}

            <div className="grid items-start gap-5 lg:gap-7.5 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardHeading>
                    <CardTitle>Acuerdos RVOE</CardTitle>
                  </CardHeading>
                </CardHeader>
                <CardContent className="p-0">
                  <p className="text-muted-foreground px-5 pt-4 text-sm">
                    Uno por plantel y nivel educativo. Sin el acuerdo del nivel, no puedes crear un
                    concepto deducible: el SAT rechaza la factura sin él.
                  </p>

                  {rvoes === null && <p className="text-muted-foreground p-5 text-sm">Cargando…</p>}

                  {rvoes?.length === 0 && (
                    <p className="text-muted-foreground p-5 text-sm">
                      Todavía no hay acuerdos capturados. Si tu escuela emite facturas deducibles,
                      empieza por aquí.
                    </p>
                  )}

                  <div className="mt-3 flex flex-col">
                    {rvoes?.map((r) => (
                      <div
                        key={r.id}
                        className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 last:border-b-0"
                      >
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-mono font-medium">
                            {NIVEL[r.nivelEducativo] ?? r.nivelEducativo}
                          </span>
                          <Badge variant="secondary">{r.sede}</Badge>
                        </div>
                        {/* Monoespaciada: es un folio, y se compara caracter a
                            caracter contra un papel del SAT. */}
                        <span className="text-primary font-mono text-sm">{r.acuerdo}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardHeading>
                    <CardTitle>Registrar o corregir un acuerdo</CardTitle>
                  </CardHeading>
                </CardHeader>
                <CardContent>
                  <form
                    onSubmit={(e) => {
                      void registrar(e);
                    }}
                    className="flex flex-col gap-4"
                  >
                    <CampoSelect etiqueta="Plantel" name="sedeId" required>
                      {escuela?.sedes.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </CampoSelect>

                    <CampoSelect
                      etiqueta="Nivel educativo"
                      name="nivelEducativo"
                      ayuda="Si vuelves a capturar un nivel que ya tiene acuerdo, se corrige el número — no se crea un segundo."
                    >
                      {Object.entries(NIVEL).map(([valor, texto]) => (
                        <option key={valor} value={valor}>
                          {texto}
                        </option>
                      ))}
                    </CampoSelect>

                    <Campo
                      etiqueta="Número de acuerdo"
                      name="acuerdo"
                      placeholder="ACUERDO 123/2024"
                      required
                    />

                    <Button type="submit" disabled={guardando}>
                      {guardando ? 'Guardando…' : 'Guardar acuerdo'}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </Container>
  );
}
