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

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

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
  const [error, setError] = useState<string | null>(null);
  const [recargando, setRecargando] = useState(false);

  const cargar = useCallback(async () => {
    const token = await leerToken();
    if (!token) {
      router.replace('/');
      return;
    }
    try {
      const r = await fetch(`${API}/mis-hijos`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) {
        await olvidarToken();
        router.replace('/');
        return;
      }
      if (r.status === 403) {
        // Una cuenta de staff en la app de familias: no es un error, es una
        // cuenta que pertenece a la otra superficie.
        setError('Esta app es para madres, padres y tutores. Entra al portal web con tu cuenta.');
        return;
      }
      if (!r.ok) throw new Error('respuesta no ok');
      setHijos(await r.json());
      setError(null);
    } catch {
      setError('No pudimos cargar la información. Revisa tu conexión.');
    }
  }, []);

  useEffect(() => {
    void cargar();
    // El dispositivo se registra en cada arranque porque el sistema operativo
    // rota los tokens; si falla, la app sigue funcionando sin avisos en vez de
    // quedarse en blanco.
    void (async () => {
      const token = await leerToken();
      if (token) await registrarDispositivo(token).catch(() => null);
    })();
  }, [cargar]);

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
        <Boton texto="Salir" onPress={salir} c={c} />
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
          onRefresh={async () => {
            setRecargando(true);
            await cargar();
            setRecargando(false);
          }}
          tintColor={c.accionFondo}
        />
      }
    >
      <Text style={{ fontSize: 24, fontWeight: '700', color: c.titulo }}>
        {hijos.length === 1 ? 'Tu hija o hijo' : 'Tus hijas e hijos'}
      </Text>

      {hijos.length === 0 && (
        <Text style={{ color: c.tenue }}>
          Todavía no hay alumnos vinculados a tu cuenta. La escuela puede asociarlos desde su panel.
        </Text>
      )}

      {hijos.map((h) => (
        <View
          key={h.id}
          accessible
          accessibilityLabel={`${h.nombre} ${h.apellidos}, ${
            h.cohorte
              ? `${TIPO_COHORTE[h.cohorte.tipo] ?? 'Grupo'} ${h.cohorte.nombre}`
              : 'sin grupo'
          }, ${h.escuela}`}
          style={{ backgroundColor: c.superficie, borderRadius: 12, padding: 16, gap: 6 }}
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
        </View>
      ))}

      <Boton texto="Salir" onPress={salir} c={c} />
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
