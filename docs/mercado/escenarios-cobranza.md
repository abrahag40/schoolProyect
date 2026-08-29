# Escenarios de cobranza escolar — catálogo vivo

| Campo    | Valor                                                                    |
| -------- | ------------------------------------------------------------------------ |
| Estado   | VIGENTE — aprobado por el CEO el 26-ago-2026 (decisión **D16**)          |
| Origen   | Estudio de escenarios de cobranza, 26-ago-2026                           |
| Vigencia | **Vivo.** Se actualiza cada vez que aparece un escenario nuevo           |
| Función  | Es la **vara de medición de la épica E4**, no un documento de referencia |

---

## 0 · Para qué existe este archivo

Hasta el Sprint 5 la épica de cobranza se reportaba en porcentaje —"E4 al
25 %"— sin decir contra qué. Un porcentaje sin denominador no se puede auditar:
es una sensación con formato de dato.

Este catálogo es el denominador.

> **Definition of Done de la épica E4.** E4 está terminada cuando **cada
> escenario `Must` de esta tabla está soportado, o descartado con su porqué
> escrito**. No cuando se acaben los sprints de cobranza.

Es la misma corrección que ya nos hicimos a nivel de sprint —dejar de compararnos
contra lo que propusimos esa semana y compararnos contra la especificación—
aplicada ahora a nivel de épica. Cada sprint de dinero cierra actualizando la
columna **Estado** de esta tabla y diciendo cuántos escenarios se movieron.

**Este catálogo va a crecer.** Cuando aparezca el escenario 23 se agrega una
fila y se prioriza; no se reabre el plan.

## 1 · Cómo leer la tabla

**Evidencia** — de dónde sale el escenario:

| Nivel        | Significa                                                  |
| ------------ | ---------------------------------------------------------- |
| `primaria`   | Verificado en fuente original (reglamento, ley, decreto)   |
| `proveedor`  | Documentado por quien vende el software de la competencia  |
| `secundaria` | Fuente derivada, sin verificación en el original           |
| `inferencia` | Razonamiento propio, sin evidencia documental. Marcado así |

**MoSCoW** (DSDM, Agile Business Consortium) — `Must` es condición del MVP.

**Estado** — `Soportado` · `Parcial` · `No` · `Descartado` (con porqué).

## 2 · El catálogo

