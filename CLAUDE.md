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
- **PLAN MAESTRO v1.0 — OFICIALIZADO por el CEO el 23-ago-2026. ES LA FUENTE DE LA VERDAD: https://claude.ai/code/artifact/8bab40f8-e83a-4587-8514-a8c3fa41bfc4** — Product Goal, épicas E1–E8 con triple justificación, Sprints 0–5 especificados en 10 campos + S6–S12 en resolución media (rolling-wave §19), R2/R3/cartera, DoD 3 capas, DoR, ADR-001..007, decisiones §1–§25, gobernanza, métricas y bitácora D1–D13.
  - **Regla vigente:** ningún desarrollo fuera del plan. Toda petición nueva pasa por el mecanismo de 3 salidas (entra y algo sale / se cierra el sprint / va al backlog). Callarse y ejecutar fuera del plan es la falta.
  - **Sprint 0 ACEPTADO por el CEO y commiteado** (rama `sprint-0-fundaciones`, tag `v0.1.0`). **Cambio C1 trazado en el plan v1.1** (24-ago-2026): épica E9 Plataforma ZaharDev (wizard Activate, panel de clientes, dashboard MRR, portal del socio), esquema `plataforma` + reglas BI-ready (ADR-008), nube Vercel+Render+Neon (ADR-009, runbook en docs/operacion/INFRA.md — pendiente: el CEO crea las 3 cuentas).
  - **Sprint activo: SPRINT 1 — entregado en su mayor parte** (rama `sprint-1-comunidad`, tag `v0.2.0`). Entregado: cohortes multi-vertical, personas y familias multi-pagador, roles múltiples, consentimientos por finalidad, bitácora append-only, esquema `plataforma` + guard + `GET /plataforma/panel`. **Pendiente del sprint:** pre-diseño D10 (matriz de 8 pantallas y wireframes) y despliegue a staging (bloqueado por cuentas de nube del CEO).
  - El estado real del repo se genera con `pnpm estado` (nunca se escribe a mano — §7).

## Reglas de ingeniería vigentes en este repo

Las decisiones numeradas viven en [docs/decisiones.md](docs/decisiones.md) y se citan desde el código (`§4`, `§26`…). Las de arquitectura, en [docs/adr/](docs/adr/). Las que más se pisan en el día a día:

- **§26/§28** — La app se conecta solo con el rol `azahar_app` (NOBYPASSRLS) y nadie fuera de `packages/db` construye clientes de base de datos.
- **§3** — Toda tabla de negocio nace con `tenant_id`, política RLS y prueba de aislamiento. El gate recorre `pg_class` y se pone rojo si falta alguna.
- **§13/§14** — Toda regla de negocio lleva 3 pruebas (pura, NO-camino, cableado real) y los efectos externos se prueban por el EFECTO, nunca por `ok:true`.
- **§6** — CI rojo/verde binario. Jamás `continue-on-error`.
- **§30** — El azul de marca `#04A9F5` no se usa como texto sobre claro ni como fondo de botón con texto blanco (2.63:1). Existe `primary-strong` para eso, y un test lo verifica.
- **§34** — Toda configuración no obvia lleva su porqué en el propio archivo. Antes de "limpiar" un valor raro, lee el comentario.

Puertos de este proyecto (§35): web 3010, api 3333, base de datos 5434.

## Reglas de producto ya aprobadas (no negociables sin gate)

Los 8 principios de la Definición de Producto (la familia nunca paga; cobranza es core; mobile-first familia; captura única; notificaciones inteligentes; cumplimiento mexicano nativo — LFPDPPP 2025, CFDI/IEDU, SAQ A; precios públicos; UX defensiva). Lista Won't: factoraje, IA docente, LMS completo, transporte, marketplace, hardware.

## Facturación

Proveedor por directiva del CEO: Facturama (apto con condiciones — POC sandbox pendiente; ADR-002). El core habla con el puerto `EmisorFiscal`, nunca directo con el proveedor. En MVP solo cimientos (datos maestros fiscales, bandera deducible/IEDU en catálogo de cargos).

## Mobile

Recomendación preliminar: React Native + Expo (ADR-001 pendiente de formalizar en Fase 1). Android nativo moderno = Kotlin (no Java; Google Kotlin-first desde I/O 2019).
