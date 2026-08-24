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

| #   | Pantalla                         | Quién la usa        | Trabajo que resuelve                   | Superficie | Pasos                   | Estado          |
| --- | -------------------------------- | ------------------- | -------------------------------------- | ---------- | ----------------------- | --------------- |
| 1   | **Home de la familia**           | Madre, padre, tutor | ¿Cómo va mi hijo, qué debo, qué sigue? | Móvil      | 0 (es el arranque)      | Construida (S2) |
| 2   | **Estado de cuenta y pago**      | Tutor pagador       | Ver lo que debo y pagarlo              | Móvil      | 2 al pago               | Sprint 5        |
| 3   | **Inscripción / reinscripción**  | Tutor               | Inscribir sin ir a la escuela          | Móvil      | < 10 min, sin laptop    | Sprint 9        |
| 4   | **Centro de avisos**             | Tutor               | Enterarme a tiempo y llegar al detalle | Móvil      | 1 al contenido          | Sprint 7        |
| 5   | **Panel de morosidad**           | Dirección, cobranza | ¿Quién debe, desde cuándo, cuánto?     | Web        | 1 al detalle de familia | Sprint 5        |
| 6   | **Pase de lista**                | Docente             | Tomar asistencia de un grupo           | Web móvil  | < 30 s por grupo        | Sprint 3        |
| 7   | **Alta de escuela (onboarding)** | Staff               | Dejar la escuela lista para operar     | Web        | Guiado por pasos        | Sprint 12       |
| 8   | **Catálogo de cargos**           | Administración      | Definir qué se cobra y a quién         | Web        | 1 por concepto          | Sprint 4        |

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

### 2 · Estado de cuenta y pago (móvil) — Sprint 5

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

### 5 · Panel de morosidad (web) — Sprint 5

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

### 6 · Pase de lista (web móvil) — Sprint 3

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
