# Intervalo posterior al Sprint 6 — Despliegue y defectos que destapó

| Campo  | Valor                                     |
| ------ | ----------------------------------------- |
| Estado | CERRADO el 4-sep-2026, tag `v0.7.1`       |
| Rama   | `main` (sin rama de sprint — ver §1)      |
| Origen | **No estaba en el Plan Maestro.** Ver §1. |

---

## 1 · Qué fue esto, dicho sin maquillaje

**No fue un sprint.** No tuvo Sprint Goal, ni Sprint Backlog, ni timebox, ni
rama propia, ni Definition of Done revisada al terminar. Fueron 17 commits y
5,882 líneas hechos directamente sobre `main` entre el 2 y el 4 de septiembre.

Por §8 —«ningún desarrollo fuera del plan»— **esto es una desviación**, y se
registra como tal en vez de disfrazarla de "Sprint 6.5". El trabajo servía al
plan (cerraba el impedimento del S0, que el propio plan traía abierto y
escalado tres veces), pero servir al plan no es lo mismo que estar dentro de él:
un sprint es un contenedor con compromiso y revisión, y aquí no hubo ninguno.

**Lo que lo justifica parcialmente:** desplegar no era alcance opcional sino el
prerequisito que bloqueaba la regla de intercambio del S7. **Lo que no lo
justifica:** el volumen. Cinco mil líneas y cuatro decisiones nuevas (§60–§63)
son tamaño de sprint. Debió abrirse un gate al ver que el despliegue destapaba
defectos, en vez de encadenar arreglos.

## 2 · Qué se entregó

| Entregable                                       | Evidencia                                        |
| ------------------------------------------------ | ------------------------------------------------ |
| **Staging real**, extremo a extremo              | Vercel → Render → Neon, verificado               |
| Base sembrada y verificada con RLS activo        | login 200 + datos por el API                     |
| **§60** Ninguna prueba depende del calendario    | 5 pruebas estaban rojas al firmar el acta del S6 |
| **§61** Fechas del dinero en UTC (ABIERTA)       | registrada, no corregida                         |
| **§62** Cookie cross-site + defensa CSRF         | mordida: 3 pruebas caen sin ella                 |
| **§63** Cobranza deriva del neto, no de la lista | mordida: 7350.00 vs 6533.33                      |
| Copy legal corregido (`Al corriente`)            | §52 se lee, no solo se calcula                   |

## 3 · Lo que este intervalo enseñó

Los cuatro defectos comparten una forma: **ninguno era visible sin ejecutar el
sistema fuera de la máquina de desarrollo.** Dos vivían en la diferencia entre
dos entornos (cookie cross-site, CORS), uno en la diferencia entre dos fechas
(pruebas atadas al calendario) y uno en la diferencia entre dos pantallas
(lista vs neto). Ninguno lo podía atrapar una suite verde.

**Consecuencia para el proceso:** el acta del Sprint 6 declaró «270 pruebas
verdes» el 2-sep y ese número no se midió ese día. La regla §7 ya existía; lo
que faltó fue cumplirla. Desde ahora el cierre de sprint corre la suite en el
momento de firmar, y el número del acta es el de esa corrida.

## 4 · Estado medido al cerrar

- 276 pruebas del API · 23 de aislamiento · lint y typecheck en verde
- 13 migraciones aplicadas en Neon
- Volumen: 29 archivos, +5,882 / −1,845

## 5 · Deuda que sale de aquí

| Deuda                                              | Estado                    |
| -------------------------------------------------- | ------------------------- |
| §61 — fechas del dinero en UTC, no en zona escolar | ABIERTA, decisión de gate |
| `sslmode=require` dejará de verificar en `pg@9`    | ABIERTA, decisión de gate |
| Rotar 3 contraseñas expuestas en registros ajenos  | PENDIENTE del CEO         |
| Repositorio público con `docs/` dentro             | PENDIENTE del CEO         |
| Sin pruebas automatizadas en `apps/mobile`         | ABIERTA desde el S0       |
| **Sin capa de layout responsivo** (hallazgo nuevo) | ABIERTA, ver §6           |

## 6 · Hallazgo de diseño (4-sep-2026, lo levanta el CEO)

Cada pantalla del panel fija su ancho **en línea** y con un número distinto:
720, 820, 820, 880, 960. En un monitor de 1440 px eso desperdicia entre el 33 %
y el **50 %** del ancho.

Medido: **163 estilos en línea** en 8 archivos, **cero puntos de quiebre**
—las únicas dos `@media` son `prefers-color-scheme` y `prefers-reduced-motion`,
que son accesibilidad— y **ningún token de ancho, contenedor o rejilla** en
`packages/ui`.

El diagnóstico no es "nos pasamos de mobile-first": es que **la capa de layout
nunca se construyó**. La app dibuja una columna fija en cualquier viewport, y
que se viera bien en un teléfono ocultó la ausencia. Corregirlo es trabajo de
sistema de diseño (ADR-006), no de retocar pantallas una por una.
