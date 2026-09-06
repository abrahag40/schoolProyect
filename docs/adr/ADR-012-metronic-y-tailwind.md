# ADR-012 — Adopción selectiva de Metronic sobre Tailwind 4, solo en la web

**Fecha:** 5-sep-2026 · **Estado:** aceptada por el CEO en gate

## Contexto

El CEO tiene una licencia **Extended** de **Metronic v9.5.0** (KeenThemes), sin
usar en ningún otro proyecto, y pidió aprovecharla al máximo.

ADR-006 había decidido no licenciar la plantilla de referencia y construir
componentes propios sobre tokens medidos. Esa decisión dejó escrito su propio
escape hatch:

> «Si en el futuro conviniera acelerar el back-office con código de terceros, se
> podría licenciar y usar **solo en la web**, manteniendo el móvil sobre los
> tokens. Se documentaría como ADR nuevo, con la bifurcación del sistema visual
> declarada como costo.»

Este ADR es ese documento. **No sustituye a ADR-006: ejecuta la salida que
ADR-006 previó.**

## Qué se analizó

El paquete completo: 77 componentes (12,109 líneas), 39 layouts, 5 demos, el
archivo de Figma y el CSS del armazón. Stack: Next 16.1.6, React 19.2.1,
Tailwind 4, Radix, TanStack Table — **Next y React coinciden con los nuestros**.

## Decisión

**Adopción selectiva.** Se toma la capa de componentes; **no** se toma el
armazón de layout.

### Se adopta

| Qué                                                               | Por qué                                                                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `DataGrid` sobre TanStack Table (~1,200 líneas)                   | Orden, filtros, paginación, visibilidad de columnas. Cobranza lo necesita y construirlo bien son semanas |
| `Form` (react-hook-form + zod)                                    | Ya usamos zod en el API: un solo esquema para las dos orillas                                            |
| Primitivos sobre Radix (diálogo, select, popover, sheet, command) | Accesibles por construcción, que es donde más se falla a mano                                            |
| Sidebar plegable a riel de 80 px con expansión al pasar           | Patrón que no teníamos                                                                                   |
| Tailwind 4                                                        | Requisito de lo anterior: sus componentes son utilidades de punta a punta                                |

### NO se adopta — y el porqué está medido

Su armazón de layout, porque el nuestro ya es mejor. Defectos encontrados
leyendo su código:

1. `<main role="content">` — **`content` no es un rol ARIA válido**.
2. `useIsMobile()` devuelve `false` antes de hidratar: en móvil el sidebar se
   monta y se desmonta, con parpadeo.
3. `layout-initialized` se agrega tras un **`setTimeout` de 1000 ms fijo**, para
   tapar transiciones.
4. Dos `!important` en las reglas del armazón.
5. El estado del layout vive en `document.body.classList` — estado global mutable.

El nuestro (§64, §66) tiene 22 pruebas de navegador detrás. Cambiarlo sería
retroceder. Tampoco entran los 38 layouts que no usamos ni los componentes de
marketing (`marquee`, `typing-text`, `video-text`).

## El puente: ellos ponen la estructura, nosotros el color

Sus componentes leen variables semánticas (`--primary`, `--destructive`,
`--border`) — **el mismo modelo que nuestros tokens**. `apps/web/app/tailwind.css`
las apunta a los nuestros.

Sin ese archivo, la web pintaría el azul de Metronic y el móvil el nuestro: dos
fuentes de verdad y divergencia silenciosa. Con él, no hace falta editar un solo
archivo de la plantilla.

Se conservan explícitamente las tres correcciones de ADR-006 sobre la
referencia: el color de acción con contraste suficiente (§30), el anillo de foco
(WCAG 2.2 SC 2.4.7) y una sola familia de iconos.

## Consecuencias

**A favor.** Semanas de trabajo ahorradas en tabla de datos, formularios y
primitivos accesibles. Licencia ya pagada. El stack coincide en Next y React.

**En contra.** Tailwind entra al proyecto (antes, cero). La web depende de un
tercero para su capa de componentes.

**La bifurcación, dicha con precisión.** Es menor de lo que parecía: `apps/mobile`
**nunca** consumió `packages/ui` —renderiza HTML, que en React Native no existe—,
así que la separación de componentes ya existía desde el Sprint 0. Lo único que
cambia es que la mitad web ahora lleva Tailwind. **Los tokens siguen siendo una
sola fuente para las dos plataformas**, que es lo que de verdad importaba.

## Obligaciones de la licencia

De `LICENSE-REMINDER.txt`, verbatim: _«Each Metronic license is intended for a
single use… If you're using Metronic for a SaaS service where end users are
charged, an extended license is required.»_

Azahar cobra a usuarios finales, así que la **Extended** no es opcional. El CEO
confirmó tenerla y no haberla usado en otro proyecto (5-sep-2026).

**El código de la plantilla NO se commitea.** El repositorio es público y
publicarlo sería redistribuirlo. `metronic-v9.5.0/` está en `.gitignore`, en
`.prettierignore` y en los `ignores` de ESLint — son herramientas distintas y
cada una necesitaba su exclusión. Lo que entra al repo son componentes
**copiados a nuestro árbol y adaptados**, que es uso, no redistribución.
