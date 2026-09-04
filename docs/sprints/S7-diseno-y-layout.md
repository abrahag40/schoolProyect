# Sprint 7 — Diseño: la capa de layout que nunca se construyó

| Campo    | Valor                                                       |
| -------- | ----------------------------------------------------------- |
| Estado   | PROPUESTO — alcance aprobado por el CEO el 4-sep-2026 (D18) |
| Rama     | `sprint-7-diseno-layout` (al arrancar)                      |
| Origen   | **Cambio C4.** No estaba en el Plan Maestro. Ver §0.        |
| Vigencia | Vivo durante el sprint; se congela al cerrarlo              |

---

## 0 · Por qué existe este sprint (cambio C4)

El 4-sep-2026, probando staging en un navegador de escritorio, el CEO observó
que la distribución del contenido no aprovecha el ancho. La medición confirmó
el síntoma y encontró una causa más profunda:

| Medición                                    | Resultado                               |
| ------------------------------------------- | --------------------------------------- |
| Anchos máximos, fijos **en línea**          | 720 · 820 · 820 · 880 · 960 (5 valores) |
| Ancho desperdiciado en un monitor de 1440px | entre **33 %** y **50 %**               |
| Estilos en línea en `apps/web/app`          | **163** en 8 archivos                   |
| Puntos de quiebre de layout                 | **0** (las 2 `@media` son a11y)         |
| Tokens de ancho/contenedor en `packages/ui` | **0**                                   |

**El diagnóstico NO es "nos pasamos de mobile-first".** Es que la capa de
layout nunca se construyó: la app dibuja una columna de ancho fijo en cualquier
viewport, y que se viera bien en un teléfono ocultó la ausencia. Mobile-first
significa _empezar_ por el móvil y crecer; aquí no se creció.

**Por qué ahora y no después.** Arreglarlo hoy son 6 pantallas. El Plan Maestro
tiene ~20 pantallas más antes del MVP: cada sprint que pasa multiplica el costo
de la migración y consolida un patrón que contradice ADR-006.

**Lo que cuesta, dicho antes de empezar:** el S8 Comunicación I corre un lugar
y con él todo lo demás. **El MVP pasa del Sprint 14 al Sprint 15.** Es el tercer
corrimiento (C2, C3, C4) y eso ya es un dato del proyecto, no un accidente.

## 1 · Sprint Goal

> En un monitor de escritorio, cada pantalla del panel usa el ancho disponible
> con una jerarquía que se lee de un vistazo; a 360 px sigue funcionando igual
> de bien. El ancho y la rejilla dejan de decidirse pantalla por pantalla y
> pasan a vivir en el sistema de diseño.

## 2 · Alcance seleccionado (MoSCoW)

| ID        | Qué                                                                                        | MoSCoW   |
| --------- | ------------------------------------------------------------------------------------------ | -------- |
| `AZ-D1.1` | Tokens de layout en `packages/ui`: anchos de contenedor, canal (gutter), puntos de quiebre | **Must** |
| `AZ-D1.2` | Componentes `Contenedor` y `Rejilla` con variantes (lectura / panel / tablero)             | **Must** |
| `AZ-D1.3` | Migrar las **6 pantallas** del panel: fuera los anchos en línea                            | **Must** |
| `AZ-D1.4` | Prueba de navegador que falla si una pantalla desperdicia el ancho a 1440 px               | **Must** |
| `AZ-D1.5` | Jerarquía de información: qué va primero y cómo se agrupa                                  | Should   |
| `AZ-D1.6` | Densidad en tablas y listas largas (cobranza, pase de lista)                               | Should   |
| `AZ-D1.7` | Revisión de `apps/mobile` contra los tokens nuevos                                         | Could    |

**El `Must` es el sistema + las 6 pantallas migradas.** Si el sprint aprieta, lo
que flexiona es `AZ-D1.5`/`AZ-D1.6`, y se dirá en el cierre — no se recicla en
silencio (§46).

> **Riesgo de alcance, declarado al aprobar (D18):** al proponer el sprint se
> advirtió que sumar jerarquía de información a la migración de 6 pantallas
> podía llenarlo. El CEO lo aprobó igual. Queda escrito para que, si no cierra,
> se sepa que era un riesgo previsto y no una sorpresa.

## 3 · Cómo se hace (diseño técnico)

1. **Los tokens primero, las pantallas después.** Un ancho es una decisión de
   sistema, no de pantalla: `--ancho-lectura`, `--ancho-panel`, `--ancho-tablero`
   con sus puntos de quiebre en `theme.css`, junto a los de color y espacio que
   ya existen.
