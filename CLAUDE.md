# Proyecto Azahar — ZaharDev

Plataforma SaaS multi-tenant de gestión escolar para escuelas de paga (K-12, universidades, academias deportivas, idiomas, talleres): gestión interna + comunicación escuela-familia + expediente del alumno + cobranza recurrente configurable. CEO: Abraham.

## Requisito obligatorio: justificación con evidencia (instrucción del CEO, 23-ago-2026)

Toda propuesta, recomendación, advertencia o decisión DEBE:

1. **Citar fuentes verificables** (URL, estándar, estudio, dato oficial). Ninguna cifra sin fuente. Si el dato no existe, se declara "no encontrado" — jamás se inventa.
2. **Separar explícitamente dato duro de inferencia.** Toda interpretación propia se marca como tal.
3. **Nombrar el estándar o práctica de industria que la respalda**, con el formato: "según el estándar X que aplica la consultora/empresa Y". Referencias base del proyecto:
   - Scrum Guide 2020 (Schwaber & Sutherland) — marco de trabajo; el Product Backlog ordenado + Product Goal + Definition of Done son la fuente de la verdad (plan vivo, cambios trazados).
   - ISO/IEC/IEEE 29148:2018 — ingeniería de requisitos: cada funcionalidad con ID único, verificable y trazable (formato `AZ-M#.#` core / `AZ-A#.#` add-ons).
   - MoSCoW (DSDM, Agile Business Consortium) — priorización de alcance.
   - ADRs (Nygard) + modelo C4 (Brown) — decisiones y documentación de arquitectura.
   - Discovery→Definición→Plan→Build = "Inception" (Thoughtworks) / RUP (IBM) / Cagan (SVPG).
   - Standish CHAOS Reports — el porqué del rigor: requisitos difusos = causa #1 de fracaso.
4. **Hablar desde el sombrero correspondiente** (SME Educación, PM, PO, Scrum Master, UX Research, UX/UI, Arquitecto, Dev, QA, Seguridad & Compliance, Analista de Mercado), cada uno con seniority y solo dentro de su dominio. El disenso entre sombreros se documenta, no se esconde. El CEO es sponsor: decide en gates.
5. **Registrar decisiones del CEO** en una bitácora (D1, D2, …) con fecha y riesgo asociado si aplica.
6. **Español** en todos los entregables y comunicación.

## Estado y artefactos oficiales

