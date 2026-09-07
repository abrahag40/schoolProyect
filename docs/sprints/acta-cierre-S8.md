# Acta de cierre — Sprint 8 «El frontend se reconstruye sobre Metronic»

| Campo   | Valor                               |
| ------- | ----------------------------------- |
| Rama    | `sprint-8-metronic`                 |
| Cierre  | 6-sep-2026                          |
| Versión | `v0.9.0`                            |
| Estado  | **PENDIENTE de aceptación del CEO** |

---

## 1 · Estado medido al firmar

Corrido en el momento de escribir esta acta y **con la caché de turbo
desactivada** (`--force`). Es la corrección que salió del incumplimiento del
Sprint 6 (§60), donde se declararon 270 pruebas verdes y cinco llevaban días en
rojo — y de haber visto en este mismo sprint que `pnpm test` puede reportar
`6 cached, 6 total` y no ejecutar nada.

| Gate                       | Resultado                                                         |
| -------------------------- | ----------------------------------------------------------------- |
| Pruebas del API            | **276**                                                           |
| Aislamiento multi-tenant   | **23**                                                            |
| Navegador (Playwright)     | **25** — eran 22, y 14 de aquellas se borraron                    |
| Tokens (contraste)         | **16** — eran 12                                                  |
| Lint · typecheck · formato | verdes                                                            |
| Trinquete                  | **69** estilos en línea · 0 anchos propios · **0** medidas a mano |
| Ensayo de despliegue (§42) | ✅ **superado**, los 6 pasos                                      |
| Staging                    | ✅ desplegado y verificado en el navegador                        |

**El trinquete es la cifra que mejor resume el sprint:**

|                                | Al abrir | Al cerrar |
| ------------------------------ | -------- | --------- |
| Estilos en línea               | 225      | **69**    |
| Medidas chicas escritas a mano | 9        | **0**     |

Las 9 medidas a mano eran **deuda declarada abierta desde el Sprint 7**. Se
pagó sin proponérselo: los componentes de Metronic usan clases, no números
sueltos.

**Volumen:** 11 commits · 156 archivos · +22,754 / −7,389 · 129 archivos nuevos
· 2 decisiones § nuevas · 1 ADR nuevo.

## 2 · Sprint Review — comprometido contra entregado

| ID         | Qué                                 | Estado                            |
| ---------- | ----------------------------------- | --------------------------------- |
| `AZ-D2.1`  | Gate que juzgue el puente de tokens | ✅ y cazó 2 defectos reales       |
| `AZ-D2.2`  | Reglas escritas de adopción         | ✅                                |
| `AZ-D2.3`  | Decidir el armazón (D19)            | ✅ ADR-013                        |
| `AZ-D2.4`  | El barrido del frontend             | ✅                                |
| `AZ-D2.5`  | `DataGrid` adoptado                 | ✅                                |
| `AZ-D2.6`  | Cobranza sobre el `DataGrid`        | ✅ con las 6 columnas del estudio |
| `AZ-D2.7`  | Las 6 pantallas + login + 404       | ✅                                |
| `AZ-D2.8`  | Pruebas reescritas (D20)            | ✅                                |
| `AZ-D2.9`  | Inventario de lo adoptado           | ✅                                |
| `AZ-D2.10` | `Form` con react-hook-form + zod    | 🟡 **PARCIAL**                    |
| `AZ-D2.11` | Riel plegable de 80 px              | ✅                                |
| `AZ-D2.12` | Qué hacer con nuestros primitivos   | ⬜ **decisión del CEO**           |

**Los 9 `Must` completos.** Es el segundo sprint desde el S2 que entrega su
alcance obligatorio íntegro — y se advirtió al arrancar que doce ítems era más
de lo que este proyecto ha entregado nunca.

### `AZ-D2.10` se declara PARCIAL, no hecho

