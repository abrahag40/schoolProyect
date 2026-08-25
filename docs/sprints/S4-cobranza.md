# Sprint 4 — El dinero: catálogo de cargos y generación

| Campo    | Valor                                                   |
| -------- | ------------------------------------------------------- |
| Estado   | EN CURSO — aprobado por el CEO el 25-ago-2026 (gate §8) |
| Rama     | `sprint-4-cobranza`                                     |
| Vigencia | Vivo durante el sprint; se congela al cerrarlo          |

Sprint Backlog (Guía Scrum 2020) con la plantilla de 10 campos aprobada en D7.

---

## 1 · Sprint Goal

> Cada escuela define **qué cobra y a quién**, y el sistema genera los cargos del
> mes sin que nadie los teclee — con la **ventana de diez días naturales sin
> recargo** del Artículo 4 del Acuerdo de PROFECO escrita en el dominio, no en
> una casilla de configuración que cualquiera puede mover.

## 2 · Alcance seleccionado

| ID       | Elemento                                                      | MoSCoW |
| -------- | ------------------------------------------------------------- | ------ |
| AZ-DEUDA | **ESLint real en todo el monorepo** (deuda vencida del S1)    | Must   |
| AZ-M4.1  | Catálogo de cargos por escuela (pantalla 8 de la matriz D10)  | Must   |
| AZ-M4.2  | Generación de cargos del periodo, idempotente (§15)           | Must   |
| AZ-M4.3  | Reparto del cargo entre pagadores (el 60/40 del modelo S1)    | Must   |
| AZ-M4.4  | Reglas mexicanas en el dominio: Art. 4 y Art. 5-I del Acuerdo | Must   |
| AZ-M4.5  | Bandera deducible/IEDU y datos fiscales del concepto          | Should |

**Fuera de alcance, explícito:** el pago en sí (pasarela, conciliación, recibos)
y el panel de morosidad son el Sprint 5. Aquí se **genera y se reparte** lo que
se debe; cobrarlo viene después. La facturación CFDI sigue siendo cimientos.

## 3 · Cómo se hace (diseño técnico)

1. **El dinero se calcula en centavos enteros, nunca en punto flotante** (§4).
   El módulo puro `cobranza/reglas.ts` recibe y devuelve enteros; la conversión
   a `Decimal` ocurre en la frontera con la base. Esto no es purismo: `0.1 + 0.2`
   no es `0.3`, y un centavo perdido por alumno por mes es una escuela llamando
   a soporte.
2. **El reparto entre pagadores usa el método del resto mayor**, con desempate
   determinista por orden. La invariante que se prueba: la suma de las partes es
   **exactamente** el total, para cualquier combinación de porcentajes.
3. **Idempotencia por clave estable** (§15): `{alumno}:{concepto}:{periodo}`,
   con unicidad impuesta por la base. Correr la generación dos veces no duplica
   un solo cargo.
4. **Las reglas legales viven en el dominio.** `fechaLimiteSinRecargo()` nunca
   devuelve un día anterior al 10 del mes, sin importar qué configure la
   escuela. Una escuela puede adelantar su fecha de vencimiento; lo que no
   puede es cobrar recargo antes de lo que permite la ley.

## 4 · Justificación (dato duro · inferencia · estándar)

**Dato duro — normativa mexicana verificada en fuente primaria.** Acuerdo que
establece las bases mínimas de información para la comercialización de los
servicios educativos que prestan los particulares (DOF, 10-mar-1992; vigilancia
de PROFECO):

- **Artículo 4** — "Los prestadores del servicio educativo deberán aceptar **sin
  cargo alguno**, los pagos por concepto de colegiaturas dentro de los
  **primeros diez días naturales de cada mes**".
- **Artículo 5, fracción I** — los ajustes de cuotas se informan **cuando menos
  60 días antes** del periodo de reinscripción.
- **Artículo 7** — solo tres o más colegiaturas impagas liberan a la escuela de
  seguir prestando el servicio, y con 15 días de aviso previo.

**Inferencia propia, marcada como tal.** El estudio comparativo con WispHub
mostró que un motor de cobranza genérico aplica recargo a toda factura vencida,
todos los días. Una escuela puede configurarlo para respetar los diez días; lo
que no puede es impedir que un empleado nuevo o una promoción lo rompan. Por eso
aquí la ventana es una **invariante del dominio** y no un parámetro: la
configuración puede hacerla más generosa, nunca más corta.

