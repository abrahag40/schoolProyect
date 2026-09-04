# Sprint 6 — Lo que se cobra, bien calculado

| Campo    | Valor                                                                    |
| -------- | ------------------------------------------------------------------------ |
| Estado   | CERRADO — ceremonia completa el 2-sep-2026                               |
| Rama     | `sprint-6-cobranza-configurable`                                         |
| Cambio   | **C3** — sprint insertado; el MVP pasa del S12 al S14 (decisión **D14**) |
| Vigencia | Vivo durante el sprint; se congela al cerrarlo                           |

---

## 0 · Por qué existe este sprint (cambio C3)

El Plan Maestro no tenía un Sprint 6 de cobranza: tenía _Comunicación I_. Este
sprint se **inserta**, y todo lo que venía detrás corre un lugar.

La razón no es alcance nuevo. Es que **el Sprint 4 comprometió M4.1 (planes y
prorrateo), M4.2 (cargos combinables), M4.3 (becas) y M4.4 (cambio de plan), y
entregó un subconjunto**. La revisión v1.2 lo reconoció y no lo reprogramó: un
pendiente sin sprint asignado no es un pendiente, es un olvido con buena
redacción. Aquí se le asigna sprint.

De los 24 escenarios del [catálogo de cobranza](../mercado/escenarios-cobranza.md),
este sprint mueve **seis `Must`** — y solo tres de ellos son escenarios nuevos
salidos del estudio.

### Intercambio al arrancar (§8), decidido por el CEO el 29-ago-2026

Al arrancar el sprint entró el **escenario 24** (periodicidad de cobro distinta
de la mensual, `AZ-M4.1c`), que salió de una pregunta del CEO y no de un barrido
de fuentes. El mecanismo de tres salidas obliga a que algo salga, y sale el
**mutation testing** del módulo de dinero.

**Por qué entra donde entra.** No es alcance suelto: la periodicidad toca
exactamente el mismo código que M4.1 —el enum de periodicidad, la clave del
periodo, el anclaje de la generación y el cálculo de vencimientos—. Hacerlas
juntas cuesta menos que hacerlas en dos sprints, porque el cambio de la clave de
periodo es una sola cirugía.

**Qué cuesta lo que sale, dicho sin adornos.** El mutation testing es el gate que
comprueba que las pruebas del dinero de verdad detectan cambios en la aritmética,
no solo que pasan. Diferirlo significa que el código de becas, descuentos y
prorrateo —el más delicado del producto— llega al **Sprint 13 (Hardening)** sin
esa comprobación. Se mitiga con la invariante `I1` por property-based testing,
que sí entra y que cubre la propiedad más importante (que el dinero cuadre), pero
**no la sustituye**: I1 prueba que la suma cierra, el mutation testing prueba que
las pruebas muerden. Por §46 esto queda **diferido en gate y con fecha**, no
reciclado en silencio.

## 1 · Sprint Goal

> Dos escuelas con esquemas distintos —un K-12 con becas y hermanos, una academia
> con paquetes— configuran su cobro **real**, el sistema genera el periodo con el
> prorrateo correcto, y **ningún descuento, beca ni saldo a favor se calcula
> fuera del sistema**.

## 2 · Alcance seleccionado

| ID       | Elemento                                                                 | MoSCoW |
| -------- | ------------------------------------------------------------------------ | ------ |
| AZ-M4.1  | Planes configurables y prorrateo al alta a mitad de periodo              | Must   |
| AZ-M4.1c | Periodicidad de cobro configurable: bimestral, cuatrimestral, semestral  | Must   |
| AZ-M4.3a | Becas con vigencia (desde/hasta), en porcentaje o monto fijo             | Must   |
| AZ-M4.3b | Descuento por pronto pago y por pago del periodo completo                | Must   |
| AZ-M4.2  | Guard de cuotas extraordinarias: no se generan como obligatorias         | Must   |
| AZ-A1    | RVOE por nivel educativo, no por sede (**defecto** de datos maestros)    | Must   |
| —        | Ledger con invariante `I1` (Σ cargos = Σ abonos + saldo), property-based | Must   |

