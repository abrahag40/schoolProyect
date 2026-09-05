/**
 * Nota de resolucion: este paquete se publica como FUENTE y lo compila quien lo
 * consume (Next con transpilePackages). Por eso los imports van sin extension:
 * la resolucion la hace el bundler, no Node. En packages/db, que si se compila
 * a JS y corre en Node, los imports llevan .js — la diferencia es deliberada.
 */
export { Boton } from './Boton';
export type { PropsBoton } from './Boton';
export { CampoTexto } from './CampoTexto';
export type { PropsCampoTexto } from './CampoTexto';
export { Insignia } from './Insignia';
export type { PropsInsignia } from './Insignia';
export { Tarjeta } from './Tarjeta';
export type { PropsTarjeta } from './Tarjeta';
export { ArmazonPanel } from './ArmazonPanel';
export type { PropsArmazonPanel, ElementoNavegacion } from './ArmazonPanel';
export { Rejilla, Lectura } from './Rejilla';
export type { PropsRejilla, PropsLectura } from './Rejilla';
