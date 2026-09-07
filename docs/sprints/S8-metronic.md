# Sprint 8 — El frontend se reconstruye sobre Metronic

| Campo    | Valor                                                      |
| -------- | ---------------------------------------------------------- |
| Estado   | **CERRADO** el 6-sep-2026 · acta en `acta-cierre-S8.md`    |
| Rama     | `sprint-8-metronic`                                        |
| Origen   | **Cambios C5 y C6.** No estaba en el Plan Maestro. Ver §0. |
| Vigencia | **CONGELADO.** El estado final vive en el acta de cierre   |

---

## 0 · Por qué existe y qué lo precedió

El CEO tiene licencia **Extended** de Metronic v9.5.0 (KeenThemes), sin usar en
otro proyecto, y pidió aprovecharla. ADR-006 ya había previsto este caso con su
escape hatch; **ADR-012** lo ejecuta.

**Deuda de proceso que este sprint corrige.** Tailwind 4 y el puente de tokens
se instalaron durante el Sprint 7, **fuera de su alcance** — segunda desviación
de §8 en la misma jornada. Se declaró en el cierre y no se revirtió porque
estaba probado y en verde; revertir código que funciona para salvar la pureza
del proceso habría sido teatro. **Lo que sí se corrige es el método:** este
sprint existe para que la adopción no siga ocurriendo a pedazos.

### Cambio C6 — el alcance creció el 6-sep-2026

Al aprobar el gate, el CEO instruyó: _«barrer y borrar todo lo que tenemos de
frontend, comenzar de nuevo pero usando lo que tenemos de Metronic como
plantilla base. Metronic es la fuente base del frontend.»_

Esto **excede** el sprint original, que solo reconstruía Cobranza sobre el
`DataGrid`. Se abrió el gate de §8 **antes de codificar** —que es exactamente lo
que falló dos veces en el S7— y el CEO decidió con las cifras a la vista. Las
dos decisiones que salieron de ahí están en §1.1.

## 1 · Sprint Goal

> El frontend de Azahar se reconstruye sobre Metronic. Las pantallas se rehacen
> con sus componentes; el puente de tokens (§67) garantiza que pinten con los
> colores de Azahar sin editar un solo archivo de la plantilla; y un gate nuevo
> vigila ese puente, porque el que existe **no puede** vigilarlo.

### 1.1 · Decisiones del CEO del 6-sep-2026, con su riesgo

**D19 — El armazón se decide midiendo, no antes.** Se montan el nuestro y el de
Metronic lado a lado, se miden, y la evidencia va al siguiente gate.
_Riesgo asociado:_ retrasa el arranque del `DataGrid` y abre la posibilidad de
derogar la sección «NO se adopta su armazón» de ADR-012, aceptada un día antes.
Si gana el de Metronic, sus 5 defectos medidos —`role="content"` inválido,
parpadeo por hidratación, `setTimeout` de 1000 ms, dos `!important`, estado
global en `document.body.classList`— **se arreglan al adoptarlo**: los dos
primeros son accesibilidad, no preferencia.

**D20 — Las 22 pruebas de navegador se borran y se reescriben desde cero.**
El CEO eligió el barrido literal por encima de adaptar los selectores.
_Riesgo asociado, advertido por escrito antes de decidir:_ esas pruebas son la
única red que caza en el navegador las reglas legales ya probadas (§51, §52,
§53) y tardaron **cinco sprints** en existir — eran la deuda del Sprint 0. Una
reconstrucción puede perder una regla en silencio y no notarse hasta staging.
_Mitigación adoptada:_ **antes de borrarlas se extrajo qué afirmaban** (§7.1).
La reescritura tiene blanco; no se reescribe de memoria. El código original
queda en `v0.8.0` y en la historia de git.

## 2 · Alcance seleccionado (MoSCoW)

