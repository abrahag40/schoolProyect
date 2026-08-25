import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { enviarJson } from './api';

/**
 * Registro del dispositivo para recibir avisos (AZ-M5.3).
 *
 * Se llama en CADA arranque, no una sola vez: el sistema operativo rota estos
 * tokens y un registro viejo deja a la familia sin enterarse de nada — sin
 * ningun error visible, que es lo peor de ese fallo.
 */
export async function registrarDispositivo(token: string): Promise<string | null> {
  // Un emulador no puede recibir avisos push reales. Detectarlo evita
  // perseguir un fantasma cuando "no llega la notificacion" en desarrollo.
  if (!Device.isDevice) return null;

  const { status: actual } = await Notifications.getPermissionsAsync();
  let permiso = actual;
  if (actual !== Notifications.PermissionStatus.GRANTED) {
    // Solo se pide si no estaba concedido: volver a preguntar cada arranque
    // es la clase de insistencia que hace que la gente desinstale.
    const { status } = await Notifications.requestPermissionsAsync();
    permiso = status;
  }
  if (permiso !== Notifications.PermissionStatus.GRANTED) return null;

  const { data: tokenPush } = await Notifications.getExpoPushTokenAsync();

  await enviarJson(
    '/notificaciones/dispositivo',
    {
      token: tokenPush,
      plataforma: Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB',
    },
    { token },
  );

  return tokenPush;
}

/**
 * Como se comporta un aviso con la app abierta.
 *
 * Se muestra en vez de silenciarse: la queja numero uno del corpus de resenas
 * de apps escolares es que los avisos no llegan o llegan tarde. Que el usuario
 * lo vea aunque tenga la app abierta es lo contrario de ese defecto.
 */
export function configurarPresentacion(): void {
  Notifications.setNotificationHandler({
    handleNotification: () =>
      Promise.resolve({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: true,
      }),
  });
}
