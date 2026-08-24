import { Module } from '@nestjs/common';
import { ModuloSalud } from './salud/salud.module.js';
import { ModuloAuth } from './auth/auth.module.js';
import { ModuloEscuela } from './escuela/escuela.module.js';

@Module({
  imports: [ModuloSalud, ModuloAuth, ModuloEscuela],
})
export class ModuloApp {}
