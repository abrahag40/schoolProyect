# ADR-008 — Esquema `plataforma` separado y diseño de datos BI-ready

| Estado   | Aceptado (24-ago-2026, cambio C1 — implementación arranca en Sprint 1) |
| -------- | ---------------------------------------------------------------------- |
| Decide   | Arquitecto + Analista BI; veto de Seguridad si toca datos de alumnos   |
| Vigencia | Vivo                                                                   |

## Contexto

El CEO pidió (a) un panel de venta/configuración rápida y un panel de
administración de los clientes de ZaharDev, y (b) que la arquitectura de base de
datos nazca segmentada y orientada a análisis de datos según las prácticas de
BI. Ambas cosas convergen en la misma decisión de datos.

Hoy el esquema `public` mezcla dos mundos: la tabla `tenant` es a la vez "la
escuela como espacio aislado" (operación) y "la escuela como cliente de
ZaharDev" (negocio nuestro). Eso funciona en el Sprint 0 y estorba después: los
datos comerciales de ZaharDev (suscripciones, precios negociados, cartera de
vendedores, salud de cuenta) no pertenecen a ningún tenant y no deben vivir
bajo su RLS.

El precedente interno existe: la **Consola de plataforma de Zentor**
(`/plataforma`, protegida en el servidor por un procedure exclusivo) y su
**portal del socio** (`/socio`: el vendedor ve SOLO su cartera y provisiona con
el mismo wizard) — la "pirámide de tres pisos" CEO → socio → cliente que el CEO
quiere replicar.

## Decisión 1 — Dos esquemas, dos fronteras de seguridad

- **`public`** (existente): datos operativos de las escuelas. RLS forzado por
  tenant, rol `azahar_app`, como hasta hoy. Nada cambia.
- **`plataforma`** (nuevo, Sprint 1): datos de ZaharDev sobre sus clientes —
  cuenta, suscripción/plan, precio, módulos activos, estado (activa, cortesía,
  suspendida), cartera de socios/vendedores, eventos de provisión. **Sin RLS de
  tenant** (su dueño es ZaharDev, no una escuela) pero con su propia frontera:
  un guard de plataforma en el API (patrón `plataformaProcedure` de Zentor,
  traducido a NestJS) y un rol de membresía explícito. La cuenta demo JAMÁS es
  de plataforma (bug real cazado en Zentor: la demo compartible abría la
  consola cross-tenant).

La relación entre mundos es una sola llave: `plataforma.cliente.tenant_id →
public.tenant.id`. La operación no lee `plataforma`; la consola no escribe
`public` salvo vía el servicio de provisión.

## Decisión 2 — Reglas de datos BI-ready (vigentes desde ya)

El objetivo del CEO — que la base nazca apuntando al análisis — no se logra con
una herramienta sino con disciplina de modelado. Reglas, con su referencia:

1. **Hechos como eventos append-only.** Ledger de cobranza (§4), asistencia
   (§12), telemetría (A10.1) y eventos de provisión no se editan: se acumulan.
   Un hecho inmutable con fecha es exactamente lo que una tabla de hechos
   necesita (modelado dimensional de Kimball; los eventos son la materia prima
   del "bronze" en la arquitectura medallion).
2. **Todo evento lleva las cuatro coordenadas:** `tenant_id`, actor (quién),
   `timestamptz` UTC (cuándo, con zona explícita) y tipo estable (qué). Sin
   estas cuatro, el análisis por cohortes/escuela/tiempo se vuelve arqueología.
3. **Dimensiones con claves estables y catálogos versionados.** Los enums
   (Vertical, Rol, estados de suscripción) no se renombran: se agregan valores.
   Renombrar un valor rompe todo histórico que lo referencia.
4. **Los hechos consultables no viven en JSON.** JSON es aceptable para carga
   útil accesoria; lo que se va a agregar/filtrar/graficar es columna tipada.
5. **La analítica jamás corre sobre el primario OLTP.** En cuanto haya carga
   real, las lecturas analíticas van a una réplica de lectura (Neon las ofrece)
   y, cuando el volumen lo amerite, a un almacén ELT aparte. El gate para
   invertir en warehouse es de volumen, no de moda.
6. **Diccionario de datos vivo:** cada tabla nueva registra qué significa cada
   columna analíticamente relevante (unidad, zona horaria, nulabilidad
   semántica). Es la diferencia entre "tenemos datos" y "podemos responder
   preguntas".

Estas reglas ya se cumplen parcialmente por diseño previo (ledger, asistencia,
consentimientos con evidencia); este ADR las vuelve obligatorias para todo lo
nuevo.

## Consecuencias

- Sprint 1 crea el esquema `plataforma` con sus tablas mínimas y el guard: es
  el cimiento; **el panel visible llega en su sprint del plan (C1)**, no antes.
- El wizard de venta (Azahar Activate: Escuela → Plan y módulos → Cobro →
  Usuarios → Confirmar, adaptación del "Zentor Activate" de 5 pasos) y el
  drill-in de cliente (toggles de módulos, cortesías +7/+15/+30,
  suspender/reactivar, todo auditado) se especifican sobre estas tablas.
- El dashboard ejecutivo (MRR, estados, adopción — la materialización de
  A10.2) se construye leyendo `plataforma` + agregados de eventos, sin tocar
  datos personales de alumnos: BI de negocio, no de menores (línea ya aprobada).

## Escape hatch

Si el esquema separado resultara insuficiente (p. ej. compliance exigiera
aislamiento físico de lo comercial), `plataforma` puede migrar a su propia base
sin tocar `public`: la única costura es la llave `tenant_id`, y es
unidireccional a propósito.
