import { Module } from '@nestjs/common';
import { ModuloSalud } from './salud/salud.module.js';
import { ModuloAuth } from './auth/auth.module.js';
import { ModuloEscuela } from './escuela/escuela.module.js';
import { ModuloPlataforma } from './plataforma/plataforma.module.js';

@Module({
  // ModuloPlataforma es el mundo de ZaharDev (C1); los demas son el de las
  // escuelas. Conviven en el mismo proceso pero no comparten frontera de
  // seguridad: ver ADR-008.
  imports: [ModuloSalud, ModuloAuth, ModuloEscuela, ModuloPlataforma],
})
export class ModuloApp {}
