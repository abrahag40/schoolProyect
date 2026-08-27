# Sprint 5 — Estado de cuenta y morosidad

| Campo    | Valor                                                             |
| -------- | ----------------------------------------------------------------- |
| Estado   | CERRADO — 27-ago-2026, tras la ampliación aprobada en el gate C3  |
| Rama     | `sprint-5-estado-de-cuenta`                                       |
| Cambio   | **C2** (sustituye al "S5: dinero real") · **C3** (ampliación D15) |
| Vigencia | Vivo durante el sprint; se congela al cerrarlo                    |

---

## 0 · Por qué este sprint no es el que decía el plan (cambio C2)

El Plan Maestro especificaba **"Cobranza II: dinero real"**: pago en línea con
pasarela, conciliación automática y POC de Facturama. Se sustituye, y la razón
queda escrita porque cambiar el plan sin trazarlo es la falta que §8 prohíbe.

El pago en línea depende de **tres cosas que hoy no existen**: la decisión de
proveedor (ADR-007 sigue abierto), una cuenta de comercio con credenciales, y
**staging** — un webhook de pago no puede llegar a `localhost`. Arrancarlo hoy
es arrancarlo para quedarnos a medias, exactamente como lleva cinco sprints
pasando con el despliegue.

**Lo que este sprint hace en su lugar** es recuperar lo que faltó del Sprint 4
—el estado de cuenta, que el plan comprometía en M4.5— y adelantar la morosidad.
Con eso, el Sprint 6 conecta la pasarela sobre una base que ya sabe qué se debe,
a quién y desde cuándo.

## 1 · Sprint Goal

> La familia abre su app y ve **exactamente lo que debe y por qué**; la escuela
> ve **quién le debe y desde cuándo** sin exportar a Excel; y un pago registrado
> a mano se aplica al pagador correcto, sin ambigüedad.

## 2 · Alcance seleccionado

| ID       | Elemento                                                           | MoSCoW |
| -------- | ------------------------------------------------------------------ | ------ |
| AZ-M4.5  | Estado de cuenta de la familia (pantalla 2 de la matriz D10)       | Must   |
| AZ-M4.8a | Panel de morosidad de la escuela (pantalla 5)                      | Must   |
| AZ-M4.9  | Registro manual de pagos, aplicado a la parte del pagador correcto | Must   |
| AZ-M4.6a | Recargo por mora, solo después de la fecha límite legal            | Should |
| AZ-DEUDA | Pruebas automatizadas en `apps/web` (Playwright)                   | Should |

**Fuera de alcance, explícito:** la pasarela de pago, la conciliación automática
por webhook y el POC de Facturama son el Sprint 6. El prorrateo, las becas y los
cargos combinables siguen pendientes del Sprint 4 y entran cuando el CEO decida
su prioridad frente a comunicación (E5).

## 3 · Cómo se hace (diseño técnico)

1. **El pago es un asiento, no una edición.** Un `Pago` se registra con su
   importe, fecha, método y referencia, y se **aplica** a una o más partes de
   cargo. El cargo nunca cambia de importe: su saldo se deriva de lo aplicado.
   Es el ledger que el Plan Maestro pide, en su forma mínima.
2. **La invariante del dinero, extendida.** Al reparto exacto del S4 se suma:
   `Σ aplicaciones ≤ importe de la parte`, y `saldo = importe − aplicado`.
   Property-based sobre secuencias de pagos parciales.
3. **El recargo respeta el Artículo 4 por construcción.** Se calcula sobre
   `fechaLimiteSinRecargo`, que ya viene congelada en cada cargo desde el S4.
   No hay forma de cobrarlo antes: el dato no lo permite.
4. **La morosidad es una proyección, no una tabla.** Quién debe, desde cuándo y
   cuánto se deriva de cargos y pagos. Guardarla como estado sería otra cosa que
   mantener sincronizada.

## 4 · Justificación (dato duro · inferencia · estándar)