2. **Tres contenedores, no uno.** No todas las pantallas quieren el mismo ancho:
   un formulario largo se lee mejor angosto (`lectura`), un panel de cobranza
   quiere tabla ancha (`tablero`). El error actual no es "estrecho", es "un
   número inventado por archivo".
3. **Los estilos en línea salen por migración, no por barrido.** Se migra
   pantalla por pantalla con su prueba, porque un `sed` masivo sobre 163
   ocurrencias no lo revisa nadie.
4. **`packages/ui` no importa de `apps/web`.** La dependencia va en un solo
   sentido o el sistema deja de ser sistema.

## 4 · Justificación (dato duro · inferencia · estándar)

- **Dato duro:** 163 estilos en línea, 0 puntos de quiebre, 0 tokens de ancho.
  Medido en el repo el 4-sep-2026.
- **Dato duro:** ancho desperdiciado 33–50 % a 1440 px, verificado con capturas
  del staging desplegado.
- **Inferencia (marcada como tal):** el costo de migrar crece con el número de
  pantallas; con ~20 pantallas más antes del MVP, migrar después costaría del
  orden de tres veces más. No hay medición propia que lo respalde: es criterio.
- **Estándar:** _Design Tokens_ (W3C Design Tokens Community Group) y el modelo
  de sistema de diseño que aplica ADR-006 — los valores de layout viven en el
  sistema, no en la hoja de cada pantalla. Es la misma práctica que ya se aplicó
  al color en §30 y que un test verifica.

## 5 · Relación con otros sprints

- **Desplaza al S8 Comunicación I** y a todo lo posterior (C4).
- **Habilita** todas las pantallas futuras: nacen con contenedor y rejilla en
  vez de con un número inventado.
- **No toca** dominio, dinero ni base de datos. Cero migraciones.

## 6 · Definition of Ready

- [x] El defecto está medido, no supuesto (§0)
- [x] El CEO aprobó el cambio de plan y su costo (D18)
- [x] Existe staging donde verificar en un navegador real
- [ ] Decidido qué pantalla es la referencia de cada contenedor

## 7 · Plan de QA (§13)

Una regla de layout no se prueba con tres capas como una regla de negocio, pero
tampoco vale "se ve bien":

1. **Prueba de tokens** — que los anchos y puntos de quiebre existan y sean
   coherentes (el de tablero > el de panel > el de lectura).
2. **Prueba de navegador a 1440 px** — cada pantalla del panel ocupa al menos un
   umbral del ancho disponible. **Es la que atrapa la regresión que motivó el
   sprint**, y debe fallar hoy contra el código actual (prueba de mordida).
3. **Prueba de navegador a 360 px** — no se rompe lo que ya funcionaba. La
   suite de Playwright del S5 corre a 360 px y sigue en verde.
4. **§30 sigue vigente** — el contraste no se negocia por rediseñar.

## 8 · Riesgos y alternativas descartadas

| Riesgo / alternativa                         | Decisión                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Ajustar anchos pantalla por pantalla         | **Descartada** por el CEO: multiplica los estilos en línea por 6 y deja el problema para las pantallas futuras |
| Adoptar un framework de CSS (Tailwind, etc.) | **No se evalúa en este sprint.** ADR-006 ya fijó tokens propios (D12). Cambiar eso es otro gate                |
| El sprint se llena con la jerarquía          | Declarado arriba. `Must` es sistema + migración; lo demás flexiona                                             |
| Rediseñar rompe pruebas de navegador del S5  | Se corren en cada pantalla migrada, no al final                                                                |

## 9 · Demo de cierre

Lado a lado en el staging desplegado: la misma pantalla a 1440 px antes y
después, y a 360 px antes y después. Y **la prueba de mordida**: revertir los
tokens pone roja la prueba de ancho.

## 10 · Definition of Done (3 capas)

1. **Código** — lint, typecheck y las 276+ pruebas en verde; cero anchos en
   línea en las 6 pantallas migradas.
2. **Producto** — las 6 pantallas verificadas en el staging real, en escritorio
   y a 360 px, con capturas en el acta.
3. **Proceso** — CHANGELOG, decisiones § nuevas, `pnpm ensayo:despliegue` en
   verde y ceremonia de cierre completa con el número de pruebas **medido en el
   momento de firmar** (§7, corregido tras el fallo del S6).