Los formularios se rehicieron sobre los primitivos de Metronic, con tres piezas
propias (`Campo`, `CampoSelect`, `CampoCasilla`), y funcionan. Pero **no llevan
`react-hook-form` ni validación con zod**, que era la razón que ADR-012 dio para
adoptar su `Form`: «ya usamos zod en el API: un solo esquema para las dos
orillas». Hoy la validación sigue siendo la del navegador más la del API.

Se declara antes de que lo pregunte nadie. Reciclarlo en silencio es lo que §46
prohíbe.

### La cifra del sprint

|                              | Antes                         | Después                 |
| ---------------------------- | ----------------------------- | ----------------------- |
| Componentes disponibles      | 6 propios                     | **78 + 6**              |
| Pantallas sobre la plantilla | 0                             | **8** (6 + login + 404) |
| Estilos en línea             | 225                           | **69**                  |
| Árbol commiteado             | 2.8 MB → 17.8 MB → **2.8 MB** | ver §4                  |

## 3 · Retrospectiva

### Lo que funcionó

**Probar el supuesto más riesgoso primero pagó de inmediato.** El gate del
puente (`AZ-D2.1`) se escribió antes de tocar el `DataGrid`, y en su **primera
corrida** encontró dos defectos de accesibilidad que llevaban meses en el
sistema: el botón `destructive` a 3.70:1 y el borde de los controles a 1.24:1,
los dos por debajo del mínimo de WCAG. Ninguno era de Metronic — eran nuestros,
y ninguna revisión los había visto.

**Y encontró un hueco más grande que los defectos:** el color de peligro
**nunca había tenido una prueba de contraste**, y la prueba llamada «borde de
control visible» medía en realidad el anillo de foco. Un gate mal nombrado
durante siete sprints.

**Alinear versiones en vez de instalar lo último.** 239 errores de tipos
bajaron a 45 al fijar 13 paquetes a lo que la plantilla espera. `react-table`
v9 contra v8 y `lucide` 1.x contra 0.x eran la mitad del problema.

**El trinquete volvió a hacer su trabajo sin que nadie lo mirara.** Frenó al
autor dos veces —una página de banco escrita con estilos en línea— y al final
registró la deuda pagada: de 225 a 69.

### Lo que falló — y es mío

**1. Copié carpetas por lote y metí 15 MB de arte licenciado en un repositorio
público.** `components/keenicons` —40 archivos, fuentes TTF/WOFF/SVG— más dos
PNG suyos. Eso es redistribuir, que es exactamente lo que ADR-012 prohíbe con
todas sus letras… y ADR-012 lo escribí yo tres commits antes.

Lo absurdo: **no usábamos ni un icono suyo**. La única referencia era un
`import` que yo mismo añadí. Retirado; el árbol bajó de 17.8 MB a 2.8 MB.
**Pero siguen en el historial de git**, y sacarlos de ahí es decisión del CEO.

**2. El CLI de Vercel iba a subir la plantilla entera.** 27,595 archivos, de
los cuales 26,667 eran `metronic-v9.5.0/`. Nos salvó **por accidente** un límite
de 15,000 archivos: con 14,000 el deploy habría pasado en verde y nadie se
habría enterado.

Los dos incidentes tienen la misma causa y ya es un patrón que conviene nombrar:
**al adoptar código ajeno hay que decírselo a cinco herramientas** —git, ESLint,
check-tokens, Vercel y Prettier— porque ninguna lee la configuración de las
otras. Es §67 ampliada.

**3. Construí un gate que daba un falso rojo.** Mi prueba de contraste sacaba
los números del color con una expresión regular: funciona con `rgb(...)` y
**miente con `lab(...)`**, que es lo que emite Tailwind 4. Reportaba 1.39:1
sobre un botón que en pantalla da 12:1. Corregido convirtiendo con un canvas —
el mismo motor que pinta la pantalla.

**Un falso rojo es tan grave como un falso verde:** el verde deja pasar un
defecto, el rojo enseña a ignorar el gate, y entonces deja pasar todos.