| #   | Escenario                                                                          | ID         | Evidencia                          | MoSCoW | Estado                     |
| --- | ---------------------------------------------------------------------------------- | ---------- | ---------------------------------- | ------ | -------------------------- |
| 1   | El prepago se acredita contra el total; el crédito se aplica solo a cargos futuros | `AZ-M4.10` | primaria UPAEP I.2 · brightwheel   | Must   | **Soportado** (S5)         |
| 2   | Bandera por concepto: cuáles aceptan saldo a favor                                 | `AZ-M4.10` | proveedor GES                      | Must   | **Soportado** (S5)         |
| 3   | El saldo a favor no se devuelve si hay adeudo vencido                              | `AZ-M4.10` | secundaria                         | Must   | **Soportado** (S5)         |
| 4   | Advertencia fiscal: el efectivo mata la deducción                                  | `AZ-M4.5b` | primaria Decreto 2013 art. 1.9     | Must   | **Soportado** (S5)         |
| 5   | El Artículo 7 cuenta colegiaturas, no adeudos                                      | `§52`      | primaria Acuerdo 7.º               | Must   | **Soportado** (S5)         |
| 6   | El Acuerdo no aplica a educación superior ni a academias                           | `§51`      | primaria Acuerdo 1.º               | Must   | **Soportado** (S5)         |
| 7   | Responsabilidad residual del pagador; facturación dividida                         | `AZ-M4.5`  | proveedor brightwheel              | Must   | **Soportado** (S4)         |
| 8   | Pago adelantado del periodo con descuento por pronto pago                          | `AZ-M4.3b` | primaria UPAEP I.1                 | Must   | No — Sprint 6              |
| 9   | Becas con vigencia, en porcentaje o monto fijo; el 5 % legal                       | `AZ-M4.3a` | primaria LGE 149-III · LGES 70     | Must   | No — Sprint 6              |
| 10  | Prorrateo de la primera colegiatura al alta a mitad de periodo                     | `AZ-M4.1`  | plan (S4, no entregado)            | Must   | No — Sprint 6              |
| 11  | Cuotas extraordinarias: no pueden generarse como obligatorias                      | `AZ-M4.2`  | primaria Acuerdo 3.º y 5.º-III     | Must   | No — Sprint 6              |
| 12  | El RVOE va por nivel educativo, no por sede                                        | `AZ-A1`    | primaria estándar IEDU             | Must   | No — Sprint 6 (defecto)    |
| 13  | Taxonomía de 4 niveles de referencia bancaria en la conciliación                   | `AZ-M4.8`  | proveedor GES                      | Must   | No — Sprint 7 (pasarela)   |
| 14  | Sustitución de plan preguntando qué hacer con lo ya pagado (3 opciones)            | `AZ-M4.4`  | primaria UPAEP I.1 · GES           | Should | No — backlog E4            |
| 15  | Ventana de gracia distinta por programa (16 días; día 20 en Sistema Abierto)       | `AZ-M4.11` | primaria UPAEP I.6                 | Should | No — backlog E4            |
| 16  | Vencimiento en día inhábil pasa al siguiente hábil                                 | `AZ-M4.11` | primaria UPAEP I.6                 | Should | No — backlog E4            |
| 17  | Nota de crédito al cancelar un opcional; crédito ≠ devolución                      | `AZ-M4.12` | UPAEP E.3 · brightwheel · CFF 29-A | Should | No — backlog E4            |
| 18  | Devolución íntegra de inscripción si se avisa con 2 meses                          | `AZ-M4.12` | primaria Acuerdo 5.º-IV            | Should | No — backlog E4            |
| 19  | Condonación de adeudo, distinta de beca, con su aviso fiscal                       | `AZ-M4.12` | primaria LISR 142-I                | Should | No — backlog E4            |
| 20  | Multa por reinscripción extemporánea; costo por baja de materias                   | `AZ-M4.2`  | primaria UPAEP E.5–E.7             | Should | No — backlog E4            |
| 21  | Cobro prorrateado por carga: 25 % de colegiatura por materia                       | `AZ-M4.1b` | primaria UPAEP A.1                 | Could  | No — Release 2             |
| 22  | Cuatro unidades de cobro: colegiatura, crédito, unidad, materia                    | `AZ-M4.1b` | primaria UPAEP I.5                 | Could  | No — Release 2             |
| 23  | Seguro que cubre los pagos restantes si fallece el tutor                           | —          | primaria UPAEP E.1                 | Won't  | **Descartado** (ver abajo) |
| 24  | Periodicidad de cobro distinta de la mensual: bimestral, semestral, cuatrimestral  | `AZ-M4.1c` | primaria UPAEP I.1 · pregunta CEO  | Must   | No — ver abajo             |

**Marcador al 29-ago-2026: 7 de 24 soportados · 7 de 14 `Must` soportados.**

### El escenario 24, y cómo apareció

No salió de un barrido de fuentes: salió de una **pregunta del CEO el
29-ago-2026** — "una escuela puede que cobre bimestralmente o semestralmente,
¿eso ya es configurable?". La respuesta medida contra el código es **no**.

`Periodicidad` sólo admite `MENSUAL`, `UNICO` y `ANUAL`, y el periodo de cobro
es una columna `AAAA-MM` validada contra `/^\d{4}-(0[1-9]|1[0-2])$/`. Un
semestre no se puede expresar: `ANUAL` lo cobraría una vez por ciclo (serían
dos), y `MENSUAL` doce veces. La evidencia de que esto es normal ya estaba en el
estudio y no la leímos con esta pregunta en mente: el reglamento de la UPAEP
cobra por **período académico** y ofrece pagarlo completo o en parcialidades
mensuales — el periodo es el semestre, la mensualidad es sólo la forma de
pagarlo.

Es `Must` porque una universidad o una preparatoria con cuatrimestres no puede
usar el sistema sin esto, y ambos verticales están en el alcance del producto
desde la Definición de Producto.

**Queda registrado, no ejecutado.** Entrar al Sprint 6 es decisión del CEO en
gate (§8): recuperar M4.1 ya es el sprint más cargado del plan.

### Por qué el 23 es `Won't` y no "algún día"

El seguro es un producto que la escuela contrata con una aseguradora; nosotros
ni lo vendemos ni lo administramos. Lo único que el software le debe es poder
**condonar** el adeudo restante y dejar rastro, y eso ya está cubierto por
`AZ-M4.12`. Descartarlo no es ignorar el escenario: es no construir una
funcionalidad de seguros para resolver un caso que una nota de crédito resuelve.