- Propuesta v1.0: https://claude.ai/code/artifact/72d6c38e-f66c-4487-a6f0-c7ad37105eea
- Informe de Mercado Fase 0 v1.0: https://claude.ai/code/artifact/3708d09c-be77-48be-8666-c0a3eda8a66b
- Definición de Producto v1.0 (APROBADA por el CEO): https://claude.ai/code/artifact/92db2e51-8fab-4817-a319-af7fa6ccb3b2
- Comunidad, Psicología y Gamificación v1.0 (APROBADA; define AZ-A8 y AZ-A9, doctrina "tribu sí, casino no", 11 mecánicas prohibidas para menores, 45 prácticas de Zentor/Zenix auditadas): https://claude.ai/code/artifact/571dcaff-9ecb-456b-a9c3-05a85600c69b
- Parámetros del Plan Maestro v1.0 (D7–D10 APROBADAS: plantilla de sprint de 10 campos, épica BI AZ-A10 en 3 capas, política de 3 zonas de diseño persuasivo, pre-diseño): https://claude.ai/code/artifact/c9f3abe5-f313-4b8e-bc0c-17f14d55e0da
- Marketing y Captación v1.0 (D11: módulo AZ-A11 DIFERIDO a cartera por gates, investigación documentada; D12 APROBADA: tokens propios sin comprar Light Able; D13 APROBADA: sin canal tel/SMS comercial): https://claude.ai/code/artifact/f81d59c8-880e-40a3-9002-c5e9b7c83255
- Cierre del Sprint 3 v1.0 (acta de ceremonia completa: estado medido, Review con demo, retrospectiva con incumplimientos, propuesta S4): https://claude.ai/code/artifact/53dbe651-eada-47cb-86f1-bc7c144060ac
- Estudio comparativo Azahar vs WispHub v1.0 (responde "¿por qué contratar Azahar y no wisphub.net?" con fuentes primarias; deriva un requisito para el Sprint 4: la ventana de 10 días sin recargo del Art. 4 del Acuerdo PROFECO DOF 10-mar-1992). Documento vivo en [docs/mercado/comparativa-wisphub.md](docs/mercado/comparativa-wisphub.md): https://claude.ai/code/artifact/b3d6258b-278a-4259-b2f3-28d3319ac253
- Cierre del Sprint 4 v1.0 (acta de ceremonia completa: estado medido, Review con demo del reparto 60/40 y la ventana del Art. 4, retrospectiva del defecto que solo la demo cazó, propuesta S5): https://claude.ai/code/artifact/23639a17-1f0f-4104-9334-e66441ddb48d
- **Estado del Plan Maestro v1.2** (revisión al cierre del S4: comprometido contra entregado, avance por épica, qué incluye el MVP en finanzas, cambio C2 y correcciones al plan v1.1): https://claude.ai/code/artifact/8ea2ecca-b530-45ae-b7f9-3f660dc82336
- **PLAN MAESTRO v1.0 — OFICIALIZADO por el CEO el 23-ago-2026. ES LA FUENTE DE LA VERDAD: https://claude.ai/code/artifact/8bab40f8-e83a-4587-8514-a8c3fa41bfc4** — Product Goal, épicas E1–E8 con triple justificación, Sprints 0–5 especificados en 10 campos + S6–S12 en resolución media (rolling-wave §19), R2/R3/cartera, DoD 3 capas, DoR, ADR-001..007, decisiones §1–§25, gobernanza, métricas y bitácora D1–D13.
  - **Regla vigente:** ningún desarrollo fuera del plan. Toda petición nueva pasa por el mecanismo de 3 salidas (entra y algo sale / se cierra el sprint / va al backlog). Callarse y ejecutar fuera del plan es la falta.
  - **Sprint 0 ACEPTADO por el CEO y commiteado** (rama `sprint-0-fundaciones`, tag `v0.1.0`). **Cambio C1 trazado en el plan v1.1** (24-ago-2026): épica E9 Plataforma ZaharDev (wizard Activate, panel de clientes, dashboard MRR, portal del socio), esquema `plataforma` + reglas BI-ready (ADR-008), nube Vercel+Render+Neon (ADR-009, runbook en docs/operacion/INFRA.md — pendiente: el CEO crea las 3 cuentas).
  - **Sprint 3 CERRADO con ceremonia completa** (rama `sprint-3-operacion`, tag `v0.4.0`, mergeada a `main`). Sprint Backlog en [docs/sprints/S3-operacion-diaria.md](docs/sprints/S3-operacion-diaria.md). Entregado: pase de lista móvil-primero, asignación docente↔cohorte, motor de avisos automáticos por inasistencia (ADR-010, outbox transaccional), bandeja de avisos de la familia, parámetros de asistencia por escuela, y **ensayo de despliegue** (`pnpm ensayo:despliegue`) que cazó un fallo de instalación limpia que habría tumbado el primer despliegue a la nube.
  - **Sprint 4 CERRADO con ceremonia completa** (rama `sprint-4-cobranza`, tag `v0.5.0`, mergeada a `main`). Sprint Backlog en [docs/sprints/S4-cobranza.md](docs/sprints/S4-cobranza.md). Entregado: **ESLint real (deuda de TRES sprints, pagada)**, catálogo de cargos, generación idempotente, reparto entre pagadores con invariante probada, y las reglas del Acuerdo de PROFECO (Art. 4 y Art. 5-I) escritas en el dominio (ADR-011). 145 pruebas y ensayo de despliegue superado.
  - **Sprint activo: SPRINT 5 — estado de cuenta y morosidad** (rama `sprint-5-estado-de-cuenta`, aprobado por el CEO el 25-ago-2026). Sprint Backlog en [docs/sprints/S5-estado-de-cuenta.md](docs/sprints/S5-estado-de-cuenta.md). Entregado: estado de cuenta de la familia (pantalla 2), panel de morosidad con la lectura del Art. 7 hecha (pantalla 5), registro manual de pagos con aplicación FIFO, y recargo por mora sobre la fecha legal congelada. 194 pruebas y ensayo de despliegue superado. **Deuda del S0 pagada:** la web ya tiene pruebas de extremo a extremo reales (Playwright a 360 px), tras cinco sprints de `echo`. **Pendiente:** pruebas de `apps/mobile`.
  - **Cambio C2 trazado (25-ago-2026):** el Sprint 5 del Plan Maestro era "Cobranza II: dinero real" (pago en línea + conciliación + POC Facturama). Se sustituye por estado de cuenta (M4.5, que faltó del S4) + morosidad (M4.8) + registro manual de pagos, porque el pago en línea depende de tres cosas inexistentes: decisión de proveedor (ADR-007), cuenta de comercio y staging — un webhook de pago no llega a `localhost`. **El pago en línea se mueve al Sprint 6**, condicionado a esas tres.
  - **BRECHA DE ALCANCE reconocida en la revisión v1.2:** los Sprints 3 y 4 entregaron subconjuntos de su especificación. Falta de S3: horarios y calendario (M3.2), inscripción digital web (M3.4). Falta de S4: prorrateo, cargos combinables, becas, cambio de plan, estado de cuenta (M4.5), pagos externos (M4.9), ledger append-only con invariante I1, mutation testing en dinero. A partir de ahora cada sprint se compara contra la especificación, no contra sí mismo.
  - Sprints cerrados con ceremonia completa: S0 `v0.1.0` · S1 `v0.2.0` · S2 `v0.3.0` · S3 `v0.4.0` · S4 `v0.5.0`. Ramas mergeadas a `main` al ser aceptadas.
  - **Impedimento abierto desde S0 (escalado tres veces, sigue abierto):** sin cuentas de nube no hay staging. Van 5 sprints y 8 migraciones sin desplegar. Mitigado parcialmente por el ensayo de despliegue (§42), que NO lo sustituye. Pasos en [docs/operacion/INFRA.md](docs/operacion/INFRA.md).
  - **Incumplimiento del S3, RESUELTO en el S4:** ESLint ya corre de verdad sobre todo el monorepo, con información de tipos y con §28 como regla ejecutable. Ver §46.
  - **Deuda declarada abierta:** no hay pruebas automatizadas en `apps/mobile`. Las de `apps/web` se pagaron en el S5 (Playwright). Por §46 se implementa o se difiere en gate; no se recicla.
  - **Riesgo operativo cazado en S4:** el disco de la máquina de desarrollo llegó al 100%, colgó a Docker y corrompió su almacén de imágenes. `pnpm estado` ahora reporta el espacio libre y avisa a partir del 85%.
  - El estado real del repo se genera con `pnpm estado` (nunca se escribe a mano — §7).