| ID         | Qué                                                                                                | MoSCoW   |
| ---------- | -------------------------------------------------------------------------------------------------- | -------- |
| `AZ-D2.1`  | **Probar el supuesto más riesgoso**: adoptar `Button` y **construir el gate que juzgue el puente** | **Must** |
| `AZ-D2.2`  | Regla escrita de adopción: dónde viven, cómo se nombran, qué se verifica                           | **Must** |
| `AZ-D2.3`  | **Medir los dos armazones** y decidir con evidencia (D19)                                          | **Must** |
| `AZ-D2.4`  | **El barrido**: se borra el frontend actual                                                        | **Must** |
| `AZ-D2.5`  | `DataGrid` sobre TanStack Table adoptado y adaptado                                                | **Must** |
| `AZ-D2.6`  | **Cobranza reconstruida** sobre el `DataGrid`, con las 6 columnas de §6                            | **Must** |
| `AZ-D2.7`  | Las otras 6 pantallas reconstruidas sobre Metronic                                                 | **Must** |
| `AZ-D2.8`  | **Pruebas de navegador reescritas desde cero** contra el blanco de §7.1 (D20)                      | **Must** |
| `AZ-D2.9`  | Inventario de lo adoptado, para saber qué mantenemos                                               | **Must** |
| `AZ-D2.10` | `Form` (react-hook-form) y las pantallas de captura                                                | Should   |
| `AZ-D2.11` | Sidebar plegable a riel de 80 px con expansión al pasar                                            | Should   |
| `AZ-D2.12` | Decidir qué pasa con nuestros primitivos (`Boton`, `CampoTexto`, `Insignia`)                       | Could    |

> **Sobre los identificadores.** Estos ítems nacieron como `AZ-M9.x`, que
> **colisionaba con la épica E9 «Plataforma ZaharDev»** (wizard Activate, panel
> de clientes, dashboard MRR) asignada en el cambio C1. El esquema es
> `AZ-M<épica>.<n>`, así que E9 ya estaba tomada. Se renombran a `AZ-D2.x`,
> continuando el espacio de diseño que abrió el S7 con `AZ-D1.x`.
> ISO/IEC/IEEE 29148:2018 exige identificadores únicos y trazables; la colisión
> era latente —los ítems de E9 aún no se numeran— y corregirla hoy cuesta ocho
> líneas. Aprobado por el CEO el 6-sep-2026.

### Advertencia de capacidad (sombrero PM, dicha al arrancar y no al cerrar)

Doce ítems, siete pantallas reconstruidas, un `DataGrid` de ~1,300 líneas y una
suite de navegador desde cero. **Es más de lo que un sprint ha entregado nunca
en este proyecto**: el S7 entregó 5 ítems y 2,217 líneas. La probabilidad de
entregar los doce es baja. El orden de §3 está puesto para que **lo que se
entregue sea lo que vale**, y lo que quede fuera se reporte como incumplimiento
—no se recicle en silencio (§46).

## 3 · Cómo se hace — el orden importa

**El orden NO es «lo más valioso primero». Es «lo más riesgoso primero».**

Todo el plan descansa en un supuesto: _nuestros tokens mapean limpio sobre los
nombres de variable que esperan sus componentes_. Si es falso, no sirve nada de
lo demás. Se prueba con `Button` —412 líneas— antes de tocar el `DataGrid`
—~1,300— y **antes del barrido**.

**El barrido va después de la prueba del puente, no antes.** Si el supuesto es
falso, no conviene descubrirlo parado entre los escombros. Es el mismo
Riskiest-Assumption-Test, aplicado a la demolición.

### Las tres reglas de adopción (`AZ-D2.2`)

1. **Se copia a nuestro árbol, nunca se referencia.** Van a
   `apps/web/components/ui/`. Referenciar la carpeta de la plantilla la
   convertiría en dependencia de compilación de código que no podemos publicar.
2. **Web-only, y se nota.** Tailwind no llega a React Native. Vivir en
   `apps/web` dice la verdad sobre su alcance; ponerlos en un paquete
   compartido mentiría.
