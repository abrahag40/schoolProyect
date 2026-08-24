import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { paleta, AREA_TACTIL } from '../tema';

const API = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333';

export default function PantallaLogin() {
  const c = paleta(useColorScheme());
  const [escuela, setEscuela] = useState('colegio-azahar');
  const [email, setEmail] = useState('directora@colegioazahar.mx');
  const [contrasena, setContrasena] = useState('azahar-demo-2026');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function entrar() {
    setError(null);
    setEnviando(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ escuela, email, contrasena }),
      });
      if (!r.ok) {
        const cuerpo = await r.json().catch(() => null);
        setError(cuerpo?.message ?? 'No pudimos entrar.');
        return;
      }
      const sesion = await r.json();
      // SecureStore y no AsyncStorage: el token va al llavero del sistema
      // (Keychain / Keystore), cifrado por el SO. AsyncStorage guarda texto
      // plano legible por cualquiera con acceso al sistema de archivos del
      // dispositivo — lineamiento OWASP MASVS-STORAGE-1.
      await SecureStore.setItemAsync('azahar.token', sesion.token);
      router.replace('/panel');
    } catch {
      setError('No pudimos contactar al servidor.');
    } finally {
      setEnviando(false);
    }
  }

  const estiloCampo = {
    minHeight: AREA_TACTIL,
    borderWidth: 1,
    borderColor: c.borde,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: c.texto,
    backgroundColor: c.superficie,
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '700', color: c.titulo }}>Azahar</Text>
      <Text style={{ color: c.tenue }}>Entra con la cuenta de tu escuela.</Text>

      <View style={{ gap: 4, marginTop: 12 }}>
        <Text style={{ fontSize: 12, fontWeight: '500', color: c.titulo }}>Escuela</Text>
        <TextInput
          value={escuela}
          onChangeText={setEscuela}
          autoCapitalize="none"
          style={estiloCampo}
          accessibilityLabel="Escuela"
        />
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '500', color: c.titulo }}>Correo</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          style={estiloCampo}
          accessibilityLabel="Correo"
        />
      </View>

      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 12, fontWeight: '500', color: c.titulo }}>Contrasena</Text>
        <TextInput
          value={contrasena}
          onChangeText={setContrasena}
          secureTextEntry
          style={estiloCampo}
          accessibilityLabel="Contrasena"
        />
      </View>

      {error && (
        <Text accessibilityRole="alert" style={{ color: c.peligro }}>
          {error}
        </Text>
      )}

      <Pressable
        onPress={entrar}
        disabled={enviando}
        accessibilityRole="button"
        style={{
          minHeight: AREA_TACTIL,
          borderRadius: 8,
          backgroundColor: c.accionFondo,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: enviando ? 0.6 : 1,
          marginTop: 8,
        }}
      >
        {enviando ? (
          <ActivityIndicator color={c.accionTexto} />
        ) : (
          <Text style={{ color: c.accionTexto, fontWeight: '500' }}>Entrar</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
