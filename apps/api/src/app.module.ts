import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FiltroValidacion } from './comun/validacion.filter.js';
import { ModuloSalud } from './salud/salud.module.js';
import { ModuloAuth } from './auth/auth.module.js';
import { ModuloEscuela } from './escuela/escuela.module.js';
import { ModuloPlataforma } from './plataforma/plataforma.module.js';
import { ModuloFamilia } from './familia/familia.module.js';
import { ModuloNotificaciones } from './notificaciones/notificaciones.module.js';
import { ModuloAsistencia } from './asistencia/asistencia.module.js';
import { ModuloCobranza } from './cobranza/cobranza.module.js';

@Module({
  // Tres mundos con fronteras distintas conviviendo en un proceso:
  //   - escuela/familia -> operacion, aislada por tenant (RLS).
  //   - plataforma      -> negocio de ZaharDev, tras su propio guard (ADR-008).
  //   - notificaciones  -> capacidad transversal con adaptador por entorno.
  imports: [
    ModuloSalud,
    ModuloAuth,
    ModuloEscuela,
    ModuloFamilia,
    ModuloPlataforma,
    ModuloNotificaciones,
    ModuloAsistencia,
    ModuloCobranza,
  ],
  providers: [
    // Registrado aqui y no en el arranque: asi tambien aplica cuando las
    // pruebas levantan la aplicacion. Un filtro que solo existe en produccion
    // hace que las pruebas verifiquen un comportamiento distinto al real.
    { provide: APP_FILTER, useClass: FiltroValidacion },
  ],
})
export class ModuloApp {}
