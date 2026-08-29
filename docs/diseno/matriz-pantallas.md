# Matriz maestra de pantallas y pre-diseño

| Vigencia | Vivo. Se actualiza cuando una pantalla entra a un sprint. |
| -------- | --------------------------------------------------------- |

Entregable D10 (aprobado por el CEO, diferido del Sprint 1 y pagado en el
Sprint 2). Es **baja fidelidad a propósito**: fija estructura, jerarquía y
número de pasos — no color ni tipografía, que ya viven en los tokens.

**Por qué baja fidelidad ahora y alta después:** el precedente interno es
claro — en Zentor se rehizo toda la interfaz a mobile-first pese a existir una
regla de diseñar primero. Dibujar fino antes de que el modelo de datos esté
firme produce retrabajo caro. Esta matriz es el contrato de estructura; el
prototipo navegable se hace en la Fase 2, sobre lo que aquí quede acordado.

## La matriz

`Pasos` = interacciones desde el ingreso hasta completar la tarea. Es un
objetivo de diseño, no una descripción: si una pantalla lo supera, se rediseña.

| #   | Pantalla                         | Quién la usa        | Trabajo que resuelve                   | Superficie | Pasos                   | Estado             |
| --- | -------------------------------- | ------------------- | -------------------------------------- | ---------- | ----------------------- | ------------------ |
| 1   | **Home de la familia**           | Madre, padre, tutor | ¿Cómo va mi hijo, qué debo, qué sigue? | Móvil      | 0 (es el arranque)      | Construida (S2)    |
| 2   | **Estado de cuenta y pago**      | Tutor pagador       | Ver lo que debo y pagarlo              | Móvil      | 2 al pago               | Parcial (S5)       |
| 3   | **Inscripción / reinscripción**  | Tutor               | Inscribir sin ir a la escuela          | Móvil      | < 10 min, sin laptop    | Sprint 9           |
| 4   | **Centro de avisos**             | Tutor               | Enterarme a tiempo y llegar al detalle | Móvil      | 1 al contenido          | Parcial (S3)       |
| 5   | **Panel de morosidad**           | Dirección, cobranza | ¿Quién debe, desde cuándo, cuánto?     | Web        | 1 al detalle de familia | Construida (S5)    |
| 6   | **Pase de lista**                | Docente             | Tomar asistencia de un grupo           | Web móvil  | < 30 s por grupo        | Construida (S3)    |
| 7   | **Alta de escuela (onboarding)** | Staff               | Dejar la escuela lista para operar     | Web        | Guiado por pasos        | Sprint 12          |
| 8   | **Catálogo de cargos**           | Administración      | Definir qué se cobra y a quién         | Web        | 1 por concepto          | Construida (S4·S5) |

**Fuera de esta matriz, por decisión:** la consola de ZaharDev (pantallas 9–11
del cambio C1) es producto interno y se especifica con su épica; no compite por
prioridad con las pantallas de cliente.

## Wireframes de baja fidelidad

### 1 · Home de la familia (móvil) — construida

```
┌──────────────────────────────┐
│  Tus hijas e hijos           │  ← título dice la relación, no "Dashboard"
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ Sofía Ramírez Loera      │ │  ← el nombre primero: es a quien vienen a ver
│ │ Grupo 1o A · Campus Norte│ │  ← vocabulario de SU vertical
│ │ Colegio Azahar           │ │
│ │ ·······················  │ │
│ │ [ saldo ] [ avisos ]     │ │  ← S5 y S7 cuelgan aquí, no en otra pantalla
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ Mateo Ramírez Loera      │ │
│ │ Grupo 3o A · Campus Norte│ │
│ └──────────────────────────┘ │
│                              │
│ [        Salir           ]   │
└──────────────────────────────┘
```

Decisión: **una tarjeta por hijo, no un selector**. Con dos o tres hijos, un
selector obliga a recordar en quién estás parado; las tarjetas se ven de un
vistazo. Se revisa si aparecen familias de más de cinco alumnos.

### 2 · Estado de cuenta y pago (móvil) — parcial desde el Sprint 5

```
┌──────────────────────────────┐
│ ‹ Sofía                      │
│ Colegiatura de septiembre    │
│                              │
│    $ 2,450.00                │  ← la cifra que importa, sin competencia visual
│    Vence el 5 de septiembre  │  ← fecha real; el recargo se dice, no se oculta
│                              │
│ ┌──────────────────────────┐ │
│ │ Colegiatura      2,300   │ │  ← desglose: el padre entiende qué paga
│ │ Comedor            150   │ │
│ └──────────────────────────┘ │
│                              │
│ [       Pagar ahora      ]   │  ← paso 1
│  Métodos: tarjeta · SPEI     │
│                              │
│ Pagos anteriores        ›    │
└──────────────────────────────┘
```

Objetivo duro: **dos toques al pago**. El corpus de reseñas muestra que el
estado de cuenta confuso es queja recurrente del sector; aquí el desglose es
parte de la pantalla, no un enlace aparte.

**Lo construido en el S5 y lo que falta.** El estado de cuenta existe: la cifra
primero, el desglose a la vista, y la fecha real sin recargo dicha. Con una
corrección al boceto que la realidad impuso: la cifra que encabeza es **la parte
de quien pregunta**, no el total del cargo — con padres separados, mostrarle
$2,450 a quien paga el 60% lo invita a pagar de más.

