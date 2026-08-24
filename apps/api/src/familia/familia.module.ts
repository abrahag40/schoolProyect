import { Module } from '@nestjs/common';
import { ControladorFamilia } from './familia.controller.js';

@Module({ controllers: [ControladorFamilia] })
export class ModuloFamilia {}
