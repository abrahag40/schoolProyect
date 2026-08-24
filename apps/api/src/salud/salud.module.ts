import { Module } from '@nestjs/common';
import { ControladorSalud } from './salud.controller.js';

@Module({ controllers: [ControladorSalud] })
export class ModuloSalud {}
