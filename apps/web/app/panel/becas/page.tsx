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
import { Campo, CampoCasilla, CampoSelect } from '../componentes/campo';

/**
 * BECAS Y CONVENIOS (AZ-M4.3a).
 *
 * TRES DECISIONES QUE NO SON COSMETICAS y que el cambio de marcado no toca:
 *
 *  1. **El motivo es obligatorio y se muestra.** La beca del 5 % de la matricula
 *     es obligacion legal (LGE 149-III), no cortesia. Una autoridad puede pedir
 *     a quien se otorgo y con que criterio, y un descuento sin motivo no prueba
 *     nada. Por eso el campo no es opcional ni esta escondido en un detalle.
 *  2. **La vigencia se dice en positivo y en negativo.** Una beca vencida sigue
 *     en la lista, marcada como vencida: desaparecerla haria creer que nunca
 *     existio, y los cargos que ya desconto seguirian ahi sin explicacion.
 *  3. **Retirar no borra.** El boton dice "Retirar" porque eso es lo que hace.
 */

interface Beca {
  id: string;
  alumno: string;
  alumnoId: string;
  tipo: string;
  valor: string;
  concepto: { id: string; nombre: string } | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  motivo: string;
  esObligacionLegal: boolean;
  activa: boolean;
  vigenteHoy: boolean;
}

interface AlumnoParaBeca {
  id: string;
  nombre: string;
  cohorte: string | null;
}

interface ConceptoBreve {
  id: string;
  nombre: string;
}

function campoTexto(formulario: FormData, nombre: string): string {
  const valor = formulario.get(nombre);
  return typeof valor === 'string' ? valor : '';
}

/** "2026-08-01" -> "1 ago 2026". La vigencia se lee de un vistazo o no se lee. */
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.split('-');
  return `${Number(dia)} ${MESES[Number(mes) - 1] ?? mes} ${anio}`;
}