**Estándar de industria.** El método del resto mayor para repartir importes es
la práctica estándar en sistemas de facturación y nómina; la alternativa
—redondear cada parte por separado— produce diferencias de centavos que no
cuadran contra el total. La idempotencia con clave estable en procesos de
generación masiva es el mismo patrón que ya rige nuestros avisos (ADR-010).

**Cumplimiento fiscal.** El complemento IEDU exige nombre del alumno, CURP,
nivel educativo, RVOE y RFC del pagador. Los tres últimos ya se capturan desde
S0/S1; aquí se agrega la bandera de deducibilidad y el nivel por concepto, para
que activar la facturación en R2 no obligue a recapturar nada (principio 4).

## 5 · Relación con otros sprints y módulos

| Depende de                              | Habilita                                        |
| --------------------------------------- | ----------------------------------------------- |
| S1 — `TutorAlumno` con `porcentajePago` | S5 — pago, conciliación y panel de morosidad    |
| S1 — cohorte e inscripción              | R2 — CFDI con complemento IEDU                  |
| S3 — parámetros por escuela             | AZ-A10 — el cargo es el segundo hecho analítico |

## 6 · Definition of Ready (verificada antes de arrancar)

- [x] IDs trazables (`AZ-M4.*`) — ISO/IEC/IEEE 29148.
- [x] Criterios de aceptación demostrables en una demo.
- [x] Pantalla 8 especificada en la matriz D10.
- [x] Dependencias entregadas (S1 y S3 cerrados y en `main`).
- [x] Normativa citada en fuente primaria, no en un resumen de tercero.

## 7 · Pruebas QA (§13 — tres capas por regla)

| Capa              | Qué prueba                                                                                   |
| ----------------- | -------------------------------------------------------------------------------------------- |
| **Pura**          | Reparto exacto, recargo, fechas límite y la ventana del Artículo 4                           |
| **NO-camino**     | Que NO haya recargo antes del día 10; que un ajuste con menos de 60 días de aviso se rechace |
| **Cableado real** | HTTP + Postgres: generar dos veces produce los mismos cargos                                 |
| **Aislamiento**   | Las tablas nuevas pasan el gate de `pg_class` con RLS forzado                                |
| **Invariante**    | La suma de las partes es exactamente el total, con muchos repartos                           |

## 8 · Higiene documental

`CHANGELOG.md`, `docs/decisiones.md` (§43+), `docs/adr/ADR-011` (representación
del dinero y reparto), `docs/diseno/matriz-pantallas.md` (pantalla 8),
`CLAUDE.md` y este archivo.

## 9 · Riesgos y alternativas descartadas

| Riesgo                                          | Mitigación                                                                    |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| Un centavo que no cuadra contra el total        | Invariante probada con muchos repartos, no con un ejemplo                     |
| Generación duplicada por doble clic o reintento | Unicidad en la base, no en la aplicación                                      |
| Una escuela configura recargo desde el día 1    | El dominio impone el piso legal; la configuración solo puede ser más generosa |
| Staging sigue bloqueado (5º sprint)             | `pnpm ensayo:despliegue` obligatorio al cierre (§42)                          |

**Alternativas descartadas:**

- **Guardar el dinero como `number` en JavaScript.** Descartada: el punto
  flotante no representa 0.1 exactamente. Es el defecto más caro y más difícil
  de rastrear de un sistema de cobranza, porque aparece meses después como "no
  cuadra por unos pesos".
- **Calcular el reparto al vuelo cada vez que se consulta.** Descartada: el
  porcentaje de un tutor puede cambiar (un convenio nuevo), y entonces los
  cargos históricos cambiarían de forma retroactiva. El reparto se **congela**
  al generar el cargo.
- **Un solo `estado` calculado con la fecha ("vencido").** Descartada como
  columna: el vencimiento depende de la fecha en que se pregunta. Se guarda la
  fecha límite y el estado se deriva.

## 10 · Definition of Done (3 capas)

**Capa 1 — Código.** Formato, **lint real**, tipos y build en verde; sin `any`;
el porqué en el propio archivo (§34); pipeline rojo/verde sin excepciones (§6).

**Capa 2 — Producto.** La administración define un concepto y ve los cargos
generados; el vocabulario es el de la escuela; la pantalla funciona a 360 px.

**Capa 3 — Seguridad y datos.** Tablas nuevas con RLS forzado y prueba de
aislamiento; dinero en `Decimal`; el reparto congelado; bitácora de la
generación.
