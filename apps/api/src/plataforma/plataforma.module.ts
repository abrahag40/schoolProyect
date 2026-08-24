import { Module } from '@nestjs/common';
import { ControladorPlataforma } from './plataforma.controller.js';

@Module({ controllers: [ControladorPlataforma] })
export class ModuloPlataforma {}
