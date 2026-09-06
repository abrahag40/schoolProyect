# Acta de cierre — Sprint 7 «Diseño: la capa de layout que nunca se construyó»

| Campo   | Valor                               |
| ------- | ----------------------------------- |
| Rama    | `sprint-7-diseno-layout`            |
| Cierre  | 6-sep-2026                          |
| Versión | `v0.8.0`                            |
| Estado  | **PENDIENTE de aceptación del CEO** |

---

## 1 · Estado medido al firmar

Corrido en el momento de escribir esta acta, no recordado de antes. Es la
corrección que salió del incumplimiento del Sprint 6 (§60), donde se declararon
270 pruebas verdes y cinco llevaban días en rojo.

| Gate                       | Resultado                                                                 |
| -------------------------- | ------------------------------------------------------------------------- |
| Pruebas del API            | **276**                                                                   |
| Aislamiento multi-tenant   | **23**                                                                    |
| Navegador (Playwright)     | **22** — eran 14                                                          |
| Tokens (contraste)         | 12                                                                        |
| Lint · typecheck           | verdes                                                                    |
| Trinquete                  | 0 contenedores con ancho propio · 226 estilos en línea · 9 medidas chicas |
| Ensayo de despliegue (§42) | ✅ **superado**, los 6 pasos                                              |

**Detalle del ensayo**, porque es el gate que casi impide este cierre: la imagen
construye, arranca contra una base **vacía**, aplica sus **13/13 migraciones**
sola, las **27 tablas de negocio** nacen con RLS habilitado y forzado, y
`azahar_app` sigue siendo `NOSUPERUSER` y `NOBYPASSRLS`.

Falló en el primer intento y el fallo era mío — ver la retrospectiva.

**Volumen:** 10 commits · 33 archivos · +2,217 / −52 · 4 decisiones nuevas.

## 2 · Sprint Review — comprometido contra entregado

| ID        | Qué                                  | Estado                          |
| --------- | ------------------------------------ | ------------------------------- |
| `AZ-D1.1` | Tokens de layout                     | ✅                              |
| `AZ-D1.2` | Componente `Sidebar`                 | ✅                              |
| `AZ-D1.3` | `Contenedor` / `Rejilla` / `Lectura` | ✅                              |
| `AZ-D1.4` | 6 pantallas migradas                 | ✅ **16 → 0 anchos a mano**     |
| `AZ-D1.5` | Prueba de navegador del ancho        | ✅ con dos mordidas verificadas |
| `AZ-D1.6` | Jerarquía de información             | 🟡 **PARCIAL — solo el Panel**  |
| `AZ-D1.7` | Densidad en tablas                   | ❌ **NO SE HIZO**               |
| `AZ-D1.8` | Revisión de `apps/mobile`            | ❌ no se hizo (era `Could`)     |

**El `Must` está completo. Los dos `Should` no**, tal como se advirtió por
escrito al ampliar el alcance con el sidebar. Se dijo antes, no al cerrar.

### La cifra del sprint

|                                        | Antes    | Después   |
| -------------------------------------- | -------- | --------- |
| Aprovechamiento del ancho a 1440 px    | **61 %** | **100 %** |
| Contenedores con ancho propio          | 16       | **0**     |
| Caracteres por línea (prosa)           | 150      | ≤ 80      |
| Huecos > 250 px entre etiqueta y valor | 5        | **0**     |

## 3 · Retrospectiva

### Lo que funcionó

**Medir la referencia antes de diseñar cambió el diseño.** La propuesta inicial
(§64) era subir el tope de ancho a 1120 px. Medir la plantilla mostró que **no
tiene un solo `max-width`** y que el ancho lo recupera un sidebar. Subir el tope
habría dejado 320 px desperdiciados igual: **el problema nunca fue el tamaño del
contenedor, era la ausencia de navegación** (§66). Veinte minutos de medición
cambiaron el sprint.

**El trinquete frenó a quien lo escribió.** Al añadir el armazón antes de migrar
las pantallas, el gate se puso rojo por +6 estilos en línea. Tenía razón.