3. **Frontera por idioma.** Lo adoptado conserva su nombre en inglés
   (`Button`, `DataGrid`); lo nuestro sigue en español (`Boton`, `Tarjeta`,
   `ArmazonPanel`). Al abrir un archivo se sabe de inmediato si lo mantenemos
   nosotros o si algún día habrá que diffearlo contra una versión nueva.

### Qué no cambia, pase lo que pase

- **El puente de tokens** (`apps/web/app/tailwind.css`, §67). Es el mecanismo
  que hace que Metronic pinte de Azahar. Sin él hay dos fuentes de verdad.
- **`packages/tokens`**. Una sola fuente de color para web y móvil.
- **Las reglas legales del dominio** (§51, §52, §53). Viven en el API, no en la
  pantalla — por eso el barrido del frontend no las toca. Lo que el barrido sí
  se lleva es la **verificación en navegador** de que llegan a la pantalla, y
  por eso `AZ-D2.8` es `Must` y no `Should`.

## 4 · Justificación (dato duro · inferencia · estándar)

- **Dato duro:** 78 archivos de componente, 12,166 líneas, licencia Extended
  pagada. Medido en `metronic-tailwind-react-demos/typescript/nextjs`.
- **Dato duro:** la familia `data-grid*` son 1,664 líneas (1,343 sin los dos de
  drag & drop) sobre TanStack Table, con orden, filtros, paginación y
  visibilidad de columnas.
- **Dato duro:** `button.tsx` usa 16 clases semánticas y **el puente cubre las
  16**. Verificado el 6-sep-2026.
- **Dato duro:** el frontend a barrer son 4,556 líneas en 34 archivos.
- **Inferencia (marcada como tal):** construir el `DataGrid` a mano con calidad
  equivalente costaría del orden de un sprint completo. No hay medición propia
  que lo respalde; es criterio.
- **Estándar:** _Riskiest Assumption Test_ (Bland & Osterwalder, _Testing
  Business Ideas_). ADR-012 como decisión de arquitectura registrada (Nygard).
  ISO/IEC/IEEE 29148:2018 para la trazabilidad de los IDs.

## 5 · Relación con otros sprints

- **Depende del S7**: los tokens de layout y el puente ya existen.
- **Termina `AZ-D1.6`** (jerarquía de información, parcial) y **`AZ-D1.7`**
  (densidad en tablas), que el S7 dejó abiertos.
- **Desplaza** al S9 Comunicación I y a todo lo posterior. **El MVP pasa del
  Sprint 15 al 16** — cuarto corrimiento (C2, C3, C4, C5/C6).

## 6 · Las columnas de Cobranza (`AZ-D2.6`)

Cierra el único ítem abierto de la Definition of Ready. El estudio completo se
hizo el 6-sep-2026 sobre el esquema de la BD y `pagos.service.ts:443`.

**Declaración de método, primero:** **no hay investigación primaria con personal
de cobranza escolar** — cero entrevistas, cero observación de campo. Se declara
como NO ENCONTRADO. Lo de abajo es **hipótesis con evidencia**, no hecho
validado; se valida con un director real usando la pantalla.

**La tarea que la tabla sirve** la revela el propio endpoint, que ordena por
_«más días de atraso, y a igualdad, más dinero»_: no es una tabla de consulta,
es una **cola de trabajo** — _¿a quién le hablo hoy, qué le digo, y qué puedo
hacer legalmente?_

### Visibles por defecto

| #   | Columna                | Origen                                          | Por qué                                                             |
| --- | ---------------------- | ----------------------------------------------- | ------------------------------------------------------------------- |
| 1   | **Alumno** + grado     | `Alumno` + `Inscripcion→Cohorte`                | En una escuela de 300, «González, Ana» es ambiguo sin el grado      |
| 2   | **Pagador(es)** + su % | `ParteDeCargo.tutor`, `.porcentaje`             | A quién se le habla. En un 60/40 se llama al que debe, no a los dos |
| 3   | **Saldo vencido**      | Derivado del precio **NETO** (§47)              | El dinero. `tabular-nums`, alineado a la derecha                    |
| 4   | **Días de atraso**     | `fechaLimiteSinRecargo` más antigua             | Urgencia. Es la clave de orden por defecto                          |
| 5   | **Meses vencidos**     | `situacionLegal()`, cuenta **colegiaturas** §52 | El contador del Art. 7                                              |
| 6   | **Situación legal**    | `situacion.explicacion`                         | La lectura de la ley ya hecha. Es el diferenciador del producto     |