**Salió del alcance al arrancar (§8):** mutation testing del módulo de dinero,
diferido al **Sprint 13 (Hardening)** con su riesgo escrito arriba.

**Fuera de alcance, explícito** —para que nadie lo dé por supuesto—: cargos
combinables completos (M4.2 más allá del guard), cambio de plan con tres opciones
(M4.4), calendario de vencimientos por programa y día inhábil (M4.11), notas de
crédito y devoluciones (M4.12). Son `Should` en el catálogo y quedan en el
backlog ordenado de E4. Y la pasarela, que es el Sprint 7.

## 3 · Cómo se hace (diseño técnico)

1. **La clave del periodo deja de ser un mes.** Hoy es `AAAA-MM` y está validada
   como mes calendario, así que un semestre no se puede expresar: `ANUAL` lo
   cobraría una vez cuando deberían ser dos, y `MENSUAL` doce. La clave pasa a
   nombrar el periodo real del plan (`2026-S1`, `2026-B3`, `2026-09`) y la
   idempotencia se mantiene sobre ella. Es la pieza que hace que una universidad
   con cuatrimestres pueda usar el sistema — y por eso va junto a M4.1 y no en
   otro sprint: son el mismo código.
2. **La beca y el descuento son asientos, no un campo en el cargo.** Igual que el
   pago (§48): el cargo conserva su importe de lista y el descuento se aplica
   encima. Sin esto no se puede auditar cuánto se becó — que es exactamente lo
   que la obligación del 5 % exige poder demostrar.
3. **La vigencia va en la beca, no en el alumno.** Una beca que expira a mitad de
   ciclo debe dejar de aplicarse sola en el siguiente periodo generado, sin que
   nadie se acuerde de quitarla.
4. **El prorrateo se congela al generar**, igual que el reparto entre pagadores
   del Sprint 4 (ADR-011). Recalcularlo después cambiaría un cargo ya comunicado
   a la familia, y con eso se pierde la prueba de que se cobró lo que se anunció.
5. **El RVOE se mueve de sede a nivel educativo.** Migración con backfill. Hoy no
   hay escuelas reales cargadas: es exactamente el momento barato de hacerlo, y
   el caro es el Release 2 con clientes dentro.
6. **El orden de aplicación se declara y se prueba:** beca → descuento → saldo a
   favor. Dos órdenes distintos dan importes distintos, y el día que difieran
   nadie sabrá cuál era el bueno.

## 4 · Justificación (dato duro · inferencia · estándar)

**Dato duro.** La beca del 5 % de la matrícula es **obligación legal** (Ley
General de Educación art. 149-III; Ley General de Educación Superior art. 70), no
un descuento comercial. El Reglamento de Pagos de la UPAEP —fuente primaria— da
por sentado el pago adelantado con descuento y las parcialidades como
alternativas de una misma inscripción. El caso Cometa (500 colegios, −52 % de
morosidad) se construyó sobre la cobranza, que es la épica más atrasada del plan.

**Inferencia propia, marcada como tal.** Una escuela sin becas configurables no
migra: mantiene su Excel en paralelo "solo para las becas", y a partir de ahí el
sistema deja de ser la fuente de la verdad. No tengo dato que lo mida; es
razonamiento.

**Estándar.** ISO/IEC/IEEE 29148:2018 para la trazabilidad de los IDs; MoSCoW
(DSDM, Agile Business Consortium) para el corte de alcance; property-based
testing sobre invariantes de dinero como práctica de la casa desde el Sprint 4.

## 5 · Relación con otros sprints

| Depende de                             | Habilita                                                 |
| -------------------------------------- | -------------------------------------------------------- |
| S4 — catálogo y generación idempotente | S7 — la conciliación aplica sobre cargos bien calculados |
| S5 — saldo a favor y aplicación FIFO   | S9 — los recordatorios citan el importe correcto         |
| S5 — marco legal por vertical (§51)    | R2-A1 — el CFDI sale con el RVOE del nivel que toca      |

