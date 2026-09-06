import {
  Banknote,
  ClipboardCheck,
  GraduationCap,
  LayoutGrid,
  ReceiptText,
  School,
} from 'lucide-react';
import { type MenuConfig } from './types';

/**
 * EL MENU DE AZAHAR (AZ-D2.7).
 *
 * SUSTITUYE al de Metronic, que eran 1,564 lineas de navegacion de sus demos
 * —perfiles publicos, NFT, tienda, blogger—. La estructura de datos y el
 * componente que la pinta son suyos y no se tocan; el CONTENIDO es nuestro.
 * Esa es exactamente la frontera que ADR-012 describe: ellos ponen la
 * estructura, nosotros lo que va dentro.
 *
 * ORDEN DELIBERADO. Cobranza va primero de las secciones de trabajo porque es
 * el core del producto (principio 2 de la Definicion de Producto: «cobranza es
 * core, no un modulo»), no por orden alfabetico ni por antiguedad del sprint.
 *
 * SIN NIVELES QUE NO EXISTEN. El componente soporta submenus de tres niveles;
 * Azahar tiene seis pantallas. Anidarlas para "aprovechar" el componente
 * agregaria un clic a todo lo que hoy esta a uno.
 */
export const MENU_SIDEBAR: MenuConfig = [
  {
    title: 'Panel',
    icon: LayoutGrid,
    path: '/panel',
  },
  { heading: 'Cobranza' },
  {
    title: 'Cobranza',
    icon: Banknote,
    path: '/panel/morosidad',
  },
  {
    title: 'Catálogo de cargos',
    icon: ReceiptText,
    path: '/panel/catalogo',
  },
  {
    title: 'Becas',
    icon: GraduationCap,
    path: '/panel/becas',
  },
  { heading: 'Operación' },
  {
    title: 'Pase de lista',
    icon: ClipboardCheck,
    path: '/panel/pase-lista',
  },
  {
    title: 'Mi escuela',
    icon: School,
    path: '/panel/escuela',
  },
];

/**
 * El menu raiz que su `SidebarHeader` usa para el selector de la esquina.
 * Azahar no tiene "aplicaciones" que elegir: una escuela, un panel.
 */
export const MENU_ROOT: MenuConfig = [
  {
    title: 'Azahar',
    icon: School,
    rootPath: '/panel',
    path: '/panel',
  },
];
