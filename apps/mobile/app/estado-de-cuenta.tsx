import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { paleta } from '../tema';
import { pedirApi } from '../api';

interface CargoEnEstadoDeCuenta {
  concepto: string;
  periodo: string;
  total: string;
  miParte: string;
  miSaldo: string;
  vence: string;
  sinRecargoHasta: string;
  recargoHoy: string;
  vencido: boolean;
}

interface EstadoDeCuenta {
  alumno: string;
  hoy: string;
  cargos: CargoEnEstadoDeCuenta[];
  totalAPagar: string;
  recargoTotal: string;
  saldoAFavor: string;
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/** "2026-09" -> "septiembre de 2026". El padre lee meses, no códigos. */
function periodoLegible(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  return `${MESES[Number(mes) - 1] ?? periodo} de ${anio}`;
}

/** "2026-09-10" -> "10 de septiembre". */
function fechaLegible(fecha: string): string {
  const [, mes, dia] = fecha.split('-');
  return `${Number(dia)} de ${MESES[Number(mes) - 1] ?? mes}`;
}

/**
 * Estado de cuenta (AZ-M4.5) — pantalla 2 de la matriz D10.
 *
 * CRITERIO DE ACEPTACIÓN, literal del Plan Maestro: un padre sin contexto
 * responde **qué debe y por qué en menos de 30 segundos**. De ahí las tres
 * decisiones de esta pantalla:
 *
 *  1. **La cifra primero, sin competencia visual.** Es a lo que vino.
 *  2. **El desglose es parte de la pantalla, no un enlace aparte.** El "por
 *     qué" tiene que estar a la vista: el estado de cuenta confuso es queja
 *     documentada del sector.
 *  3. **La fecha real sin recargo, dicha.** No "vence el 5" a secas: hasta
 *     cuándo se acepta sin cargo, que por ley es al menos el día 10.
 *
 * Lo que esta pantalla NO tiene todavía es un botón de pagar: la pasarela es
 * el Sprint 6. Poner un botón que no cobra sería peor que no ponerlo.
 */
export default function PantallaEstadoDeCuenta() {
  const c = paleta(useColorScheme());
  const { alumnoId } = useLocalSearchParams<{ alumnoId: string }>();
  const [datos, setDatos] = useState<EstadoDeCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    if (!alumnoId) return;
    const {
      estado,
      ok,
      datos: cuerpo,
    } = await pedirApi<EstadoDeCuenta>(`/mis-hijos/${alumnoId}/estado-de-cuenta`);

    if (estado === 401) {
      router.replace('/');
      return;
    }
    if (!ok || !cuerpo) {
      setError('No pudimos cargar el estado de cuenta. Revisa tu conexión.');
      return;
    }
    setDatos(cuerpo);
    setError(null);
  }, [alumnoId]);

  useEffect(() => {
    void (async () => {
      await cargar();
    })();
  }, [cargar]);

  if (error) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text accessibilityRole="alert" style={{ color: c.texto }}>
          {error}
        </Text>
      </ScrollView>
    );
  }

  if (!datos) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accionFondo} />
      </View>
    );
  }

  const alCorriente = datos.cargos.length === 0;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl
          refreshing={recargando}
          onRefresh={() => {
            void (async () => {
              setRecargando(true);
              await cargar();
              setRecargando(false);
            })();
          }}
          tintColor={c.accionFondo}
        />
      }
    >
      <Text style={{ color: c.tenue }}>{datos.alumno}</Text>

      {alCorriente ? (
        <View style={{ backgroundColor: c.superficie, borderRadius: 12, padding: 20, gap: 8 }}>
          <Text style={{ fontSize: 22, fontWeight: '700', color: c.titulo }}>
            Estás al corriente
          </Text>
          <Text style={{ color: c.texto }}>
            No hay nada pendiente por pagar. Cuando la escuela genere el próximo cargo, aparecerá
            aquí.
          </Text>
          {datos.saldoAFavor !== '0.00' && (
            <Text style={{ color: c.texto, marginTop: 4 }}>
              Además tienes <Text style={{ fontWeight: '700' }}>${datos.saldoAFavor}</Text> a favor,
              que se aplicarán al próximo cargo.
            </Text>
          )}
        </View>
      ) : (
        <>
          {/* La cifra que importa, sin competencia visual. */}
          <View style={{ backgroundColor: c.superficie, borderRadius: 12, padding: 20, gap: 4 }}>
            <Text style={{ color: c.tenue }}>Tu parte por pagar</Text>
            <Text
              accessibilityLabel={`Debes ${datos.totalAPagar} pesos`}
              style={{ fontSize: 40, fontWeight: '800', color: c.titulo }}
            >
              ${datos.totalAPagar}
            </Text>
            {datos.recargoTotal !== '0.00' && (
              <Text style={{ color: c.peligro }}>
                Más ${datos.recargoTotal} de recargo por los días vencidos.
              </Text>
            )}
            {datos.saldoAFavor !== '0.00' && (
              <Text style={{ color: c.texto }}>
                Tienes ${datos.saldoAFavor} a favor que ya se están aplicando.
              </Text>
            )}
          </View>

          {/* El desglose: el "por qué" no puede estar detrás de un enlace. */}
          <View style={{ gap: 10 }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: c.titulo }}>
              De qué se compone
            </Text>

            {datos.cargos.map((cargo) => (
              <View
                key={`${cargo.concepto}-${cargo.periodo}`}
                accessible
                accessibilityLabel={
                  `${cargo.concepto} de ${periodoLegible(cargo.periodo)}: debes ${cargo.miSaldo} pesos. ` +
                  (cargo.vencido
                    ? 'Vencido.'
                    : `Sin recargo hasta el ${fechaLegible(cargo.sinRecargoHasta)}.`)
                }
                style={{
                  backgroundColor: c.superficie,
                  borderRadius: 12,
                  padding: 16,
                  gap: 6,
                  // El estado se marca con una barra Y con texto: el color nunca
                  // porta solo el significado.
                  borderLeftWidth: cargo.vencido ? 4 : 0,
                  borderLeftColor: c.peligro,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <Text style={{ fontWeight: '600', color: c.titulo, flex: 1 }}>
                    {cargo.concepto}
                  </Text>
                  <Text style={{ fontWeight: '700', color: c.titulo }}>${cargo.miSaldo}</Text>
                </View>

                <Text style={{ color: c.tenue, fontSize: 13 }}>
                  {periodoLegible(cargo.periodo)}
                  {cargo.miParte !== cargo.total && ` · tu parte de $${cargo.total}`}
                </Text>

                {/* La fecha legal, dicha. Por ley se aceptan pagos sin cargo
                    durante los primeros diez días naturales del mes. */}
                <Text style={{ color: cargo.vencido ? c.peligro : c.texto, fontSize: 13 }}>
                  {cargo.vencido
                    ? `Vencido — se aceptaba sin recargo hasta el ${fechaLegible(cargo.sinRecargoHasta)}`
                    : `Sin recargo hasta el ${fechaLegible(cargo.sinRecargoHasta)}`}
                </Text>
              </View>
            ))}
          </View>

          <Text style={{ color: c.tenue, fontSize: 13 }}>
            Para pagar, comunícate con la escuela. El pago desde la app llega pronto.
          </Text>
        </>
      )}
    </ScrollView>
  );
}
