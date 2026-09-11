# Los tres sombreros de diseño: estructura, comportamiento, resultado

| Campo     | Valor                                                                                          |
| --------- | ---------------------------------------------------------------------------------------------- |
| Origen    | Instrucción del CEO del 11-sep-2026, tras seis observaciones sobre el frontend                 |
| Estándar  | Garrett, _Elements of UX_ (5 planos) · ISO 9241-210:2019 · ISO 9241-110 · Cooper, _About Face_ |
| Vigencia  | **VIVO.** Define quién diseña qué. Se cita desde los mocks y desde los backlogs                |
| Sustituye | Al sombrero genérico «UX/UI» de `CLAUDE.md`. **UX Research se conserva** y es el primer gate   |

---

## 0 · Por qué existe este documento

El 11-sep-2026 el CEO hizo seis observaciones sobre el frontend. **Las seis se
verificaron contra el código antes de escribir una línea de esto**, y las seis
tienen fundamento (§3). El patrón que las une: el Sprint 8 entregó 110 archivos
de Metronic con todos los gates en verde, y aun así el CEO encontró tres
defectos en cinco minutos de uso. Un solo sombrero «UX/UI» tuvo que sostener a
la vez **la estructura** (qué ve cada rol), **el comportamiento** (qué hace cada
control) y **la superficie** (cómo se ve) — y optimizó la superficie porque es
la única de las tres que un gate automático sabe medir.

**Dato de la industria que lo respalda:** Garrett (_The Elements of User
Experience_, 2.ª ed., New Riders 2010) separa el diseño en cinco planos —
estrategia, alcance, **estructura, esqueleto, superficie**— y advierte que las
decisiones de un plano se toman antes de que el siguiente empiece. Nosotros
construimos los tres planos superiores a la vez, con un solo sombrero, y sin
haber cerrado la estructura. Los tres sombreros de este documento son esos
tres planos con dueño.

## 1 · Los tres sombreros

La regla que los separa, en una frase cada uno:

| Sombrero                 | Es dueño de…          | Responde a la pregunta…                                        | Plano de Garrett        |
| ------------------------ | --------------------- | -------------------------------------------------------------- | ----------------------- |
| **UX Architect**         | la **estructura**     | ¿Qué existe, para quién y cómo se llega?                       | Estructura              |
| **Interaction Designer** | el **comportamiento** | ¿Qué hace cada control y cómo responde?                        | Esqueleto               |
| **Product Designer**     | el **resultado**      | ¿Para qué sirve esta pantalla y cómo se ve dentro del sistema? | Estrategia ↔ Superficie |

### 1.1 · UX Architect (arquitectura de información)

**Seniority:** senior. **Dominio:** la estructura del producto entero, nunca una
pantalla aislada.

**Es dueño de:** el mapa de información por rol (qué destinos existen para
quién), el modelo de navegación (primaria · secundaria · de utilidad), los
flujos de tarea de punta a punta, y la decisión de **qué armazón** recibe cada
tipo de usuario — las «tres experiencias» del catálogo de flujos.

**Entrega:** sitemap por rol · modelo de navegación · diagramas de flujo de
tarea con entrada y salida · especificación del armazón por experiencia.

**NO hace:** no elige colores ni tipografía; no define cómo se comporta un botón;
no dibuja la pantalla final.