**4. Perdí medio ítem midiendo con el instrumento equivocado.** Al probar el
riel plegable, ejecutar JavaScript desde el navegador daba **siempre** el ancho
equivocado —un paso por detrás—, porque durante la evaluación de un script el
compositor no avanza y la transición de 0.3 s nunca progresa. Con
`transition: none` el mismo código daba el valor correcto, lo que hizo parecer
durante un buen rato que la transición era el defecto. **No lo era: era la
sonda.** Una captura de pantalla lo desmintió en un segundo.

**5. CI estaba en rojo y no lo supe hasta el final.** `pnpm format:check` corre
en CI y fallaba en 88 archivos desde que copié el árbol de Metronic. Lo
encontré corriendo el gate completo al cerrar, no al abrir.

### Lo que se cambia

- **Al adoptar código de terceros, la exclusión se configura en las CINCO
  herramientas ANTES de copiar nada**, no después del primer incidente.
- **El gate completo —lint, typecheck, format:check, pruebas sin caché— se
  corre al terminar cada avance**, no solo al cerrar el sprint. Es el protocolo
  de cierre de avance que el CEO instruyó el 6-sep-2026 y que ya está en
  CLAUDE.md.
- **Cuando una medición y una captura de pantalla se contradicen, la captura
  tiene razón.** Y antes de concluir que algo no funciona, comprobar que el
  instrumento sí.

## 4 · Deuda que sale de este sprint

| Deuda                                              | Estado                                          |
| -------------------------------------------------- | ----------------------------------------------- |
| 15 MB de arte de KeenThemes **en el historial**    | 🔴 ABIERTA — exige reescribir la historia (CEO) |
| `AZ-D2.10` sin react-hook-form ni zod              | Al backlog                                      |
| `AZ-D2.12` — 458 líneas huérfanas en `packages/ui` | ⬜ decisión del CEO                             |
| 7 archivos ajenos con `@ts-nocheck`                | Declarada e inventariada                        |
| 57 literales de color en componentes adoptados     | Registrados; los vigila el gate de §68          |
| §61 fechas del dinero en UTC                       | ABIERTA desde el intervalo del S6               |
| `sslmode=require` en `pg@9`                        | ABIERTA                                         |
| Sin pruebas en `apps/mobile`                       | ABIERTA desde el S0                             |
| 9 medidas chicas escritas a mano                   | ✅ **PAGADA** — de 9 a 0                        |

## 5 · Decisiones nuevas

- **§68** — Un puente entre sistemas de diseño necesita su propio gate; el del
  sistema de origen no lo cubre.
- **§69** — Una prueba que se borra deja primero por escrito qué afirmaba.
- **ADR-013** — El armazón de layout es el de Metronic (demo1), no el nuestro.
  Deroga la sección «NO se adopta su armazón» de ADR-012.
- **D19 / D20** — Decisiones del CEO registradas con su riesgo en el backlog.

## 6 · Demo

En staging (https://azahar-web-neon.vercel.app) y en local:

1. **Login** sobre el layout `branded`, y los campos **vacíos** — la contraseña
   de demo ya no viaja en producción.
2. **Dashboard** con cifras reales: cobrado, por cobrar, vencido y las cinco
   familias más urgentes con la lectura del Artículo 7 ya hecha.
3. **Cobranza** sobre el `DataGrid`: ordenar por días de atraso, buscar por
   familia, paginar.
4. **El riel**: plegar a 80 px, mover el ratón, y ver el menú expandirse al
   pasar por encima.
5. **La mordida del puente**: apuntar `--primary` al azul de marca y ver el gate
   ponerse rojo con «2.63:1; AA exige 4.5:1».

## 7 · Lo que sigue

El Plan Maestro pone **Sprint 9 — Comunicación I**. Antes de eso hay dos
decisiones del CEO pendientes (§4) y un `Should` parcial que decidir: si
`AZ-D2.10` entra al S9 o va al backlog.
