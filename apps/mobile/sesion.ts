import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';

const LLAVE_TOKEN = 'azahar.token';

/**
 * Sesion de la app movil.
 *
 * POR QUE AQUI NO SE USA COOKIE (a diferencia de la web): no hay navegador ni
 * DOM donde inyectar scripts, y SecureStore guarda el token en el llavero
 * cifrado del sistema operativo (Keychain en iOS, Keystore en Android). Cada
 * superficie usa el mecanismo seguro de SU plataforma; imponer uno solo a las
 * dos habria dejado a alguna con la proteccion equivocada.
 */
export async function guardarToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(LLAVE_TOKEN, token);
}

export async function leerToken(): Promise<string | null> {
  return SecureStore.getItemAsync(LLAVE_TOKEN);
}

export async function olvidarToken(): Promise<void> {
  await SecureStore.deleteItemAsync(LLAVE_TOKEN);
}

/**
 * Desbloqueo con biometria.
 *
 * Nunca es la unica puerta: el token ya vive cifrado en el llavero y la
 * biometria decide si se usa AHORA. Si el telefono no tiene sensor o el
 * usuario no lo configuro, se continua sin bloquear — negarle el acceso a
 * alguien por no tener huella registrada seria excluirlo de ver a su hijo.
 */
export async function desbloquear(): Promise<{ ok: boolean; motivo?: string }> {
  const hayHardware = await LocalAuthentication.hasHardwareAsync();
  const hayRegistro = await LocalAuthentication.isEnrolledAsync();
  if (!hayHardware || !hayRegistro) return { ok: true, motivo: 'sin-biometria' };

  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirma que eres tú',
    // Deja disponible el codigo del telefono como alternativa: si la huella
    // falla tres veces, la persona no se queda fuera de su propia app.
    disableDeviceFallback: false,
    cancelLabel: 'Usar contraseña',
  });

  return resultado.success ? { ok: true } : { ok: false, motivo: 'cancelado' };
}
