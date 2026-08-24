# ADR-009 — Arquitectura de nube: Vercel + Render + Neon (patrón Zentor)

| Estado   | Aceptado (24-ago-2026, solicitado por el CEO — cambio C1 del plan) |
| -------- | ------------------------------------------------------------------ |
| Decide   | Arquitecto; el CEO aporta el precedente operativo                  |
| Vigencia | Vivo                                                               |

## Contexto

El CEO pidió sacar el sistema de localhost y evaluar si es viable replicar la
arquitectura de nube de Zentor. Se auditó el runbook de infraestructura de ese
proyecto (docs/06-operacion/INFRA.md del repo Zentor): staging **vivo desde
junio 2026** con la forma `Vercel (web) → Render (API en contenedor) → Neon
(Postgres con RLS)`.

## Veredicto de viabilidad: SÍ, con seis lecciones aplicadas

Es el caso raro donde la evidencia no es un benchmark ajeno sino **operación
propia de ZaharDev**: la misma forma corre dos productos de la casa. Los
argumentos:

1. **Misma forma técnica.** Azahar ya es Next.js (web) + NestJS en contenedor
   (API, ADR-003) + Postgres con RLS y rol restringido (ADR-004). La
   arquitectura de Zentor es exactamente ese contrato; no hay adaptación de
   fondo, solo de nombres.
2. **El requisito crítico se cumple:** el API necesita proceso de larga vida
   (crons de cobranza S4+, webhooks de pasarela S5). Render lo da; fue la misma
   razón por la que Zentor lo eligió.
3. **Neon aporta lo que el flujo de trabajo del proyecto pide:** cadenas
   pooled/directa separadas (runtime vs migraciones — encaja con nuestra
   separación de credenciales de Prisma 7) y branching de base para CI/preview.
4. **Costo de arranque: $0.** Los planes free de las tres plataformas bastan
   para staging y la beta de S12; los triggers de escalamiento quedan abajo.

**Alternativa considerada — todo-en-Vercel** (API sobre Fluid Compute, que hoy
sí corre backends completos): una plataforma menos que operar, pero (a)
contradice el supuesto de proceso persistente de ADR-003 sin necesidad, (b) el
equipo no la ha operado, y la experiencia previa ES el activo que abarata esta
decisión. Se descarta para staging/beta; queda como escape hatch.

## Las seis lecciones heredadas (pagadas por Zentor, gratis para Azahar)

1. **Workspace de Render PROPIO por producto.** Cuando Zentor y Zenix
   compartían workspace, los minutos de build compartidos se agotaron (505/500)
   y nada se desplegó durante 3 días; Render no transfiere servicios entre
   workspaces (hubo que recrear, y el subdominio viejo no se libera). Azahar
   nace en el workspace "Azahar".
2. **El owner de Neon tiene `BYPASSRLS`.** Verificado por Zentor: deja ver
   datos de otros tenants. El runtime usa el rol `azahar_app`; nuestro script
   `ensure-app-role.mjs` automatiza lo que Zentor hace a mano.
3. **`channel_binding=require` rompe al driver `pg`.** Las cadenas de Neon lo
   traen; el `docker-entrypoint.sh` lo limpia solo, en lugar de esperar que
   cada humano lo recuerde al pegar la cadena.
4. **Migrar exige la conexión directa** (sin `-pooler`): PgBouncer en modo
   transacción no soporta los locks de `prisma migrate`. El entrypoint quita el
   sufijo solo.
5. **Auto-migración antes de arrancar, fail-safe.** El deploy de código sin
   migrar el esquema tumbó una demo en vivo de Zentor. Nuestro entrypoint migra
   primero y, si falla, el proceso no arranca (rojo visible, no 500s
   silenciosos).
6. **Documentar el estado vivo ARRIBA del runbook.** Una sesión nueva de Zentor
   intentó re-desplegar desde cero lo que ya existía. Nuestro INFRA.md hereda la
   regla: el estado actual primero, los pasos después.

## Triggers de escalamiento (se decide con números, no por precaución)

- Render free duerme tras ~15 min sin tráfico (cold start ~~50 s): aceptable en
  staging; **antes del primer cliente de pago** se sube a Starter (~~$7 USD/mes).
- Neon free: suficiente hasta la beta; se revisa al superar sus límites de
  cómputo/almacenamiento con las escuelas beta reales.
- Dominio propio: compra del CEO (marca + tarjeta), no de ingeniería. Se vuelve
  necesario cuando el correo transaccional entre (S6-S7 — los proveedores
  exigen dominio verificado).

## Consecuencias

Infra declarada en el repo (`render.yaml`, `apps/api/Dockerfile`,
`docker-entrypoint.sh`, `apps/web/vercel.json`) y un runbook con los pasos que
solo el CEO puede ejecutar (crear cuentas). Tres plataformas que operar; se
acepta porque son las tres que la organización ya opera.
