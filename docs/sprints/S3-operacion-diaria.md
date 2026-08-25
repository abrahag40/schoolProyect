# Sprint 3 — La operación diaria de la escuela

| Campo    | Valor                                                   |
| -------- | ------------------------------------------------------- |
| Estado   | EN CURSO — aprobado por el CEO el 24-ago-2026 (gate §8) |
| Rama     | `sprint-3-operacion`                                    |
| Vigencia | Vivo durante el sprint; se congela al cerrarlo          |

Sprint Backlog en el sentido de la Guía Scrum 2020: Sprint Goal + elementos
seleccionados + el plan para entregarlos. Redactado con la plantilla de 10
campos aprobada en D7.

---

## 1 · Sprint Goal

> Ambas escuelas demo operan su semana: el docente toma asistencia desde su
> teléfono en menos de 30 segundos, y cuando un alumno acumula faltas, **su
> familia recibe el aviso en la app** — sin que nadie lo escriba a mano.

Un solo objetivo, verificable con una demo, no con narración. Si al cierre el
aviso no llegó solo, el sprint no cumplió su meta aunque el código exista.

## 2 · Alcance seleccionado

| ID       | Elemento                                                      | MoSCoW |
| -------- | ------------------------------------------------------------- | ------ |
| AZ-M3.1  | Pase de lista por cohorte, mobile-first                       | Must   |
| AZ-M3.2  | Asignación docente↔cohorte ("mis grupos")                     | Must   |
| AZ-M5.1  | Motor de avisos automáticos por inasistencia                  | Must   |
| AZ-M5.2  | Bandeja de avisos de la familia (lectura, no centro completo) | Must   |
| AZ-M3.3  | Parámetros de asistencia por escuela (umbral, ventana, zona)  | Should |
| AZ-INF.1 | Ensayo de despliegue local (imagen Docker + migración)        | Must   |
| AZ-INF.2 | Validación de push en dispositivo físico Android              | Could  |

**Fuera de alcance, explícito:** el Centro de avisos completo (pantalla 4,
Sprint 7), justificantes con documento adjunto, reportes de asistencia para
dirección, y el canal de correo/WhatsApp. Aquí el canal es push in-app.

## 3 · Cómo se hace (diseño técnico)

1. **Datos.** Cuatro tablas nuevas en `public`, todas con `tenant_id`, política
   RLS y `FORCE` (§3): `asignacion_docente`, `asistencia`, `notificacion`,
   `configuracion_escuela`. El gate que recorre `pg_class` las cubre solo.
2. **La regla de negocio es una función pura** (`asistencia/reglas.ts`): recibe
   estado, faltas en ventana y parámetros; devuelve los avisos a generar. Sin
   base de datos, sin red, sin reloj. Así se prueba el NO-camino sin montar un
   escenario (§13).
3. **Guardar y avisar es una transacción + un outbox.** Dentro de la
   transacción: asistencias, bitácora y **filas de aviso con clave de
   idempotencia**. Fuera de ella, ya con el commit hecho: el envío push. Meter
   una llamada de red dentro de una transacción de Postgres es cómo se
   fabrican bloqueos largos y avisos fantasma de transacciones que luego
   revierten (ADR-010).
4. **Idempotencia por clave estable** (§15): `falta:{alumno}:{fecha}` y
   `acumulada:{alumno}:{año-mes}`. Guardar dos veces el mismo pase de lista no
   genera un segundo aviso; el `@@unique(tenant_id, clave)` lo impide en la
   base, no en la aplicación.
5. **Superficies.** Web móvil para el docente (pantalla 6 de la matriz D10) y
   la app de la familia muestra sus avisos en el home ya construido.

## 4 · Justificación (dato duro · inferencia · estándar)

**Dato duro.** Los avisos automáticos a la familia sobre ausencias y tareas
tienen la mejor evidencia causal de todo nuestro corpus:

- Bergman & Chan (2021), _Journal of Human Resources_ 56(1):125-158 — ensayo
  aleatorizado con alertas automáticas a padres: **−27% de reprobación de
  materias y +12% de asistencia a clase**, con 63 USD de costo variable.
  <https://doi.org/10.3368/jhr.56.1.1118-9837R1>
- Rogers & Feller (2018), _Nature Human Behaviour_ 2:335-342 — 28,080 alumnos;
  informar a los padres de las ausencias acumuladas **redujo el ausentismo
  crónico un 10% o más**, corrigiendo la creencia equivocada del padre sobre
  cuántas faltas lleva su hijo.
  <https://doi.org/10.1038/s41562-018-0328-1>

> **Corrección de registro (24-ago-2026).** En el cierre del Sprint 2 se citó
> este mecanismo con "+17% de asistencia y −38% de reprobación". Las cifras
> verificadas contra la fuente publicada son **+12% y −27%**. La dirección del
> hallazgo no cambia; la magnitud sí, y la regla 1 del CLAUDE.md no admite
> cifras sin fuente. Queda corregido aquí y en el CHANGELOG; el Informe de
> Mercado Fase 0 (artefacto publicado) queda **marcado para corrección** en su
> próxima revisión — no se edita en silencio un documento que el CEO ya leyó.

**Inferencia propia (marcada como tal).** El mecanismo de Rogers & Feller
funciona porque corrige una **creencia equivocada** del padre, no porque
regañe. De ahí se sigue una decisión de diseño que adoptamos: el aviso dice el
acumulado ("lleva 3 faltas este mes"), no solo el hecho del día. Y por eso el
aviso acumulado se topa a uno por alumno por mes: el estudio envía recordatorios
espaciados a lo largo del ciclo, no un goteo diario. El goteo entrena a ignorar.