## 6 · Definition of Ready

- [x] IDs trazables (`AZ-M4.*`, `AZ-A1`).
- [x] Escenarios priorizados en el catálogo vivo, con evidencia y fuente.
- [x] Dependencias entregadas (S5 cerrado y en `main`).
- [x] Cambio C3 trazado y aprobado en gate (D14).
- [ ] Pantalla 8 (catálogo) re-especificada para becas y descuentos — al arrancar.

## 7 · Plan de QA (§13)

| Capa              | Qué prueba                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Pura**          | Prorrateo con fechas límite (alta el 31, ciclos irregulares); beca en % y en monto fijo; descuento por pronto pago; beca + descuento concurrentes                       |
| **NO-camino**     | Beca > 100 %; beca vencida que sigue aplicando; dos descuentos que suman más que el cargo; cuota extraordinaria marcada como obligatoria; cargo a alumno de otro tenant |
| **Invariante**    | `I1` sobre secuencias aleatorias de cargos, becas, pagos y correcciones                                                                                                 |
| **Cableado real** | La escuela configura, genera, y la familia ve el importe con su beca aplicada **y su porqué**                                                                           |
| **Aislamiento**   | Becas y descuentos con RLS forzado y prueba cross-tenant                                                                                                                |
| **Mutación**      | Dirigido solo al módulo de dinero: un gate que no muerde es peor que no tenerlo (§46)                                                                                   |

## 8 · Riesgos y alternativas descartadas

| Riesgo                                                               | Mitigación                                                                                                       |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| El sprint se sobrecarga y entrega un subconjunto, como el S3 y el S4 | El alcance ya está cortado con MoSCoW y el "fuera de alcance" está escrito. Se mide contra el catálogo al cerrar |
| La migración del RVOE rompe datos sembrados                          | Backfill probado en el ensayo de despliegue contra base vacía **y** contra base con datos (§42)                  |
| Séptimo sprint sin staging                                           | `pnpm ensayo:despliegue` obligatorio. No lo sustituye: lo tapa                                                   |
| Disco al 97 %: Docker vuelve a colgarse y corrompe su almacén        | Ya pasó dos veces (S4 y S5). `pnpm estado` avisa desde el 85 %                                                   |

**Alternativas descartadas:**

- **Guardar el importe ya becado en el cargo.** Descartada: destruye la prueba de
  cuánto se becó, que es justo lo que la obligación legal del 5 % exige demostrar.
  El descuento es un asiento encima del importe de lista.
- **Deducir la beca del porcentaje de los pagadores.** Descartada: mezcla dos
  cosas independientes —quién paga cuánto, y cuánto se cobra— y haría imposible
  becar a un alumno con un solo pagador.

## 9 · Demo de cierre

En vivo, no narrada: se configura el esquema de un K-12 con una beca de hermanos
con vigencia y el de una academia con paquete; se da de alta un alumno a mitad de
mes y se ve el prorrateo; se genera el periodo; se muestra un estado de cuenta
con la beca aplicada **y explicada**; y se corre la invariante `I1` **contra la
base**, no contra una pantalla.

## 10 · Definition of Done (3 capas)

**Capa 1 — Código.** Formato, lint, tipos, build y pruebas en verde; el porqué en
el propio archivo (§34); pipeline sin excepciones (§6).

**Capa 2 — Producto.** Una administradora configura su esquema real sin ayuda y
sin abrir Excel.

**Capa 3 — Seguridad y datos.** Becas y descuentos con RLS forzado y prueba
cross-tenant; dinero en `Decimal` (§43); todo descuento con bitácora; invariante
`I1` verde; mutation score reportado.

**Y al cerrar:** la tabla del [catálogo de escenarios](../mercado/escenarios-cobranza.md)
actualizada, diciendo cuántos escenarios había, cuántos hay y cuáles se movieron.
