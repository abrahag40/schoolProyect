import { Injectable, Logger } from '@nestjs/common';

/**
 * Puerto de notificaciones push (AZ-M5.3, cimiento).
 *
 * Patron adaptador con proveedor `simulated` por defecto (§18): desarrollo y
 * pruebas corren sin credenciales ni costo, y el proveedor real se activa por
 * variable de entorno. Igual que el puerto EmisorFiscal: el dominio habla con
 * la interfaz, nunca con el proveedor.
 *
 * ADVERTENCIA QUE VIENE CON EL PATRON: lo simulado engana si nunca se prueba
 * contra lo real. Un canal "configurado" que jamas entrego un mensaje a un
 * telefono no esta entregado. Por eso la validacion en dispositivo fisico es
 * un pendiente declarado del sprint, no un detalle que se da por hecho.
 */
export interface MensajePush {
  titulo: string;
  cuerpo: string;
  /// A donde lleva el toque. Sin esto la notificacion informa pero no resuelve
  /// — y el corpus de resenas muestra que ese es justamente el reclamo: la
  /// alerta llega y el padre no puede llegar al contenido.
  destino?: string;
  datos?: Record<string, string>;
}

export interface ResultadoEnvio {
  enviados: number;
  fallidos: number;
  /// Tokens que el proveedor reporto como muertos. Se dan de baja: seguir
  /// enviando a telefonos inexistentes degrada la reputacion del canal.
  tokensInvalidos: string[];
}

export abstract class Mensajero {
  abstract enviar(tokens: string[], mensaje: MensajePush): Promise<ResultadoEnvio>;
}

/**
 * Implementacion de desarrollo: registra en bitacora lo que habria enviado.
 *
 * No es un doble de prueba vacio: valida forma y limites reales (un token de
 * Expo tiene formato conocido) para que un error de integracion se vea aqui y
 * no la primera vez que se conecta el proveedor de verdad.
 */
@Injectable()
export class MensajeroSimulado extends Mensajero {
  private readonly log = new Logger('MensajeroSimulado');

  async enviar(tokens: string[], mensaje: MensajePush): Promise<ResultadoEnvio> {
    const invalidos = tokens.filter((t) => !/^ExponentPushToken\[.+\]$/.test(t));
    const validos = tokens.filter((t) => !invalidos.includes(t));

    this.log.log(
      `[simulado] "${mensaje.titulo}" -> ${validos.length} dispositivo(s)` +
        (mensaje.destino ? ` (abre ${mensaje.destino})` : ''),
    );

    return { enviados: validos.length, fallidos: invalidos.length, tokensInvalidos: invalidos };
  }
}
