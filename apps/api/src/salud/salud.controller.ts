import { Controller, Get } from '@nestjs/common';
import { obtenerCliente } from '@azahar/db';

@Controller('salud')
export class ControladorSalud {
  /**
   * Sonda de salud para el orquestador.
   *
   * Consulta la base a proposito: un proceso que responde 200 sin poder leer
   * datos esta "vivo" para el balanceador y roto para el usuario. La sonda
   * debe fallar cuando el servicio no puede hacer su trabajo.
   */
  @Get()
  async revisar() {
    let baseDatos: 'ok' | 'inalcanzable' = 'ok';
    try {
      await obtenerCliente().$queryRaw`SELECT 1`;
    } catch {
      baseDatos = 'inalcanzable';
    }

    return {
      estado: baseDatos === 'ok' ? 'ok' : 'degradado',
      baseDatos,
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }
}