**Las columnas 3, 4 y 5 parecen redundantes y no lo son.** Una familia puede
deber mucho dinero sin meses vencidos (un cargo grande de inscripción) o tener
3 meses vencidos con poco dinero (colegiaturas becadas). El Art. 7 se activa con
la 5; la presión de caja está en la 3. Colapsarlas repetiría el error de §52 que
ya se corrigió una vez.

### Disponibles pero ocultas (el `DataGrid` trae visibilidad de columnas)

Beca vigente · Deducible IEDU · Recargo acumulado · Último pago y fecha ·
Periodo más antiguo vencido · Pronto pago vigente.

Son contexto de **una** familia, no criterio de **priorización**; por defecto
convertirían la cola de trabajo en un volcado de la tabla. _«Periodo más antiguo
vencido»_ se expone porque §48 aplica los pagos **FIFO**: es el mes que el
siguiente peso va a saldar, y el director debería poder decirlo por teléfono.

### Lo que NO puede ser columna

**§53** — lo legalmente prohibido no se construye ni desactivado. Ninguna
columna que convierta la tabla en exhibición de morosos fuera del rol
autorizado. Hoy lo protege `exigirRolCobranza()`; la prueba de que una docente
no ve la cobranza está en el blanco de §7.1 y debe volver a existir.

### Lo que falta en el API para pintar esto

`grado/grupo` · `porcentaje` del pagador · `periodoMasAntiguoVencido` ·
`ultimoPago` · `recargo` por familia. Es trabajo real de `AZ-D2.6`, no gratis.

## 7 · Plan de QA (§13)

1. **El gate de contraste actual NO puede juzgar el puente.** Medido el
   6-sep-2026: `packages/tokens/test/contraste.test.mjs` lee **únicamente**
   `tokens/color.json` y nunca abre `tailwind.css`; `scripts/check-tokens.mjs`
   prohíbe literales, y el puente no tiene literales. Si alguien mapeara
   `--primary: var(--color-brand-primary)` (**2.63:1**), los dos gates seguirían
   verdes. Por eso `AZ-D2.1` no es «correr el gate viejo»: **es escribir uno que
   calcule el contraste del componente renderizado**, con prueba de mordida.
   Es §65 —un estándar sin gate es una intención— y es la lección #2 de la
   retro del S7: un gate que mide la capa equivocada es una garantía falsa.
2. **El puente funciona hoy por coincidencia de valores, no por construcción.**
   Metronic colapsa en un solo `--primary` lo que §30 separó en dos:
   `--texto-primario` (texto) y `--accion-fondo` (fondo). Hoy valen lo mismo
   —`#0777b6` en claro, `#04a9f5` en oscuro— pero existen separados porque
   pueden divergir. Queda escrito como supuesto vigilado.
3. **Prueba de navegador de Cobranza**: la tabla ordena, filtra y pagina contra
   datos reales, a 1440 px y a 360 px.
4. **El trinquete no sube.** Los componentes de Metronic usan clases de
   Tailwind, no estilos en línea: el número debería **bajar** al migrar.

### 7.1 · El blanco de la reescritura (D20)

Extraído de las 22 pruebas **antes** de borrarlas. La suite nueva no las copia:
tiene que volver a afirmar **esto**, con el markup que sea.

**Sesión y acceso**

- [ ] El login deja cookie `httpOnly`, `sameSite=Lax`, que JavaScript no puede leer
- [ ] Sin sesión, el panel devuelve al login en vez de mostrar datos
- [ ] Una docente no ve la cobranza **y el panel no se la ofrece**; el API responde
      «Esta sección es para administración y cobranza.»