## Protocolo de cierre de sprint (obligatorio, instrucción del CEO 24-ago-2026)

Al terminar CADA sprint se ejecuta esta secuencia y se entrega al CEO. Ningún
sprint se da por cerrado sin ella.

**Precisión metodológica que ordena las ceremonias** (Guía Scrum 2020): el
_Daily Scrum_ es un evento **diario, dentro** del sprint, de 15 minutos y para
quienes construyen — inspecciona el avance hacia el Sprint Goal. Lo que
corresponde al **cierre** son la _Sprint Review_ (inspeccionar el incremento
con el sponsor y adaptar el backlog) y la _Retrospectiva_ (mejorar el proceso).
Aquí se hacen las tres cosas: el estado del día, la Review con el CEO y la
Retro. Llamarlo todo "daily" mezclaría eventos con propósitos distintos.

1. **Estado medido, nunca recordado** — `pnpm estado` + métricas de git
   (volumen del sprint, pruebas, deuda declarada que vencía). Los números salen
   del repo; si el documento y el código difieren, manda el código.
2. **Sprint Review con el CEO** — qué se comprometió, qué se entregó, qué NO y
   por qué. Con demo verificable, no con narración.
3. **Retrospectiva** — qué funcionó, qué falló y qué se cambia. Los defectos se
   nombran; la deuda que venció y no se pagó se reporta como incumplimiento,
   no se recicla en silencio.
