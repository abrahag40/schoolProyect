# Sprint 7 — Dinero real

| Campo    | Valor                                                                |
| -------- | -------------------------------------------------------------------- |
| Estado   | PROPUESTO — **condicionado**, ver §0. Pendiente de gate del CEO      |
| Rama     | `sprint-7-dinero-real` (al arrancar)                                 |
| Origen   | Sprint 5 del Plan Maestro, movido por **C2** y renumerado por **C3** |
| Vigencia | Vivo durante el sprint; se congela al cerrarlo                       |

---

## 0 · La regla de intercambio, escrita antes de necesitarla

Este sprint **no arranca por decisión de nadie**: arranca si se cumplen tres
condiciones, y ninguna depende del equipo.

| #   | Condición                                                | Estado al 2-sep-2026 |
| --- | -------------------------------------------------------- | -------------------- |
| 1   | Las tres cuentas de nube existen y hay staging real      | **NO**               |
| 2   | ADR-007 decidido: hay proveedor de pagos elegido         | **NO**               |
| 3   | Existe la cuenta de comercio con credenciales de sandbox | **NO**               |

**Si falta cualquiera, el S7 y el S8 intercambian turno sin junta ni
discusión**: se hace Comunicación I y el dinero real espera al siguiente hueco.
La regla se escribió en la Replanificación C3 (aprobada el 26-ago-2026)
precisamente para no volver a tener la conversación de "¿lo arrancamos a
medias?" — que ya se perdió una vez y produjo el cambio C2.

**Hoy, las tres están en NO.** Por la regla, lo que procede es el intercambio.

Esto no es un reproche: es el mecanismo funcionando. Lo que costaría dinero es
arrancar el sprint igual, gastar dos tercios construyendo contra un simulador y
descubrir en el último tercio que un webhook no llega a `localhost`.

## 1 · Sprint Goal

> Un tutor paga un cargo real con tarjeta y SPEI desde el checkout alojado; el
> pago **concilia solo** contra el ledger; el panel de morosidad refleja la
> realidad al minuto; y el POC de Facturama queda veredictado.

## 2 · Alcance seleccionado

| ID       | Elemento                                                          | MoSCoW |
| -------- | ----------------------------------------------------------------- | ------ |
| AZ-M4.7  | Pago en línea (Camino A: la escuela es el comercio)               | Must   |
| AZ-M4.8  | Conciliación automática contra el ledger                          | Must   |
| AZ-M4.8b | Taxonomía de 4 niveles de referencia bancaria (escenario 13)      | Must   |
| AZ-M4.6  | Recordatorio de pago por correo (WhatsApp entra en el S9)         | Should |
| —        | POC Facturama en sandbox, timebox de 2 semanas → alimenta ADR-002 | Should |

**Fuera de alcance, explícito:** el pago in-app desde el teléfono es el S10, con
la app de familias completa. Aquí el checkout es web.

## 3 · Cómo se hace (diseño técnico)

1. **La pasarela va detrás de un adaptador `ProcesadorPagos`.** Sin él, cambiar
   de proveedor —o soportar dos a la vez, que es el caso de una escuela con
   convenio propio— sería cirugía de dominio.
2. **Azahar JAMÁS ve ni almacena números de tarjeta.** Checkout alojado más
   tokenización: alcance SAQ A, decisión regulatoria cerrada en la Fase 0.
3. **El webhook usa el patrón outbox con reintentos y cola de muertos**, igual
   que el motor de avisos (ADR-010). Un webhook perdido es un pago fantasma, y
   un pago fantasma es la clase de error que mata la confianza de una escuela
   para siempre.
4. **Un pago sin referencia NO se aplica solo.** Cae a una bandeja de
   conciliación manual con sugerencias. Es UX defensiva: aplicar dinero por
   parecido es como se contamina un ledger sin que nadie lo note.
5. **El pago en línea entra por el mismo camino que el manual** — la función de
   aplicación FIFO con pronto pago del S5/S6, sin una segunda ruta paralela.

## 4 · Justificación (dato duro · inferencia · estándar)

**Dato duro.** El hallazgo del corpus de apps de la Fase 0: el pago in-app
estable con estado de cuenta claro **no existe hoy en México**. SPEI y OXXO son
rieles que ningún competidor extranjero tiene. El caso Cometa (500 colegios,
−52 % de morosidad) se construyó sobre cobranza.

**Inferencia propia, marcada como tal.** Una escuela que ya opera con Azahar
pero cobra fuera de él mantiene dos verdades sobre el mismo dinero, y la
conciliación manual se come el ahorro que el sistema prometía. No tengo dato que
lo mida.

**Estándar.** Outbox transaccional con reintentos exponenciales y dead-letter
para eventos de pago; SAQ A para minimizar el alcance PCI; adaptador de
proveedor (patrón puerto/adaptador, Cockburn).

## 5 · Relación con otros sprints

| Depende de                                     | Habilita                                     |
| ---------------------------------------------- | -------------------------------------------- |
| S6 — cargos bien calculados (becas, prorrateo) | S9 — recordatorios que citan el importe real |
| S5 — aplicación FIFO y saldo a favor           | S10 — pago in-app sobre este mismo camino    |
| **Las tres cuentas de nube** (impedimento)     | El gate del MVP                              |

## 6 · Definition of Ready

- [x] IDs trazables (`AZ-M4.*`).
- [x] Alcance acotado y "fuera de alcance" escrito.
- [ ] **Staging real.** Sin él un webhook no llega.
- [ ] **ADR-007 decidido.**
- [ ] **Cuenta de comercio con sandbox.**

Tres de cinco sin cumplir: por la Definition of Ready, este sprint **no está
listo para arrancar**.

## 7 · Plan de QA (§13)

| Capa              | Qué prueba                                                                              |
| ----------------- | --------------------------------------------------------------------------------------- |
| **Pura**          | Conciliación por referencia; taxonomía de 4 niveles de coincidencia                     |
| **NO-camino**     | Webhook duplicado (replay), monto distinto, pago a cargo de otro tenant, fuera de orden |
| **Cableado real** | Cargo → checkout → webhook → ledger, cerrando con la invariante verificada EN LA BASE   |
| **Carga**         | k6: p95 < 1000 ms creando checkout con 200 familias concurrentes (corte de fin de mes)  |

## 8 · Riesgos

| Riesgo                                          | Mitigación                                                   |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Se arranca sin staging y se queda a medias      | La regla de intercambio del §0. No es opinión: es regla      |
| Un webhook perdido deja un pago fantasma        | Outbox + reintentos + dead-letter + alerta                   |
| Conciliación automática que aplica por parecido | Sin referencia, a bandeja manual. Nunca automático           |
| Octavo sprint sin staging                       | `pnpm ensayo:despliegue` obligatorio (§42) — no lo sustituye |

## 9 · Demo de cierre

Pago sandbox completo desde el navegador de un tutor; el webhook llega; el
ledger cuadra —mostrado con la consulta, no con una pantalla—; el panel de
morosidad se actualiza. Veredicto del POC de Facturama presentado con evidencia.

## 10 · Definition of Done (3 capas)

**Capa 1 — Código.** Lint, tipos, build y pruebas en verde; el porqué en el
propio archivo (§34); pipeline sin excepciones (§6).

**Capa 2 — Producto.** Un tutor paga desde su teléfono sin instrucciones y el
dinero aparece aplicado a su cargo.

**Capa 3 — Seguridad y datos.** Alcance SAQ A verificado (Azahar no toca PANs);
webhooks idempotentes probados con replay; invariante `I1` verde tras el flujo
completo; toda aplicación de pago con bitácora.