**El botón "Pagar ahora" NO está**, y es deliberado: la pasarela es el Sprint 7
(era el 6 antes del cambio C3). Un botón que no cobra es peor que su ausencia.
Hasta entonces la pantalla dice cómo pagar, sin prometer lo que todavía no
existe.

**Dos cosas que la ampliación C3 agregó a esta pantalla.** La primera es una
frase que hasta ahora era mentira: el saldo a favor "se aplicará al próximo
cargo". Ahora se aplica de verdad, así que la frase se queda. La segunda es un
**aviso fiscal** antes de pagar —el efectivo cuesta la deducción—, que ningún
sistema del sector le dice a la familia y que cuesta una línea de texto. Va como
`alert` accesible y con barra lateral, nunca solo con color.

### 5 · Panel de morosidad (web) — construida

```
┌────────────────────────────────────────────────────────┐
│ Cobranza · septiembre            [ mes ▾ ] [ Exportar ]│
├────────────────────────────────────────────────────────┤
│  Cobrado        Por cobrar      Vencido                │
│  $ 184,300      $ 42,100        $ 12,800  ← 7 familias │
├────────────────────────────────────────────────────────┤
│ Familia          Alumno    Vence    Días   Importe     │
│ Loera Ramírez    Sofía     05 sep    12    $2,450   ›  │
│ Ortiz Fuentes    Diego     05 sep     8    $1,100   ›  │
│ ...                                                    │
└────────────────────────────────────────────────────────┘
```

Decisiones: los tres números **arriba y siempre visibles** (es lo que el
director mira primero); tabla operable con orden y exportación —el estándar de
reportería que adoptamos dice que si hay que exportar a Excel para trabajar, el
reporte falló—; y el detalle de familia a un clic, sin perder el contexto.

**Lo construido en el S5 se apartó del boceto en tres puntos, todos por una
razón:**

1. **La lectura legal, hecha por el sistema.** Además de días y pesos, cada
   familia muestra en qué punto del Artículo 7 está: cuántos meses vencidos
   lleva, si la ley ya permite suspender el servicio y qué condiciones exige.
   La escuela no debería tener que recordar la ley.
2. **El pago se registra en la misma pantalla.** Ver quién debe y tener que ir
   a otra sección a capturar el abono es la fricción que hace que caja siga
   usando su libreta.
3. **Tarjetas en vez de tabla, por ahora.** A 360 px una tabla de seis columnas
   obliga a scrollear de lado. La exportación a Excel sigue pendiente: es E7,
   Sprint 10.

### 6 · Pase de lista (web móvil) — construida

```
┌──────────────────────────────┐
│ 1o A · martes 3 sep          │
│ [ Todos presentes ]          │  ← el caso del 90% de los días: un toque
├──────────────────────────────┤
│ Ana Pérez            [✓][✗]  │  ← área táctil ≥44px, operable con una mano
│ Luis Pérez           [✓][✗]  │
│ Sofía Ramírez        [✓][✗]  │
├──────────────────────────────┤
│ [        Guardar         ]   │
└──────────────────────────────┘
```

Objetivo duro: **menos de 30 segundos por grupo**, con el pulgar. Un docente
que tarda más deja de usarlo y vuelve al papel — y sin asistencia capturada no
hay alertas automáticas, que es la función con mejor evidencia de impacto
académico de todo el producto.

**Lo construido se apartó del boceto en dos puntos, y conviene registrarlo:**

1. Los `[✓][✗]` de dos opciones pasaron a **tres con texto** (Asistió · Tarde ·
   Faltó). El retardo existe en la realidad escolar y forzarlo a "presente" o
   "ausente" produce datos falsos justo en la variable que alimenta las alertas.
2. Los controles llevan **símbolo y palabra**, no solo símbolo. Un icono sin
   texto obliga a aprenderse la convención, y aquí el usuario es alguien con
   prisa entre clases (WCAG 2.2 SC 1.4.1 lo exige además para el estado).

Lo demás se sostuvo: "Todos presentes" arriba, área táctil de 44 px, guardado
único al final, y el conteo de pendientes anunciado también por lector de
pantalla.

### 4 · Centro de avisos — parcial desde el Sprint 3

La bandeja de la familia existe ya como **lectura del registro** que el motor de
avisos escribe: título, cuerpo y marcar-leído dentro del home. Lo que queda para
el Sprint 7 es lo que la hace un centro: filtros, detalle, agrupación por hijo y
los avisos que la escuela escribe a mano. Se construyó ahora porque el push
puede no llegar y un aviso que solo vive en el push se pierde sin dejar rastro.

## Reglas comunes a todas las pantallas

Salen del DoD de UX y de la investigación, no del gusto:

1. **Mobile-first verificado a 360 px**, no "responsive en teoría".
2. **Área táctil mínima de 44 px** en todo control (Apple HIG / Material).
3. **Foco visible siempre** — corrección explícita sobre la plantilla de
   referencia, que no lo tiene (WCAG 2.2 SC 2.4.7).
4. **El color nunca porta solo el significado**: todo estado lleva texto o
   icono (SC 1.4.1).
5. **Nada irreversible sin aviso**, y los periodos cerrados se pueden reabrir
   con permiso — UX defensiva, principio 8.
6. **Vacío ≠ error**: "Sin clave SEP" se dice; no se deja un hueco que parezca
   una falla de carga.
7. **El vocabulario es el de la escuela**: grupo, categoría o nivel según su
   vertical, nunca el identificador interno del sistema.