4. **Cierre en git** — commit, tag SemVer, push, y merge a `main` cuando el CEO
   acepta.
5. **Documentación** — CHANGELOG (entrada del release), `CLAUDE.md` (sprint
   activo), decisiones § nuevas y ADRs si hubo decisiones estructurales.
6. **Propuesta del siguiente sprint** — Sprint Goal, alcance, y las opciones
   con su trade-off cuando alteren el orden del Plan Maestro. Cambiar el orden
   o el alcance es decisión del CEO en gate (§8), nunca del equipo.

## Reglas de ingeniería vigentes en este repo

Las decisiones numeradas viven en [docs/decisiones.md](docs/decisiones.md) y se citan desde el código (`§4`, `§26`…). Las de arquitectura, en [docs/adr/](docs/adr/). Las que más se pisan en el día a día:

- **§26/§28** — La app se conecta solo con el rol `azahar_app` (NOBYPASSRLS) y nadie fuera de `packages/db` construye clientes de base de datos.
- **§3** — Toda tabla de negocio nace con `tenant_id`, política RLS y prueba de aislamiento. El gate recorre `pg_class` y se pone rojo si falta alguna.
- **§13/§14** — Toda regla de negocio lleva 3 pruebas (pura, NO-camino, cableado real) y los efectos externos se prueban por el EFECTO, nunca por `ok:true`.
- **§6** — CI rojo/verde binario. Jamás `continue-on-error`.
- **§30** — El azul de marca `#04A9F5` no se usa como texto sobre claro ni como fondo de botón con texto blanco (2.63:1). Existe `primary-strong` para eso, y un test lo verifica.
- **§34** — Toda configuración no obvia lleva su porqué en el propio archivo. Antes de "limpiar" un valor raro, lee el comentario.
- **§41/§42** — Desarrollo usa el MISMO compilador que la imagen de producción (nada de type-stripping), y mientras no exista staging real ningún sprint cierra sin `pnpm ensayo:despliegue` en verde.
- **§43/§44** — El dinero se calcula en centavos enteros y se guarda como `Decimal`; nunca punto flotante, nunca `number` en un JSON. El reparto de un cargo se congela al generarlo (ADR-011).
- **§45** — Cuando una ley acota al negocio, el límite vive en el dominio, no en una casilla de configuración: la escuela puede ser más generosa que la ley, nunca más estricta.
- **§47/§48** — El saldo se DERIVA, nunca se guarda. Un pago es un asiento (el cargo no cambia de importe) y se aplica de lo más viejo a lo más nuevo, porque el Art. 7 cuenta meses vencidos, no pesos.
- **§49** — El `tsconfig.json` de cada paquete cubre todo su contenido (fuentes, pruebas y configuración); la compilación vive en `tsconfig.build.json`. Sin esto, `pnpm typecheck` no mira las pruebas.

Puertos de este proyecto (§35): web 3010, api 3333, base de datos 5434.

## Reglas de producto ya aprobadas (no negociables sin gate)

Los 8 principios de la Definición de Producto (la familia nunca paga; cobranza es core; mobile-first familia; captura única; notificaciones inteligentes; cumplimiento mexicano nativo — LFPDPPP 2025, CFDI/IEDU, SAQ A; precios públicos; UX defensiva). Lista Won't: factoraje, IA docente, LMS completo, transporte, marketplace, hardware.

## Facturación

Proveedor por directiva del CEO: Facturama (apto con condiciones — POC sandbox pendiente; ADR-002). El core habla con el puerto `EmisorFiscal`, nunca directo con el proveedor. En MVP solo cimientos (datos maestros fiscales, bandera deducible/IEDU en catálogo de cargos).

## Mobile

Recomendación preliminar: React Native + Expo (ADR-001 pendiente de formalizar en Fase 1). Android nativo moderno = Kotlin (no Java; Google Kotlin-first desde I/O 2019).
