import { useEffect, useState } from 'react';
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
import { paleta, AREA_TACTIL } from '../tema';
import { guardarToken, leerToken, desbloquear } from '../sesion';
import { configurarPresentacion } from '../notificaciones';
import { enviarJson } from '../api';

interface Sesion {
  token: string;
}

export default function PantallaLogin() {
  const c = paleta(useColorScheme());
  const [verificando, setVerificando] = useState(true);
  const [escuela, setEscuela] = useState('colegio-azahar');
  const [email, setEmail] = useState('elena@ejemplo.mx');
  const [contrasena, setContrasena] = useState('azahar-demo-2026');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sesion persistente con desbloqueo biometrico: quien ya entro una vez no
  // vuelve a teclear su contrasena, pero el telefono confirma que es la misma
  // persona. Es higiene que el corpus de resenas pide a gritos ("login
  // complicado" es queja recurrente en las apps escolares mexicanas).
  useEffect(() => {
    void (async () => {
      configurarPresentacion();
      const token = await leerToken();
      if (!token) {
        setVerificando(false);
        return;
      }
      const { ok } = await desbloquear();
      if (ok) router.replace('/panel');
      else setVerificando(false);
    })();
  }, []);

  async function entrar() {
    setError(null);
    setEnviando(true);
    try {
      // publica: true — es la unica llamada sin sesion. Marcarlo evita que una
      // peticion autenticada se quede sin token por olvido.
      const {
        ok,
        datos,
        error: fallo,
      } = await enviarJson<Sesion>(
        '/auth/login',
        { escuela, email, contrasena },
        { publica: true },
      );
      if (!ok || !datos) {
        setError(fallo?.message ?? 'No pudimos entrar.');
        return;
      }
      await guardarToken(datos.token);
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

  if (verificando) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={c.accionFondo} />
      </View>
    );
  }

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
        onPress={() => {
          void entrar();
        }}
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