**Dato duro.** El estado de cuenta confuso es queja documentada del sector en el
corpus de reseñas de Fase 0, y el panel de morosidad es la pantalla que vende:
el caso Cometa construyó 500 colegios sobre esa promesa. El Artículo 7 del
Acuerdo DOF 10-mar-1992 permite suspender el servicio solo tras **tres
colegiaturas impagas y con 15 días de aviso** — el panel debe contar meses, no
pesos, para que la escuela sepa cuándo puede actuar.

**Inferencia propia, marcada como tal.** Una escuela que migra desde Excel
registra sus pagos a mano el primer mes, aunque tenga pasarela: llegan
transferencias, efectivo en caja y depósitos. Construir primero el registro
manual no es un rodeo por no tener pasarela — es el camino que la escuela
recorre de todos modos.

**Estándar.** Ledger de partida doble simplificado: los cargos y los pagos son
asientos y el saldo se deriva. Es lo que hace cualquier sistema contable serio, y
es lo que permite responder "¿por qué debo esto?" sin adivinar.

## 5 · Relación con otros sprints

| Depende de                                 | Habilita                                            |
| ------------------------------------------ | --------------------------------------------------- |
| S4 — cargos con reparto congelado          | S6 — la pasarela aplica pagos por este mismo camino |
| S4 — `fechaLimiteSinRecargo` en cada cargo | S7 — recordatorios de cobro con la fecha real       |
| S2 — app de familias                       | S8 — pago in-app sobre este estado de cuenta        |

## 6 · Definition of Ready

- [x] IDs trazables (`AZ-M4.*`).
- [x] Pantallas 2 y 5 especificadas en la matriz D10, con wireframe.
- [x] Dependencias entregadas (S4 cerrado y en `main`).
- [x] Cambio C2 trazado y aprobado en gate.

## 7 · Pruebas QA (§13)

| Capa              | Qué prueba                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| **Pura**          | Saldo, aplicación de pagos parciales, recargo por mora                                                     |
| **NO-camino**     | No hay recargo antes de la fecha límite; no se aplica más de lo que se debe; no se paga un cargo cancelado |
| **Cableado real** | La madre ve su saldo; la escuela ve la morosidad; el pago cuadra                                           |
| **Aislamiento**   | La tabla de pagos con RLS forzado y prueba cross-tenant                                                    |
| **Invariante**    | `Σ aplicaciones ≤ importe`, y el saldo nunca es negativo                                                   |

## 8 · Higiene documental

`CHANGELOG.md`, `docs/decisiones.md`, `docs/adr/` si hay decisión estructural,
`docs/diseno/matriz-pantallas.md` (pantallas 2 y 5), `CLAUDE.md` y este archivo.

## 9 · Riesgos y alternativas descartadas

| Riesgo                                   | Mitigación                                           |
| ---------------------------------------- | ---------------------------------------------------- |
| Un pago aplicado al pagador equivocado   | El reparto congelado del S4 lo hace inequívoco       |
| Saldo que no cuadra tras pagos parciales | Invariante probada, no inspeccionada                 |
| Staging sigue bloqueado (6º sprint)      | `pnpm ensayo:despliegue` obligatorio al cierre (§42) |

**Alternativas descartadas:**

- **Guardar el saldo como columna.** Descartada: sería un dato que hay que
  mantener sincronizado con cada pago, y el día que se desincronice nadie sabrá
  cuál de los dos números es el bueno. Se deriva.
- **Permitir editar el importe de un cargo pagado.** Descartada: destruye la
  prueba de que se cobró lo que se anunció. Corregir es un asiento nuevo.

## 10 · Definition of Done (3 capas)

**Capa 1 — Código.** Formato, lint, tipos y build en verde; el porqué en el
propio archivo (§34); pipeline sin excepciones (§6).

**Capa 2 — Producto.** Un padre sin contexto responde **qué debe y por qué en
menos de 30 segundos** — criterio de aceptación literal del Plan Maestro. La
morosidad se lee de un vistazo y se opera sin exportar.

**Capa 3 — Seguridad y datos.** Tabla de pagos con RLS forzado; dinero en
`Decimal`; toda aplicación de pago con bitácora; saldo derivado, nunca guardado.
