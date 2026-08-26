/**
 * El dia escolar en la zona horaria de LA ESCUELA.
 *
 * POR QUE VIVE AQUI Y NO EN UN MODULO DE NEGOCIO: nacio en asistencia (Sprint 3)
 * y en el Sprint 5 la necesito tambien la cobranza, para decidir si un pago
 * tiene fecha futura y si un cargo ya vencio. Dejarla en asistencia habria
 * obligado a cobranza a importar del modulo de pase de lista — un acoplamiento
 * que no describe ninguna relacion real entre los dos dominios.
 *
 * Mexico tiene varias zonas horarias (Baja California, Sonora, Quintana Roo) y
 * el servidor corre en UTC. Calcular "hoy" con la hora del servidor marcaria la
 * falta —o el vencimiento— del dia equivocado en las escuelas del noroeste.
 */
export const ZONA_POR_OMISION = 'America/Mexico_City';

export function fechaEscolar(instante: Date, zonaHoraria: string = ZONA_POR_OMISION): string {
  // 'en-CA' produce exactamente AAAA-MM-DD; es el formato ISO sin rearmar
  // partes a mano, que es donde se cuelan los ceros faltantes.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}
