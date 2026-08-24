import { Module } from '@nestjs/common';
import { ControladorAuth } from './auth.controller.js';
import { ServicioAuth } from './auth.service.js';

@Module({ controllers: [ControladorAuth], providers: [ServicioAuth] })
export class ModuloAuth {}