**Estándar de industria.** Idempotencia con clave estable y outbox
transaccional es el patrón de mensajería confiable que documenta Hohpe & Woolf
(_Enterprise Integration Patterns_, Addison-Wesley) y que aplica cualquier
consultora seria en integraciones con efectos externos. La separación
"transacción de datos / efecto externo después del commit" es el mismo criterio
que ya rige nuestros webhooks de dinero (§16).

**Cumplimiento.** El aviso de asistencia es tratamiento con finalidad
`COMUNICACION_OPERATIVA`, de las **necesarias** para el servicio contratado
(§10 / LFPDPPP 2025): sostiene la relación escuela-familia y no requiere
consentimiento adicional. No se usa para nada comercial, y esa frontera está
en el código, no en una promesa.

## 5 · Relación con otros sprints y módulos

| Depende de                          | Habilita                                          |
| ----------------------------------- | ------------------------------------------------- |
| S1 — cohorte, inscripción, alumno   | S5 — la morosidad se lee igual que la falta       |
| S2 — tutor↔alumno, dispositivo push | S7 — centro de avisos: aquí nace el registro      |
| S2 — puerto `Mensajero`             | R2 — expediente: la asistencia es su primer hecho |

La asistencia es también **el primer hecho analítico real** del producto
(AZ-A10 capa 1): cada fila lleva las cuatro coordenadas de §37 y alimenta el
indicador de riesgo de deserción sin trabajo extra después.

## 6 · Definition of Ready (verificada antes de arrancar)

- [x] El elemento tiene ID trazable (`AZ-M3.*`, `AZ-M5.*`) — ISO/IEC/IEEE 29148.
- [x] Criterio de aceptación demostrable en una demo.
- [x] Pantalla especificada en la matriz D10 (pantalla 6, objetivo < 30 s).
- [x] Dependencias entregadas (S1 y S2 cerrados y en `main`).
- [x] Sin decisiones de producto abiertas que bloqueen.

## 7 · Pruebas QA (§13 — tres capas por regla)

| Capa              | Qué prueba                                                                        |
| ----------------- | --------------------------------------------------------------------------------- |
| **Pura**          | `reglas.ts`: qué avisos genera cada combinación de estado y umbral                |
| **NO-camino**     | Presente y retardo NO avisan; bajo umbral no dispara acumulado; futuro se rechaza |
| **Cableado real** | HTTP + Postgres real: el docente guarda, la madre recibe (§14: por el EFECTO)     |
| **Aislamiento**   | Las cuatro tablas nuevas pasan el gate de `pg_class` con RLS forzado              |
| **Autorización**  | Un tutor no toma asistencia; un docente no pasa lista de un grupo ajeno           |
| **Idempotencia**  | Guardar dos veces = un solo aviso (§15)                                           |

## 8 · Higiene documental

`CHANGELOG.md` (release), `docs/decisiones.md` (§39-§41), `docs/adr/ADR-010`
(motor de avisos), `docs/diseno/matriz-pantallas.md` (pantalla 6 a
"Construida"), `CLAUDE.md` (sprint activo) y este archivo.

## 9 · Riesgos y alternativas descartadas

| Riesgo                                           | Mitigación en este sprint                                                    |
| ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Staging sigue bloqueado (3 sprints)              | Ensayo de despliegue local: imagen real + migración automática               |
| Push nunca probado en teléfono real              | Validación Android declarada; iOS depende de cuenta Apple (decisión del CEO) |
| Sobre-notificar y que la familia silencie la app | Tope de un aviso acumulado por mes; retardo no avisa                         |
| Corrección de un pase de lista mal capturado     | Corregible, con bitácora append-only de cada cambio                          |

**Alternativas descartadas, con su porqué:**

- **Cola dedicada (Redis/BullMQ) para los avisos.** Descartada hoy: agrega una
  pieza de infraestructura y un modo de fallo nuevo para un volumen que no
  existe. El outbox transaccional da la misma garantía de "no se pierde" a
  escala de una escuela. Se revisa cuando haya más de una instancia del API
  o más de ~5 mil avisos por día (ADR-010).
- **Asistencia como evento append-only puro.** Descartada: un docente se
  equivoca y una justificación llega dos días después. Un modelo que solo sabe
  agregar obliga a leer N eventos para saber si Sofía faltó el martes. Se
  resuelve al revés: la fila es corregible y **cada corrección deja evento en
  la bitácora inmutable** (§39).
- **Un "responsable" en la cohorte.** Descartada: hay co-docencia y academias
  con dos entrenadores. Tabla de asignación, no columna.

## 10 · Definition of Done (3 capas)

**Capa 1 — Código.** Formato, lint, tipos y build en verde; sin `any`;
comentarios que expliquen el porqué (§34); pipeline rojo/verde sin excepciones (§6).

**Capa 2 — Producto.** El docente toma asistencia en < 30 s a 360 px con el
pulgar; la familia ve el aviso; vocabulario por vertical; área táctil ≥ 44 px;
foco visible; el color no porta solo el significado.

**Capa 3 — Seguridad y datos.** Las cuatro tablas con RLS forzado y prueba de
aislamiento; sin PII en logs; finalidad de tratamiento declarada; bitácora de
toda corrección.