**Las reglas legales llegan a la pantalla** (§51, §52, §53)

- [ ] La lectura del Artículo 7 se muestra: no se deja al director
- [ ] Cada concepto dice si cuenta para el Art. 7, **en positivo y en negativo**
- [ ] A un colegio se le afirma la ley («Por ley se aceptan pagos sin recargo…»)
      y **no** aparece el texto de que no lo alcanza el Acuerdo
- [ ] Una familia sin pagadores **lo dice**, en vez de dejar un hueco
- [ ] «Sin saldo a favor» se muestra explícitamente

**Layout y ancho** (§64, §66)

- [ ] Las 6 rutas del panel usan el ancho de la pantalla: ni el armazón ni la
      pantalla se ponen tope propio
- [ ] Ninguna ruta desborda horizontalmente a 360 px
- [ ] Los tres números de cobranza están arriba a 360 px
- [ ] La prosa no pasa de 80 caracteres por línea
- [ ] La navegación es directa: se cambia de sección sin volver al panel, y el
      enlace activo lleva `aria-current="page"` **en el enlace**
- [ ] A 360 px el sidebar se esconde, el menú lo trae de vuelta y Escape lo
      cierra devolviendo el foco

**Cada casilla vuelve verde con una prueba nueva, o se reporta como no
entregada.** Marcarla sin prueba sería exactamente el incumplimiento de §60.

## 8 · Riesgos y alternativas descartadas

| Riesgo / alternativa                        | Decisión                                                                                    |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| El puente de tokens no mapea limpio         | Es `AZ-D2.1` y va primero, a propósito                                                      |
| Barrer antes de probar el puente            | **Descartada.** Si el supuesto falla, se descubre entre escombros                           |
| Adoptar los 78 componentes de golpe         | **Descartada.** Cada uno es código que hay que mantener. Entra el que una pantalla necesite |
| Sustituir nuestro armazón sin medir         | **Descartada por D19:** se mide y se decide con evidencia                                   |
| Perder una regla legal en la reconstrucción | Riesgo **aceptado por el CEO** (D20), mitigado con el blanco de §7.1                        |
| Divergencia web/móvil de color              | El puente lo impide; el gate nuevo de `AZ-D2.1` lo vigila                                   |
| El sprint no cabe                           | Advertido en §2. El orden protege lo que vale; lo que falte se reporta como incumplimiento  |

## 9 · Demo de cierre

Cobranza con la tabla real: ordenar por días de atraso, filtrar por familia,
paginar. Y la **prueba de mordida del puente**: cambiar un token de color y ver
que el componente de Metronic cambia con él — y que si se mapea mal, el gate
nuevo se pone rojo.

## 10 · Definition of Done (3 capas)

1. **Código** — lint, typecheck y las pruebas en verde; el trinquete igual o
   más bajo; **cero archivos de la plantilla commiteados**; el gate nuevo del
   puente existe y muerde.
2. **Producto** — Cobranza verificada en el staging real, escritorio y 360 px.
3. **Proceso** — CHANGELOG, decisiones § nuevas, inventario de lo adoptado,
   `pnpm ensayo:despliegue` en verde, el blanco de §7.1 con cada casilla
   resuelta o declarada, y ceremonia completa con el número de pruebas **medido
   al firmar** (§7) y **sin caché de turbo** (§60).

## 11 · Definition of Ready

- [x] Licencia Extended confirmada y sin usar en otro proyecto (CEO, 5-sep-2026)
- [x] ADR-012 escrito y aceptado
- [x] Tailwind 4 y el puente de tokens instalados y en verde
- [x] La plantilla excluida de git, ESLint y Prettier
- [x] **Decidido qué columnas lleva la tabla de Cobranza** — §6, 6-sep-2026
- [x] Alcance del barrido decidido en gate (D19, D20)