**Estándar que lo respalda:** Rosenfeld, Morville y Arango, _Information
Architecture_, 4.ª ed. (O'Reilly 2015) — organización, etiquetado, navegación y
búsqueda como sistemas separados. ISO 9241-210:2019, actividad «entender y
especificar el contexto de uso»: **usuarios, tareas y entorno se definen antes
que la solución**. Métodos de validación: _card sorting_ y _tree testing_
(Nielsen Norman Group), que prueban una estructura **sin una sola pantalla
dibujada** — y por eso son baratos.

### 1.2 · Interaction Designer (IxD)

**Seniority:** senior. **Dominio:** el comportamiento de cada control y patrón,
en cualquier pantalla.

**Es dueño de:** los estados y transiciones (reposo · foco · cargando · error ·
vacío · éxito), la retroalimentación, la prevención de errores, **el diseño de
formularios**, los patrones reutilizables (diálogo, tabla, revelado
progresivo), y la accesibilidad del comportamiento.

**Entrega:** especificación de cada patrón · diagramas de estado · el **sistema
de formularios** (agrupación, columnas, campos condicionales, orden de tabulación)
· wireframes anotados con comportamiento, no con color.

**NO hace:** no decide qué va en el menú; no elige el sistema visual; no fija
la métrica de negocio de la pantalla.

**Estándar que lo respalda:** Cooper, Reimann, Cronin y Noessel, _About Face_,
4.ª ed. (Wiley 2014) — la referencia de la disciplina, y su definición de
interacción como **diseño de comportamiento**. Las 10 heurísticas de Nielsen
(1994, revisadas 2020). **ISO 9241-110, principios de diálogo:** adecuación a
la tarea, autodescripción, controlabilidad, conformidad con las expectativas,
tolerancia al error. W3C ARIA APG para patrones. Wroblewski, _Web Form Design_
(Rosenfeld Media 2008) e investigación de formularios del Baymard Institute.
Leyes de Fitts (tamaño y distancia de controles) y de Hick-Hyman (número de
opciones).

### 1.3 · Product Designer

**Seniority:** senior. **Dominio:** el resultado de cada pantalla — que sirva al
negocio, al usuario y sea construible — y su fidelidad al sistema de diseño.

**Es dueño de:** el mock final de cada flujo, **la métrica de éxito de cada
pantalla** (qué decisión permite tomar, qué tarea acorta), la aplicación del
sistema de diseño (Metronic, ADR-012/013), y la vigilancia de que lo que se
dibuja es lo que se construye.

**Entrega:** mocks de alta fidelidad por flujo y por rol · métrica de éxito por
pantalla · reglas de aplicación del sistema de diseño · especificación del
tablero por rol.

**NO hace:** no inventa estructura (la recibe del UX Architect) ni
comportamiento (lo recibe del IxD). **Compone; no improvisa.**

**Estándar que lo respalda:** Cagan, _Inspired_, 2.ª ed. (SVPG/Wiley 2017) —
el diseñador de producto como socio del descubrimiento, no como quien «pinta al
final». Gothelf y Seiden, _Lean UX_, 3.ª ed. (O'Reilly 2021): **resultados,
no entregables** — una pantalla se mide por lo que cambia, no por que exista.
Frost, _Atomic Design_ (2016) para la práctica de sistema de diseño. Few,
_Information Dashboard Design_ (O'Reilly, 2.ª ed. 2013) para tableros.

### 1.4 · Cómo se resuelve el desacuerdo entre los tres

Se documenta; no se esconde. Cada sombrero opina **solo dentro de su plano**,
y el orden de precedencia sigue a Garrett: **estructura antes que esqueleto,
esqueleto antes que superficie.** Si el IxD quiere un asistente de tres pasos
y el Product Designer dice que la cajera hace esa tarea cuarenta veces por
ciclo y cada paso es un clic de más, lo zanja **el dato**: UX Research. Sin
dato, decide el PO y **registra el riesgo**.

### 1.5 · La advertencia que rige sobre los tres

**Ninguno tiene investigación primaria.** El catálogo de flujos lo dice en su
encabezado y sigue siendo verdad: nadie ha observado a una docente pasar lista
ni a una cajera capturar un pago. Todo lo que estos sombreros propongan es
**inferencia razonada** hasta que una escuela piloto la convierta en dato.

Por eso **UX Research se conserva y es el primer gate**: antes de aprobar un
solo mock, **una sesión de indagación contextual** (Beyer y Holtzblatt,
_Contextual Design_, 1998) con una cajera y una docente reales. Nielsen (2000)
mostró que **cinco usuarios detectan ~85 % de los problemas**; con dos personas
y dos horas la inferencia ya tiene un piso. Es lo más barato de todo este
documento y lo que más vale.

## 2 · Las seis observaciones del CEO, verificadas

Cada una se leyó en el código antes de asignarle sombrero. **Dato** = medido;
**inferencia** = interpretación.

| #   | Observación                                                        | Lo que dice el código (dato)                                                                                                                                                                                       | Sombrero                    | ¿Sprint 9?                                                                 |
| --- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- | -------------------------------------------------------------------------- |
| a   | «El catálogo de cargos: no entiendo nada»                          | `catalogo/page.tsx`: 656 líneas, **una pantalla con tres trabajos** (lista · agregar concepto · generar cargos del mes) y **15 campos apilados** en un solo formulario                                             | UX Arch + IxD + PD          | **No.** Va a §8                                                            |
| b   | «Formularios demasiado altos, mal distribuidos»                    | `Campo` = etiqueta arriba + `gap-1.5`, siempre `flex-col`. En catálogo: 9 `flex-col` contra 1 `grid-cols-2`. Sin agrupación, sin campos condicionales                                                              | IxD                         | **Parcial**: los dos diálogos (`AZ-D3.1`). El sistema de formularios, a §8 |
| c   | «El pase de lista, ¿por qué lo haría un administrativo?»           | Menú fijo idéntico para los 7 roles. La pantalla no declara para quién es. El API sí lo permite a `ADMIN`/`DIRECTOR` (suplencias, correcciones) — pero es **tarea primaria del docente**                           | UX Arch                     | **Sí**: `AZ-D3.2` + `AZ-D3.4`                                              |
| d   | «Registrar una escuela tiene costo; el cliente no agrega escuelas» | **Ningún endpoint del API crea un `Tenant`**; la consola solo registra RVOE. `Tenant` = contrato; `Sede` = plantel del mismo. Ya es así por arquitectura (C1, E9, ADR-008) — **pero no estaba escrito como regla** | PD + PO                     | Regla → **§72 hoy.** El flujo es E9, no S9                                 |
| e   | «El panel no es un dashboard que agregue valor»                    | `panel/page.tsx`: dos bloques —«La operación de hoy» y «Familias que requieren atención»— **idénticos para los siete roles**                                                                                       | PD                          | **Sí**: `AZ-D3.4`                                                          |
| f   | «Sigo cuestionando que uses la plantilla que compré»               | **Correcto: no se ve 100 % igual, y hoy no puede.** Ver §2.1                                                                                                                                                       | PD + Arquitecto + Seguridad | Decisión del CEO (§2.1)                                                    |

### 2.1 · Por qué no se ve como el demo1, con precisión

| Desviación medida                                                       | Causa                                                                                               | ¿Reversible?                                                                                      |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Iconos:** `keenicons` retirado; `lucide-react` en **43 archivos**     | Incidente de licencia del 6-sep (15 MB de arte a un repo público). ADR-012 prohíbe **redistribuir** | **Sí, y es la mayor diferencia visual.** Ver propuesta PD-1                                       |
| Header sin mega-menú, buscador, chat, notificaciones ni rejilla de apps | Deliberado y documentado en `header.tsx`: eran botones que no llevaban a ningún lado                | Sí, cuando exista lo que abren. La campana de notificaciones **ya tiene modelo** (bandeja del S3) |
| Sin foto de perfil; iniciales de la escuela                             | Deliberado: Azahar no guarda fotos de usuario; una genérica haría creer que el dato existe          | Sí, cuando exista el dato                                                                         |
| 124 de 133 `partials` sin adoptar                                       | Eran demos: tienda, NFT, blogger, 18 tarjetas de notificación de ejemplo                            | No procede                                                                                        |
| Menú de 6 entradas contra 1,564 líneas del suyo                         | El contenido es nuestro por diseño (ADR-012: ellos la estructura, nosotros lo que va dentro)        | No procede                                                                                        |

**Inferencia:** de las cinco, **la primera explica la mayor parte de la
sensación de «no es igual»**. El demo1 se reconoce por sus iconos duotono; sin
ellos, el mismo armazón parece otro producto.

## 3 · Propuestas, por sombrero

Cada propuesta cita su fundamento. Ninguna amplía el Sprint 9 sin pasar por §8.

### UX Architect

**UXA-1 · Navegación primaria por rol, secundaria por excepción.** El
administrativo **sí** puede pasar lista (suplencia, corrección), pero no es su
tarea primaria: va a navegación **secundaria** («Más» / utilidad), no al riel.
Para la docente es la única entrada primaria. _Fundamento:_ Rosenfeld et al.,
distinción entre navegación global, local y contextual; ISO 9241-110,
**adecuación a la tarea**. → `AZ-D3.2`.

**UXA-2 · Un trabajo por pantalla.** El catálogo se parte en tres destinos:
_Conceptos_ (lista), _Nuevo concepto_ (página propia), _Generar cargos_ (acción
con confirmación). _Fundamento:_ Krug, _Don't Make Me Think_ — una pantalla es
autoevidente cuando responde «¿qué es esto y qué hago aquí?» sin pensar; tres
respuestas es cero respuestas. → §8.

**UXA-3 · Tres armazones, no uno.** Consola (escritorio, denso, riel) ·
herramienta del docente (teléfono, una tarea, sin riel) · portal de la familia
(ya vive en `apps/mobile`). Comparten tokens, no armazón. _Fundamento:_ el
catálogo de flujos §«cinco exigencias»; ISO 9241-210 contexto de uso: aparato,
frecuencia y prisa distintos exigen estructura distinta. → `AZ-D3.2`/`AZ-D3.4`
para la consola; el armazón del docente, a §8.

**UXA-4 · Validar la estructura antes de dibujarla.** Un _tree test_ con las
tareas reales («¿dónde registro un pago?») sobre el sitemap por rol, con 5
personas, **antes** del primer mock. _Fundamento:_ NN/g; Nielsen (2000).

### Interaction Designer

**IxD-1 · Sistema de formularios, cuatro reglas.** (1) **Agrupar en
_fieldsets_ de ≤ 5 campos** con título — Cowan (2001), 4 ± 1 elementos en
memoria de trabajo. (2) **Campos condicionales ocultos hasta que apliquen**:
«Descuento (%)» y «Se gana si paga antes del día» solo si «Dar descuento» está
marcado; «Nivel educativo» solo si «Es una colegiatura» — NN/g, _progressive
disclosure_. Del catálogo, **15 campos bajan a 8 visibles**. (3) Etiqueta
arriba **se conserva**: Wroblewski (2008) midió que es la alineación de
compleción más rápida; el problema no es la etiqueta, es la ausencia de
agrupación. (4) Pares cortos y relacionados van lado a lado («Importe · Cada
cuándo», «Vigente desde · Día de vencimiento»); **una columna para el resto** —
Baymard: multicolumna daña cuando el recorrido visual es ambiguo, no cuando
los pares son obvios. → `AZ-D3.1` para los diálogos; el sistema, a §8 (y
decide `AZ-D2.10`).

**IxD-2 · El diálogo, patrón único.** Tres zonas; **el pie no se desplaza**;
principal a la derecha, cancelar a su izquierda; foco atrapado; Escape cierra y
devuelve el foco. **Ningún botón rotulado «Cancelar…» ejecuta una acción** —
defecto documentado en OFASE. _Fundamento:_ W3C ARIA APG, Dialog (Modal)
Pattern; Nielsen H5 prevención de errores. → `AZ-D3.1`.

**IxD-3 · Toda tarea declara entrada, cancelación y fin.** En cada wireframe:
cómo se entra, cómo se sale sin hacer nada, y cómo se sabe que terminó. Es el
defecto del menú lateral generalizado. _Fundamento:_ ISO 9241-110,
**controlabilidad** y **autodescripción**. → `AZ-D3.3` y todo lo demás.

**IxD-4 · Estados vacíos y de error diseñados, no heredados.** Una lista vacía
dice qué hacer para dejar de estarlo. _Fundamento:_ Nielsen H1 visibilidad del
estado, H9 recuperación de errores.

### Product Designer

**PD-1 · Recuperar los iconos de Metronic sin redistribuirlos.** La licencia
Extended cubre el **uso** en un SaaS; lo que ADR-012 prohíbe es **redistribuir**
en un repo público. Propuesta: la fuente de iconos **no entra a git** y se
inyecta en el _build_ desde una fuente privada (paquete privado o paso de
construcción desde el zip licenciado). _Marcado como inferencia_ hasta que
Seguridad & Compliance lea la cláusula. **Es la decisión con mayor efecto
visual por peso menor de todo el documento.** → Gate del CEO.

**PD-2 · Un tablero por rol, y cada uno responde una decisión de hoy.** Few
(2013): un tablero es «la información más importante para lograr un objetivo,
consolidada en una pantalla para vigilarse de un vistazo». Dueño: **«¿Se cobró
el mes?»** — una cifra, una tendencia, sin navegación. Cajera: **«¿A quién
llamo hoy?»** — una cola ordenada por urgencia, cada fila con acción. Docente:
**«¿Ya pasé lista?»** — un botón y el estado de hoy. Lo que no responde una
decisión **no va**. → `AZ-D3.4`.

**PD-3 · Métrica de éxito por pantalla, escrita antes del mock.** Ejemplo:
«Registrar un pago» se mide en **segundos de la cajera y errores de captura**;
«Estado de cuenta» en **llamadas a la escuela que evita**. _Fundamento:_
Gothelf, _Lean UX_ — resultado sobre entregable. Sin métrica, el mock no se
aprueba.

**PD-4 · La regla de negocio del alta de escuela, en el producto.** Una
escuela **nace en la plataforma ZaharDev** (E9, wizard Activate), con contrato;
la consola de la escuela **nunca** ofrece «agregar escuela». Queda escrita como
**§72**. Lo que falta decidir: si una escuela con varios planteles (`Sede`) paga
por plantel o por contrato — **precio, decisión del CEO**.

## 4 · La secuencia hasta los mocks

Inception (Thoughtworks) / Discovery→Definición→Plan→Build (Cagan). Cada paso
es un gate del CEO:

| Paso | Qué                                                       | Estado                         | Gate                                 |
| ---- | --------------------------------------------------------- | ------------------------------ | ------------------------------------ |
| 1    | Catálogo de flujos (`AZ-F#.#`)                            | **Hecho** (7-sep)              | —                                    |
| 2    | Sombreros y propuestas (este documento)                   | **Propuesto**                  | Aprobar sombreros y propuestas       |
| 3    | Indagación contextual: 1 cajera + 1 docente, 2 h          | Sin hacer                      | **Primer gate real de datos**        |
| 4    | Sitemap por rol + tree test (UXA-4)                       | Sin hacer                      | Aprobar estructura                   |
| 5    | Wireframes con comportamiento de los 5 entregables del S9 | Sin hacer                      | Aprobar comportamiento               |
| 6    | Mocks de alta fidelidad, con métrica por pantalla         | Sin hacer                      | **Aprobar mocks → arranca el build** |
| 7    | Build del Sprint 9                                        | Aprobado como C7, sin arrancar | DoD del sprint                       |

**Lo que esto le hace al Sprint 9:** no cambia su alcance. Cambia el orden:
**los mocks se aprueban antes del código**, que es lo que el prompt del sprint
ya pedía («no escribas código hasta que lo apruebe»). El paso 3 es el único
que añade tiempo de calendario, y es el que convierte todo lo anterior de
inferencia en dato.

## 5 · Lo que va a §8, y no entra solo

- **Partir el catálogo en tres destinos** (UXA-2).
- **El sistema de formularios** completo, con la decisión pendiente de
  `AZ-D2.10` (react-hook-form + zod).
- **El armazón del docente** (UXA-3, segunda experiencia).
- **PD-1**, los iconos: decisión del CEO con lectura de licencia.

Cada uno entra a un sprint solo por el mecanismo de tres salidas.
