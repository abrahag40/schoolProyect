import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { obtenerCliente } from '@azahar/db';
import { GuardSesion } from '../comun/sesion.guard.js';
import { GuardPlataforma } from '../comun/plataforma.guard.js';

interface MiembroEnPeticion {
  id: string;
  email: string;
  rol: string;
  socioId: string | null;
}

export interface ClienteResumen {
  tenantId: string;
  escuela: string;
  vertical: string;
  estado: string;
  plan: string;
  precioMensual: string;
  alumnosMaximos: number;
  modulosActivos: string[];
  cortesiaHasta: string | null;
  socio: string | null;
}

export interface PanelPlataforma {
  /// Lo que el CEO mira primero: cuanto entra al mes y como esta la cartera.
  mrr: { total: string; moneda: string; clientesActivos: number; enCortesia: number };
  clientes: ClienteResumen[];
  /// Alcance de lo que ve quien pregunta. Un socio ve SU cartera; el CEO, todo.
  alcance: 'TODA_LA_CARTERA' | 'MI_CARTERA';
}

/**
 * Consola de ZaharDev (AZ-P1.2 / AZ-P1.3, cimiento).
 *
 * Doble guard a proposito: primero hay que ser una sesion valida y ADEMAS
 * miembro de plataforma. Encadenarlos deja la intencion visible en el codigo,
 * en vez de esconder la segunda condicion dentro de la primera.
 *
 * Nota de aislamiento inverso: aqui NO se usa conTenant. Estas consultas son de
 * ZaharDev sobre sus clientes, viven en el esquema `plataforma` y por diseno no
 * llevan RLS de tenant (ADR-008). La frontera es este guard.
 */
@Controller('plataforma')
@UseGuards(GuardSesion, GuardPlataforma)
export class ControladorPlataforma {
  @Get('panel')
  async panel(@Req() peticion: { miembroPlataforma: MiembroEnPeticion }): Promise<PanelPlataforma> {
    const cliente = obtenerCliente();
    const miembro = peticion.miembroPlataforma;

    // El socio ve SOLO su cartera. No es una vista filtrada en la interfaz: la
    // consulta misma no puede alcanzar clientes de otro socio (piramide de tres
    // pisos, ADR-008).
    const esSocio = miembro.rol === 'SOCIO';
    const filtro = esSocio ? { socioId: miembro.socioId } : {};

    const clientes = await cliente.cliente.findMany({
      where: filtro,
      include: { socio: true },
      orderBy: { altaEn: 'desc' },
    });

    // El nombre de la escuela vive en el mundo operativo (public.tenant), que
    // esta bajo RLS. Se lee por la funcion de plataforma en una sola consulta
    // en lugar de N+1 lecturas con contexto.
    const nombres = await cliente.$queryRaw<
      Array<{ id: string; nombre: string; vertical: string }>
    >`
      SELECT id, nombre, vertical::text AS vertical FROM plataforma.escuelas_de_clientes()
    `;
    const porTenant = new Map(nombres.map((n) => [n.id, n]));

    const activos = clientes.filter((c) => c.estado === 'ACTIVO');
    const mrrTotal = activos.reduce((suma, c) => suma + Number(c.precioMensual), 0);

    return {
      mrr: {
        // Se serializa como cadena: el importe cruza a JavaScript y de ahi a
        // JSON, donde el numero flotante perderia centavos (§4).
        total: mrrTotal.toFixed(2),
        moneda: 'MXN',
        clientesActivos: activos.length,
        enCortesia: clientes.filter((c) => c.estado === 'CORTESIA').length,
      },
      clientes: clientes.map((c) => ({
        tenantId: c.tenantId,
        escuela: porTenant.get(c.tenantId)?.nombre ?? '(escuela sin nombre)',
        vertical: porTenant.get(c.tenantId)?.vertical ?? 'DESCONOCIDA',
        estado: c.estado,
        plan: c.plan,
        precioMensual: c.precioMensual.toFixed(2),
        alumnosMaximos: c.alumnosMaximos,
        modulosActivos: c.modulosActivos,
        cortesiaHasta: c.cortesiaHasta?.toISOString() ?? null,
        socio: c.socio?.nombre ?? null,
      })),
      alcance: esSocio ? 'MI_CARTERA' : 'TODA_LA_CARTERA',
    };
  }
}