export default function PaginaBecas() {
  const router = useRouter();
  const [becas, setBecas] = useState<Beca[] | null>(null);
  const [alumnos, setAlumnos] = useState<AlumnoParaBeca[]>([]);
  const [conceptos, setConceptos] = useState<ConceptoBreve[]>([]);
  const [error, setError] = useState<string | null>(null);
  /// Sin permiso NO se muestra el formulario ni la lista: dejar un formulario
  /// que no se puede enviar, y un "Cargando…" eterno debajo, es peor que un
  /// mensaje seco. Lo cazo la revision en el navegador.
  const [sinPermiso, setSinPermiso] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [tipo, setTipo] = useState<'PORCENTAJE' | 'MONTO_FIJO'>('PORCENTAJE');
  const [esLegal, setEsLegal] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    let vigente = true;

    void (async () => {
      const { estado, datos } = await pedirApi<Beca[]>('/becas');
      if (!vigente) return;

      if (estado === 401) {
        router.replace('/');
        return;
      }
      if (estado === 403) {
        setError('Esta sección es para administración y cobranza.');
        setSinPermiso(true);
        return;
      }
      if (!datos) {
        setError('No pudimos cargar las becas.');
        return;
      }
      setBecas(datos);

      // El catalogo y los alumnos alimentan el formulario; si fallan, la lista
      // sigue sirviendo. No se bloquea lo que ya se puede mostrar.
      const [{ datos: as }, { datos: cs }] = await Promise.all([
        pedirApi<AlumnoParaBeca[]>('/becas/alumnos'),
        pedirApi<ConceptoBreve[]>('/catalogo-cargos'),
      ]);
      if (!vigente) return;
      if (as) setAlumnos(as);
      if (cs) setConceptos(cs.map((c) => ({ id: c.id, nombre: c.nombre })));
    })();

    return () => {
      vigente = false;
    };
  }, [router, recarga]);

  async function otorgar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);

    const f = new FormData(evento.currentTarget);
    const hasta = campoTexto(f, 'vigenteHasta');
    const concepto = campoTexto(f, 'conceptoId');

    const { ok, error: fallo } = await enviarJson('/becas', {
      alumnoId: campoTexto(f, 'alumnoId'),
      tipo,
      valor: campoTexto(f, 'valor'),
      ...(concepto ? { conceptoId: concepto } : {}),
      vigenteDesde: campoTexto(f, 'vigenteDesde'),
      ...(hasta ? { vigenteHasta: hasta } : {}),
      motivo: campoTexto(f, 'motivo'),
      esObligacionLegal: esLegal,
    });

    setGuardando(false);
    if (!ok) {
      setError(fallo?.detalles?.[0]?.mensaje ?? fallo?.message ?? 'No pudimos guardar la beca.');
      return;
    }

    evento.currentTarget.reset();
    setEsLegal(false);
    setRecarga((n) => n + 1);
  }

  async function retirar(beca: Beca) {
    const motivo = window.prompt(
      `Retirar la beca de ${beca.alumno}. ¿Por qué? (queda en la bitácora)`,
    );
    if (motivo === null || motivo.trim().length < 3) return;

    const { ok, error: fallo } = await enviarJson(`/becas/${beca.id}/retirar`, { motivo });
    if (!ok) {
      setError(fallo?.message ?? 'No pudimos retirar la beca.');
      return;
    }
    setRecarga((n) => n + 1);
  }

  const legales = becas?.filter((b) => b.esObligacionLegal && b.vigenteHoy).length ?? 0;

  return (
    <Container>
      <div className="grid gap-5 lg:gap-7.5">
        <div className="flex flex-col gap-1">
          <h1 className="text-mono text-2xl font-semibold">Becas y convenios</h1>
          <p className="text-muted-foreground text-sm">
            Se aplican solas al generar los cargos, y dejan de aplicarse solas cuando vencen.
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
          <div className="grid items-start gap-5 lg:gap-7.5 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardHeading>
                  <CardTitle>Otorgadas</CardTitle>
                </CardHeading>
                {/* El contador del cumplimiento legal, arriba y sin tener que
                    sumarlo a mano: es el numero que una autoridad puede venir
                    a pedir. */}
                {legales > 0 && (
                  <Badge variant="info">{legales} vigente(s) por obligación legal</Badge>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {becas === null && <p className="text-muted-foreground p-5 text-sm">Cargando…</p>}

                {becas?.length === 0 && (
                  <p className="text-muted-foreground p-5 text-sm">
                    Todavía no hay becas registradas. La primera suele ser la del 5 % que exige la
                    ley.
                  </p>
                )}

                {becas?.map((b) => (
                  <div
                    key={b.id}
                    className="border-border flex flex-col gap-2 border-b px-5 py-4 last:border-b-0"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-mono font-medium">{b.alumno}</span>
                      <span className="text-mono font-semibold tabular-nums">
                        {b.tipo === 'PORCENTAJE' ? `${b.valor} %` : `$${b.valor}`}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {/* El estado lleva TEXTO, no solo color (SC 1.4.1). */}
                      <Badge variant={b.vigenteHoy ? 'success' : 'secondary'}>
                        {!b.activa
                          ? 'Retirada'
                          : b.vigenteHoy
                            ? 'Vigente hoy'
                            : 'Fuera de vigencia'}
                      </Badge>
                      {b.esObligacionLegal && <Badge variant="info">Obligación legal</Badge>}
                      <Badge variant="secondary">
                        {b.concepto ? `Solo ${b.concepto.nombre}` : 'Todos los conceptos'}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground text-xs">
                      {fechaCorta(b.vigenteDesde)} —{' '}
                      {b.vigenteHasta ? fechaCorta(b.vigenteHasta) : 'sin fecha de fin'} ·{' '}
                      {b.motivo}
                    </p>

                    {b.activa && (
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            void retirar(b);
                          }}
                        >
                          Retirar
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardHeading>
                  <CardTitle>Otorgar una beca</CardTitle>
                </CardHeading>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    void otorgar(e);
                  }}
                  className="flex flex-col gap-4"
                >
                  <CampoSelect etiqueta="Alumna o alumno" name="alumnoId" required>
                    {alumnos.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.nombre}
                        {a.cohorte ? ` · ${a.cohorte}` : ''}
                      </option>
                    ))}
                  </CampoSelect>

                  <CampoSelect
                    etiqueta="Tipo"
                    value={tipo}
                    onChange={(e) =>
                      setTipo(e.target.value === 'MONTO_FIJO' ? 'MONTO_FIJO' : 'PORCENTAJE')
                    }
                  >
                    <option value="PORCENTAJE">Porcentaje</option>
                    <option value="MONTO_FIJO">Monto fijo</option>
                  </CampoSelect>

                  <Campo
                    etiqueta={tipo === 'PORCENTAJE' ? 'Porcentaje' : 'Importe'}
                    name="valor"
                    placeholder={tipo === 'PORCENTAJE' ? '5.00' : '500.00'}
                    inputMode="decimal"
                    ayuda={
                      tipo === 'PORCENTAJE'
                        ? 'Entre 0 y 100. El 5 % de la matrícula es el mínimo que exige la ley.'
                        : 'En pesos. Se descuenta del precio de lista del concepto.'
                    }
                  />

                  <CampoSelect
                    etiqueta="Se aplica a"
                    name="conceptoId"
                    ayuda="Lo normal es becar la colegiatura y no el comedor."
                  >
                    <option value="">Todos los conceptos</option>
                    {conceptos.map((c) => (
                      <option key={c.id} value={c.id}>
                        Solo {c.nombre}
                      </option>
                    ))}
                  </CampoSelect>

                  <Campo
                    etiqueta="Vigente desde"
                    name="vigenteDesde"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                  />
                  <Campo
                    etiqueta="Vigente hasta"
                    name="vigenteHasta"
                    type="date"
                    ayuda="Opcional. Si la dejas vacía, la beca no caduca — y entonces alguien tiene que acordarse de retirarla."
                  />

                  <Campo
                    etiqueta="Motivo"
                    name="motivo"
                    placeholder="Beca de hermanos: segundo hijo inscrito"
                    ayuda="Obligatorio. Es la prueba de por qué se otorgó, y una autoridad puede pedirla."
                  />

                  <CampoCasilla
                    etiqueta="Cuenta para el 5 % que exige la ley"
                    marcada={esLegal}
                    alCambiar={setEsLegal}
                    ayuda="Márcalo en las becas con las que cumples la obligación de la Ley General de Educación (art. 149-III). Así puedes demostrar el cumplimiento sin revisar los motivos uno por uno."
                  />

                  <Button type="submit" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Otorgar beca'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </Container>
  );
}
