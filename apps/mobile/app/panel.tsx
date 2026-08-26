import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { paleta, AREA_TACTIL } from '../tema';
import { leerToken, olvidarToken } from '../sesion';
import { registrarDispositivo } from '../notificaciones';
import { pedirApi } from '../api';

interface Aviso {
  id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  creadaEn: string;
  leida: boolean;
}

interface Hijo {
  id: string;
  nombre: string;
  apellidos: string;
  cohorte: { nombre: string; tipo: string } | null;
  sede: string | null;
  escuela: string;
  parentesco: string;
  soyPagador: boolean;
}

/** El vocabulario cambia con la vertical, igual que en la web. */
const TIPO_COHORTE: Record<string, string> = {
  GRADO: 'Grupo',
  CATEGORIA: 'Categoría',
  NIVEL: 'Nivel',
  TALLER: 'Taller',
};

/**
 * Home de la familia (AZ-M6.1).
 *
 * La investigacion de mercado fue clara: el padre vuelve a la app por
 * informacion de SU hijo, no por un muro general. Por eso lo primero — y por
 * ahora lo unico — que ve son sus hijos, cada uno con su grupo y su escuela.
 * Cuando lleguen calificaciones (R2) y estado de cuenta (S5), colgaran de
 * aqui: esta pantalla es el indice de la vida escolar de cada hijo.
 */
