# ADR-013 — El armazón de layout es el de Metronic (demo1), no el nuestro

**Fecha:** 6-sep-2026 · **Estado:** aceptada por el CEO en gate (decisión D19)

## Contexto

**ADR-012 decidió lo contrario, y hace un día.** Su sección «NO se adopta» dice,
con cinco defectos medidos, que el armazón de layout de Metronic no entra y que
`ArmazonPanel` —construido en el Sprint 7, con 22 pruebas de navegador detrás—
se queda.

El 6-sep-2026 el CEO instruyó: _«barrer y borrar todo lo que tenemos de
frontend, comenzar de nuevo pero usando lo que tenemos de Metronic como
plantilla base. Metronic es la fuente base del frontend.»_ Y al elegir la
variante: _«que todo se vea exactamente como el demo 1»_.

Eso decide el armazón. Este ADR lo registra en vez de dejarlo implícito, porque
**una decisión que contradice a otra escrita tiene que decirlo en voz alta**.

## Decisión

Se adopta el armazón del **demo1** de Metronic (`app/components/layouts/demo1/`)
y se retira `ArmazonPanel`. **Deroga la sección «NO se adopta su armazón de
layout» de ADR-012.** El resto de ADR-012 —la adopción selectiva de componentes,
el puente de tokens, las obligaciones de licencia— sigue vigente sin cambios.

## Lo que NO se hereda: los cinco defectos

ADR-012 los midió leyendo su código. Adoptar el armazón los convertía en
nuestros, así que **tres se corrigen al adoptarlo** y dos se aceptan.

| #   | Defecto medido en su código                                                                                                                                                      | Qué se hizo                                                                                                                                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `<main role="content">` — `content` **no es un rol ARIA válido**, y al ponerlo `<main>` pierde su rol implícito, que es la marca para saltarse la navegación (WCAG 2.2 SC 1.3.6) | **Corregido.** Se quita el atributo                                                                                                                                        |
| 2   | `useIsMobile()` devuelve `false` antes de hidratar: en móvil el sidebar se monta y se desmonta, con parpadeo                                                                     | **Corregido.** Lo decide el CSS (`hidden lg:flex`), no JavaScript. Servidor y cliente pintan lo mismo, responde al instante al cambiar el ancho, y funciona sin JavaScript |
| 3   | `layout-initialized` se agrega tras un `setTimeout` de **1000 ms fijo**; durante ese segundo, plegar el sidebar no anima                                                         | **Corregido.** Dos `requestAnimationFrame`: se espera un frame pintado, no un número inventado                                                                             |
| 4   | Dos `!important` en las reglas del armazón                                                                                                                                       | **Aceptado.** Están en su CSS y no estorban                                                                                                                                |
| 5   | El estado del layout vive en `document.body.classList` — estado global mutable                                                                                                   | **Aceptado.** Es como funciona su CSS; cambiarlo sería reescribir el armazón, que es justo lo que esta decisión evita                                                      |

El defecto 2 **se verificó en vivo antes de corregirlo**: al ensanchar la
ventana, el sidebar no reaparecía hasta recargar. No era teoría heredada de
ADR-012; era reproducible.

## Consecuencias

**A favor.** El frontend entero se ve como el demo1, que es lo que el CEO pidió.
El riel plegable de 80 px con expansión al pasar el ratón (`AZ-D2.11`) vino
gratis con su CSS: no hubo que construirlo. Y deja de haber dos sistemas de
layout compitiendo.

**En contra, y es real.** Se retira `ArmazonPanel`, que era **mejor en
accesibilidad**: 199 líneas nuestras, sin ninguno de los cinco defectos, con 22
pruebas de navegador. De esas 22, 14 se borraron con `layout.spec.ts` porque
medían `.az-contenido`, una clase que ya no existe (decisión D20).

**Lo que se conserva de aquel trabajo** no es poco: los tokens de layout, los
puntos de quiebre de §66, y sobre todo el criterio —que el ancho lo recupera la
navegación, no un tope más grande—, que es exactamente lo que hace el demo1.

## Un detalle que costó, y que conviene no volver a pagar

El botón de plegar vive **dentro** del sidebar. Al pulsarlo el puntero se queda
encima, y la regla `.demo1.sidebar-collapse .sidebar:hover` lo devuelve a 280 px:
**se pliega, pero no se ve hasta apartar el ratón.**

Es su diseño, no un defecto nuestro, y se documenta porque durante el sprint la
conclusión fácil fue «el colapso no funciona». Lo desmintió un solo dato —
`hoverSobreSidebar: true` justo después del clic.

## Alternativas descartadas

| Alternativa                                         | Por qué no                                                                                                  |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Conservar `ArmazonPanel` y adoptar solo componentes | Es lo que decía ADR-012. El CEO decidió lo contrario con la instrucción de arriba                           |
| Adoptar su armazón **con** sus cinco defectos       | Dos son de accesibilidad. Heredar un rol ARIA inválido porque venía en la plantilla es adoptar sin criterio |
| Montar los dos y medir (D19 original)               | Lo superó la instrucción de «que se vea exactamente como el demo 1», que ya decide                          |
