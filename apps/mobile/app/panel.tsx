import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { paleta, AREA_TACTIL } from '../tema';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

interface Resumen {
  escuela: { nombre: string; vertical: string } | null;
  sedes: Array<{ id: string; nombre: string; cct: string | null }>;
  totalUsuarios: number;
}

export default function PantallaPanel() {
  const c = paleta(useColorScheme());
  const [resumen, setResumen] = useState<Resumen | null>(null);

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync('azahar.token');
      if (!token) {
        router.replace('/');
        return;
      }
      const r = await fetch(`${API}/mi-escuela`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) {
        await SecureStore.deleteItemAsync('azahar.token');
        router.replace('/');
        return;
      }
      setResumen(await r.json());
    })();
  }, []);

  async function salir() {
    await SecureStore.deleteItemAsync('azahar.token');
    router.replace('/');
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: c.titulo }}>
        {resumen?.escuela?.nombre ?? 'Cargando…'}
      </Text>

      {resumen?.sedes.map((sede) => (
        <View
          key={sede.id}
          style={{
            backgroundColor: c.superficie,
            borderRadius: 12,
            padding: 16,
            gap: 4,
          }}
        >
          <Text style={{ fontWeight: '600', color: c.titulo }}>{sede.nombre}</Text>
          <Text style={{ color: c.tenue, fontSize: 12 }}>
            {sede.cct ? `CCT ${sede.cct}` : 'Sin clave SEP'}
          </Text>
        </View>
      ))}

      <Pressable
        onPress={salir}
        accessibilityRole="button"
        style={{
          minHeight: AREA_TACTIL,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: c.borde,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ color: c.texto }}>Salir</Text>
      </Pressable>
    </ScrollView>
  );
}
