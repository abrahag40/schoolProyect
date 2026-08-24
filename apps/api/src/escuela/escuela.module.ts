import { Module } from '@nestjs/common';
import { ControladorEscuela } from './escuela.controller.js';

@Module({ controllers: [ControladorEscuela] })
export class ModuloEscuela {}
