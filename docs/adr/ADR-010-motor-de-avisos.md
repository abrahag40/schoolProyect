# ADR-010 — Motor de avisos automáticos: outbox transaccional en proceso

| Estado   | Aceptado (24-ago-2026, Sprint 3)                                       |
| -------- | ---------------------------------------------------------------------- |
| Decide   | Arquitecto + Dev; veto de Seguridad si el aviso lleva datos de menores |
| Vigencia | Vivo. Se revisa con los disparadores del apartado "Cuándo cambiar"     |

## Contexto

El Sprint 3 introduce el primer efecto **automático** del producto: guardar un
pase de lista produce avisos a las familias sin que nadie los escriba. Es la
funcionalidad con mejor evidencia causal del corpus (Bergman & Chan 2021:
−27% de reprobación y +12% de asistencia; Rogers & Feller 2018: −10% o más de
ausentismo crónico), y también la primera vez que el sistema le habla al
teléfono de una persona por decisión propia.

Eso plantea un problema que no habíamos tenido: un aviso enviado **no se puede
retirar**. Si la transacción que lo originó revierte, la madre ya lo leyó.

## Opciones consideradas

**A. Enviar dentro de la transacción.** Simple de escribir. Descartada: una
llamada de red dentro de una transacción de Postgres mantiene abiertos los
bloqueos durante toda la latencia del proveedor, y si la transacción revierte
después del envío, el aviso queda en el teléfono sin respaldo en la base — el
peor de los dos mundos.

**B. Cola dedicada (Redis + BullMQ, o SQS).** Es la respuesta de manual y la que
usaríamos con volumen. Descartada **hoy**: agrega una pieza de infraestructura,
un modo de fallo nuevo (la cola caída, el trabajo huérfano) y un segundo lugar
donde mirar cuando algo no llega — para un volumen que no existe. Una escuela de
400 alumnos genera decenas de avisos al día, no decenas de miles.

**C. Outbox transaccional en proceso (elegida).** La fila del aviso se crea
**dentro** de la misma transacción que produce el hecho, con clave de
idempotencia única por `(tenant, destinatario, clave)`. El envío ocurre
**después del commit**. Si el proceso muere en medio, el aviso queda pendiente
en la tabla y sale con el siguiente despacho.

## Decisión

Se adopta **C**. Concretamente:

1. `notificacion` es a la vez outbox de envío y registro de lo comunicado.
2. La idempotencia la impone la **base** (índice único), no la aplicación: dos
   docentes guardando a la vez no pueden producir dos avisos del mismo hecho.
3. El envío es **best-effort a nivel de transporte**: si el proveedor falla, la
   petición del docente NO falla. Perder el pase de lista porque el push tuvo un
   mal minuto sería un pésimo negocio.
4. Cada despacho arrastra **todos los pendientes** del destinatario, no solo los
   del lote: es el reintento del outbox sin necesidad de un cron.
5. Un aviso que alcanza **0 dispositivos** se marca enviado con
   `dispositivos = 0`. No es un error a reintentar para siempre: es una familia
   sin la app instalada, y el aviso la espera dentro de la aplicación.

## Consecuencias

**A favor.** Cero infraestructura nueva. La garantía "no se pierde, no se
duplica" se sostiene en una restricción de la base, que es el lugar donde las
garantías sobreviven a los refactors. El registro sirve además de cimiento del
Centro de avisos (Sprint 7) y de la métrica de apertura sin trabajo extra.

**En contra, y declarado.** Con más de una instancia del API, dos despachos
concurrentes podrían enviar el mismo aviso dos veces al teléfono (la fila no se
bloquea al despachar). Hoy corre una sola instancia. **No se resuelve
prematuramente**, se anota como disparador.

## Cuándo cambiar (disparadores explícitos)

Se pasa a **B** (cola dedicada) cuando ocurra cualquiera de estos:

- Más de una instancia del API sirviendo tráfico.
- Más de ~5 000 avisos al día.
- Un canal cuyo envío tarde lo suficiente como para estorbar la petición
  (correo con adjuntos, WhatsApp con plantillas aprobadas).

Mientras tanto, la migración es barata: el punto de envío ya está aislado en un
solo método privado, y la tabla ya tiene el estado que una cola necesitaría.
