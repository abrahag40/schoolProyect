import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verify as verificarHash, hash as generarHash } from '@node-rs/argon2';
import { obtenerCliente, conTenant } from '@azahar/db';
import { emitirToken } from '../comun/sesion.js';

/**
 * Argon2id con los parametros recomendados por OWASP (Password Storage Cheat
 * Sheet): 19 MiB de memoria, 2 iteraciones, paralelismo 1. No son numeros
 * arbitrarios: equilibran resistencia a GPU y latencia aceptable de login.
 */
const OPCIONES_HASH = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export interface ResultadoLogin {
  token: string;
  usuario: { id: string; nombre: string; rol: string };
  escuela: { id: string; nombre: string; vertical: string };
}

@Injectable()
export class ServicioAuth {
  async hashDeContrasena(contrasena: string): Promise<string> {
    return generarHash(contrasena, OPCIONES_HASH);
  }

  /**
   * Entrada al sistema.
   *
   * El usuario declara su escuela por slug (no por id): un identificador
   * legible que puede escribir, y que ademas evita exponer los UUID internos.
   *
   * Nota sobre el orden de las consultas: la busqueda de la escuela ocurre
   * SIN contexto de tenant (es la operacion de plataforma que resuelve a que
   * escuela entrar); a partir de ahi, todo pasa por conTenant.
   */
  async iniciarSesion(slug: string, email: string, contrasena: string): Promise<ResultadoLogin> {
    const cliente = obtenerCliente();

    // La tabla tenant esta bajo RLS deny-by-default, asi que no se puede leer
    // directamente sin contexto — y el contexto es justo lo que estamos
    // resolviendo. Se usa una funcion SECURITY DEFINER de superficie minima
    // (ver migracion 20260823000002): devuelve una escuela por slug exacto y
    // nada mas. Es la unica puerta de entrada antes de tener sesion.
    const escuelas = await cliente.$queryRaw<
      Array<{ id: string; nombre: string; vertical: string; activo: boolean }>
    >`SELECT * FROM resolver_escuela_por_slug(${slug})`;

    const escuela = escuelas[0];
    // Mismo mensaje para escuela inexistente, usuario inexistente y contrasena
    // incorrecta: distinguirlos permite enumerar escuelas y cuentas validas.
    const credencialesInvalidas = new UnauthorizedException(
      'Revisa la escuela, el correo y la contrasena.',
    );
    if (!escuela || !escuela.activo) throw credencialesInvalidas;

    const usuario = await conTenant(
      escuela.id,
      (tx) => tx.usuario.findFirst({ where: { email: email.toLowerCase().trim(), activo: true } }),
      cliente,
    );
    if (!usuario) throw credencialesInvalidas;

    const coincide = await verificarHash(usuario.passwordHash, contrasena).catch(() => false);
    if (!coincide) throw credencialesInvalidas;

    return {
      token: await emitirToken({ usuarioId: usuario.id, tenantId: escuela.id, rol: usuario.rol }),
      usuario: { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol },
      escuela: { id: escuela.id, nombre: escuela.nombre, vertical: escuela.vertical },
    };
  }
}