**Ejecutar encontró lo que revisar no.** Tres defectos salieron de abrir el
navegador, no de leer código: la forma de `/mi-escuela` mal asumida,
`aria-current` en el elemento equivocado, y una medición que castigaba al
espaciado.

### Lo que falló — y es mío

**1. Dos desviaciones de §8 en la misma jornada.** El intervalo posterior al S6
(documentado, `v0.7.1`) y **Tailwind + Metronic dentro del S7, fuera de su
alcance**. Cuando el CEO pidió Tailwind, mi trabajo era abrir el mecanismo de
tres salidas _antes_ de codificar. No lo hice. Lo detectó él, no yo.

**2. Mi primera prueba de ancho no mordía.** Pasó con el defecto reintroducido a
propósito, porque medía el armazón y no el contenido de la pantalla. **Un gate
que mide la capa equivocada es una garantía falsa, peor que ninguna** (§6). Solo
se supo por hacer la prueba de mordida, que por eso es obligatoria.

**3. Declaré terminado el `Must` con el diseño roto.** La métrica marcaba 100 % y
verde mientras los párrafos iban a 150 caracteres por línea y las filas tenían
963 px de hueco. **Una métrica que mejora mientras el diseño empeora es una
advertencia sobre la métrica.** Lo detectó el CEO preguntando «¿en qué momento
vamos a rediseñar el layout?».

**4. El ensayo de despliegue quedó roto tres días sin que nadie lo notara.** Mi
guarda de §59 hace que el API se niegue a arrancar sin `NEXT_PUBLIC_WEB_ORIGIN`,
y el contenedor del ensayo nunca la recibió. **El gate hizo su trabajo**; lo que
faltó fue correrlo después de tocar el arranque.

### Lo que se cambia

- **El ensayo de despliegue se corre al tocar el arranque del API**, no solo al
  cerrar el sprint.
- **Toda petición que cambie el alcance abre el gate ANTES de codificar.** Es §8
  y ya existía; lo que faltó fue cumplirla, dos veces.
- **Ningún gate cuenta sin prueba de mordida**, y la mordida prueba el defecto
  real, no uno parecido.

## 4 · Deuda que sale de este sprint

| Deuda                              | Estado                                              |
| ---------------------------------- | --------------------------------------------------- |
| `AZ-D1.6` jerarquía en 4 pantallas | Al backlog. Cobranza la resuelve el S8              |
| `AZ-D1.7` densidad en tablas       | Al backlog — el `DataGrid` del S8 la resuelve mejor |
| Tailwind entró fuera de alcance    | Declarado. No se revierte: probado y en verde       |
| 9 medidas chicas escritas a mano   | Visible en el trinquete, sin cerrar                 |
| §61 fechas del dinero en UTC       | ABIERTA desde el intervalo del S6                   |
| `sslmode=require` en `pg@9`        | ABIERTA                                             |
| Sin pruebas en `apps/mobile`       | ABIERTA desde el S0                                 |

## 5 · Decisiones nuevas

- **§64** — El ancho y la rejilla viven en el sistema, no en cada pantalla.
- **§65** — Un estándar sin gate no es un estándar: es una intención.
- **§66** — El ancho lo recupera la navegación, no un tope más grande.
- **§67** — De Metronic se toma la estructura; el color lo pone Azahar.
- **ADR-012** — Adopción selectiva de Metronic sobre Tailwind 4, solo en la web.

## 6 · Demo

En el staging desplegado y en local: el panel a 1440 px con sidebar y contenido
fluido; a 360 px con el sidebar escondido y el menú funcionando; Escape cerrando
y devolviendo el foco. Y la mordida: reintroducir `width: 880` en una pantalla
pone la prueba en rojo con «ocupa 80 % de su área».

## 7 · Lo que sigue

**Sprint 8 — Adopción ordenada de Metronic** ([backlog](S8-metronic.md)).
Empieza probando el supuesto más riesgoso —que nuestros tokens mapean sobre sus
variables— con el componente más barato, antes de tocar el `DataGrid`.