## 3 · Reglas duras que NO son funcionalidades

Estas no entran al backlog como historias: son límites del dominio (§45) y viven
en [docs/decisiones.md](../decisiones.md).

| Regla                                                | Fuente                | Dónde vive             |
| ---------------------------------------------------- | --------------------- | ---------------------- |
| La ley se aplica por vertical                        | Acuerdo 1.º           | §51 · `marco-legal.ts` |
| El Artículo 7 cuenta colegiaturas                    | Acuerdo 7.º           | §52 · `saldos.ts`      |
| Retener documentos por adeudo es infracción          | LGE 146 y 170-XXII    | §53                    |
| Exhibir morosos viola la LFPC                        | Acuerdo 9.º           | §53                    |
| El historial de incumplimiento se purga a 72 meses   | LFPDPPP 2025 art. 10  | §54                    |
| El efectivo mata la deducción                        | Decreto 2013 art. 1.9 | `marco-legal.ts`       |
| Corregir importes es nota de crédito, no cancelación | CFF 29-A              | `AZ-M4.12`             |
| Diez días naturales sin recargo                      | Acuerdo 4.º           | §45 · `reglas.ts`      |
| Sesenta días de aviso para ajustar cuotas            | Acuerdo 5.º-I         | §45 · `reglas.ts`      |

## 4 · Tecnología descartada con evidencia (D17)

Decisión **cerrada**, no aplazada: se reabre solo con evidencia nueva. "No por
ahora" vuelve a la mesa en cada planificación y consume tiempo cada vez.

| Tecnología                                 | Por qué queda cerrada                                                                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Voicebot o agente de IA que llame a cobrar | Cobra 9 pp menos que un humano, obtiene 21 pp menos de promesas de pago y daña 1–2 pp cada uno de los 12 pagos siguientes. Con familias de 6–12 años y hermanos, es destructivo    |
| Modelo predictivo de morosidad por escuela | Una escuela de 300 alumnos genera ~240 eventos al año. La literatura exige 20–50 por variable; los estudios reales usan de 36,000 a 156,000 registros. No es difícil: no hay datos |
| Optimización de canal y horario por IA     | No existe literatura publicada que valide "la mejor hora para contactar"                                                                                                           |

**Lo que sí se adopta** (Sprint 9, `AZ-M4.6`): recordatorios automáticos,
preventivos y segmentados por historial de pago. Sin IA. Recibir el recordatorio
suma 6.7 pp; por segmento, +34 % en nuevos, +59 % en recurrentes, +22 % en
reformados. **Y se presupuesta con el número honesto:** un análisis de 126
ensayos sobre 23 millones de personas midió el efecto real en **1.4 puntos
porcentuales**, no los 8.7 de los estudios publicados — el sesgo de publicación
explica el 70 % de la diferencia.

## 5 · El hueco declarado de este catálogo

**No se barrieron quejas de usuarios en reseñas y foros.** El frente de
investigación que lo cubría se perdió por límites de la sesión.

Lo que hay aquí son escenarios que las instituciones y los proveedores
**declaran** — no lo que los usuarios **sufren**. Es una diferencia real: los 23
son un piso, no un techo, y la parte que falta es justo donde suelen aparecer los
defectos de operación diaria.

Tampoco quedó veredicto sobre conciliación bancaria automática ni sobre MCP como
integración.

Queda escrito aquí para que nadie use este catálogo como si fuera exhaustivo.

## 6 · Fuentes

- **Demanda, fuente primaria:** Reglamento de Pagos de la UPAEP — modalidades de
  pago, ventanas por programa, unidades de cobro, casos excepcionales.
- **Proveedores:** documentación pública de brightwheel; manual público de GES
  Educativo.
- **Marco legal:** Acuerdo DOF 10-mar-1992 (PROFECO) art. 1.º, 3.º, 4.º, 5.º-I,
  5.º-III, 5.º-IV, 7.º y 9.º · Ley General de Educación art. 146, 149-III y
  170-XXII · Ley General de Educación Superior art. 70 · LISR art. 142-I · CFF
  art. 29-A · Decreto de deducibilidad de colegiaturas (DOF 26-dic-2013)
  art. 1.9 · LFPDPPP 2025 art. 10.
- **Fiscal:** estándar del complemento IEDU del SAT.
- **Documento de respaldo:** estudio de escenarios de cobranza (artefacto del
  26-ago-2026), donde cada cifra de intervención lleva su fuente.