export default function PantallaPanel() {
  const c = paleta(useColorScheme());
  const [hijos, setHijos] = useState<Hijo[] | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    const token = await leerToken();
    if (!token) {
      router.replace('/');
      return;
    }
    const { estado, ok, datos } = await pedirApi<Hijo[]>('/mis-hijos', { token });

    if (estado === 401) {
      await olvidarToken();
      router.replace('/');
      return;
    }
    if (estado === 403) {
      // Una cuenta de staff en la app de familias: no es un error, es una
      // cuenta que pertenece a la otra superficie.
      setError('Esta app es para madres, padres y tutores. Entra al portal web con tu cuenta.');
      return;
    }
    if (!ok || !datos) {
      setError('No pudimos cargar la información. Revisa tu conexión.');
      return;
    }

    setHijos(datos);

    // Los avisos se piden APARTE y su fallo no tumba la pantalla: si el
    // servicio de avisos tuviera un mal minuto, la madre debe seguir viendo a
    // sus hijos. Degradar una parte es mejor que caerse entera.
    const respuestaAvisos = await pedirApi<Aviso[]>('/mis-avisos', { token }).catch(() => null);
    setAvisos(respuestaAvisos?.datos ?? []);

    setError(null);
  }, []);

  useEffect(() => {
    // La carga va dentro de una funcion asincrona y no como llamada directa:
    // asi el analizador ve la frontera del await y distingue un setState
    // legitimo —despues de la espera— de uno sincrono que encadenaria renders.
    void (async () => {
      await cargar();

      // El dispositivo se registra en cada arranque porque el sistema operativo
      // rota los tokens; si falla, la app sigue funcionando sin avisos en vez
      // de quedarse en blanco.
      const token = await leerToken();
      if (token) await registrarDispositivo(token).catch(() => null);
    })();
  }, [cargar]);

  /**
   * Marcar leido al tocar. Optimista a proposito: la marca es reversible y de
   * bajo riesgo, y esperar al servidor para pintar un cambio que el dedo ya
   * hizo se siente roto en la red de una escuela.
   */
  async function marcarLeido(aviso: Aviso) {
    if (aviso.leida) return;
    setAvisos((previos) => previos.map((a) => (a.id === aviso.id ? { ...a, leida: true } : a)));
    await pedirApi(`/mis-avisos/${aviso.id}/leido`, { method: 'POST' }).catch(() => null);
  }

  async function salir() {
    await olvidarToken();
    router.replace('/');
  }

  if (error) {
    return (
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text accessibilityRole="alert" style={{ color: c.texto }}>
          {error}
        </Text>
        <Boton
          texto="Salir"
          onPress={() => {
            void salir();
          }}
          c={c}
        />
      </ScrollView>
    );
  }

  if (!hijos) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accionFondo} />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12 }}
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
      <Text style={{ fontSize: 24, fontWeight: '700', color: c.titulo }}>
        {hijos.length === 1 ? 'Tu hija o hijo' : 'Tus hijas e hijos'}
      </Text>

      {/* Los avisos van ARRIBA de las tarjetas: si la escuela tiene algo que
          decir hoy, es lo primero que la familia debe ver. Debajo de los hijos
          quedaria abajo del pliegue en un telefono con dos o tres alumnos. */}
      {avisos.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: c.titulo }}>Avisos</Text>
          {avisos.slice(0, 5).map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                void marcarLeido(a);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${a.leida ? 'Aviso leído' : 'Aviso nuevo'}: ${a.titulo}. ${a.cuerpo}`}
              style={{
                backgroundColor: c.superficie,
                borderRadius: 12,
                padding: 14,
                gap: 4,
                // Lo NO leido se marca con una barra lateral Y con la palabra
                // "Nuevo": el color nunca porta solo el significado.
                borderLeftWidth: a.leida ? 0 : 4,
                borderLeftColor: c.accionFondo,
                minHeight: AREA_TACTIL,
              }}
            >
              <Text style={{ fontWeight: '600', color: c.titulo }}>
                {a.leida ? '' : 'Nuevo · '}
                {a.titulo}
              </Text>
              <Text style={{ color: c.texto }}>{a.cuerpo}</Text>
            </Pressable>
          ))}
        </View>
      )}

      {hijos.length === 0 && (
        <Text style={{ color: c.tenue }}>
          Todavía no hay alumnos vinculados a tu cuenta. La escuela puede asociarlos desde su panel.
        </Text>
      )}

      {hijos.map((h) => (
        // La tarjeta lleva al estado de cuenta: es la pregunta que mas trae de
        // vuelta a la familia, y esconderla tras un menu la convierte en una
        // llamada a la escuela.
        <Pressable
          key={h.id}
          onPress={() => router.push({ pathname: '/estado-de-cuenta', params: { alumnoId: h.id } })}
          accessibilityRole="button"
          accessibilityLabel={`${h.nombre} ${h.apellidos}, ${
            h.cohorte
              ? `${TIPO_COHORTE[h.cohorte.tipo] ?? 'Grupo'} ${h.cohorte.nombre}`
              : 'sin grupo'
          }, ${h.escuela}. Ver estado de cuenta.`}
          style={{
            backgroundColor: c.superficie,
            borderRadius: 12,
            padding: 16,
            gap: 6,
            minHeight: AREA_TACTIL,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '600', color: c.titulo }}>
            {h.nombre} {h.apellidos}
          </Text>
          <Text style={{ color: c.texto }}>
            {h.cohorte
              ? `${TIPO_COHORTE[h.cohorte.tipo] ?? 'Grupo'} ${h.cohorte.nombre}`
              : 'Sin grupo asignado'}
            {h.sede ? ` · ${h.sede}` : ''}
          </Text>
          <Text style={{ color: c.tenue, fontSize: 12 }}>{h.escuela}</Text>
          <Text style={{ color: c.texto, fontSize: 13, marginTop: 2 }}>Ver estado de cuenta ›</Text>
        </Pressable>
      ))}

      <Boton
        texto="Salir"
        onPress={() => {
          void salir();
        }}
        c={c}
      />
    </ScrollView>
  );
}

function Boton({
  texto,
  onPress,
  c,
}: {
  texto: string;
  onPress: () => void;
  c: ReturnType<typeof paleta>;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={{
        minHeight: AREA_TACTIL,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: c.borde,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
      }}
    >
      <Text style={{ color: c.texto }}>{texto}</Text>
    </Pressable>
  );
}
