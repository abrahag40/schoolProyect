import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { paleta } from '../tema';

export default function DisenoRaiz() {
  const esquema = useColorScheme();
  const c = paleta(esquema);

  return (
    <>
      <StatusBar style={esquema === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.superficie },
          headerTintColor: c.titulo,
          contentStyle: { backgroundColor: c.fondo },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Entrar' }} />
        <Stack.Screen name="panel" options={{ title: 'Mi escuela' }} />
      </Stack>
    </>
  );
}
