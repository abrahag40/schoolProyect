# ADR-014 — Qué significa que algo sea un add-on, y cómo se construye

| Estado   | Aceptado (11-sep-2026) · decisión del CEO **D21**                           |
| -------- | --------------------------------------------------------------------------- |
| Decide   | Arquitecto; veto de Seguridad si toca aislamiento, y del CEO si toca precio |
| Vigencia | Vivo. Aplica a **todo** add-on, no solo a la vertical deportiva             |

## Contexto

El 11-sep-2026 el CEO decidió (**D21**) que la vertical deportiva se construye
como **módulo independiente que se ofrece como extra** — no como parte del core.

El problema: **Azahar lleva doce sprints hablando de add-ons sin haber definido
nunca qué es uno.** Ya están declarados `AZ-A1` (RVOE), `AZ-A8` y `AZ-A9`
(comunidad y gamificación), `AZ-A10` (BI) y `AZ-A11` (marketing, diferido), y
ninguno tiene mecanismo detrás. El prefijo `AZ-A#` distingue add-on de core en
el papel y en nada más: hoy `AZ-A1` está soldado dentro del core como una
pantalla más.

Mientras «add-on» sea solo un prefijo, **no se puede vender por separado, ni
apagar, ni cobrar aparte** — que son las tres cosas que la decisión del CEO
pide. Este ADR convierte la palabra en una frontera.

## Decisión

Un add-on de Azahar cumple **cuatro condiciones**. Las cuatro, no tres.

### 1 · Esquema de base de datos propio

Cada add-on vive en su propio esquema de Postgres (`deportivo`, `bi`, …), nunca
en `public`. **Precedente directo: ADR-008** ya hizo esto con el esquema
`plataforma`, así que no es un patrón nuevo — es el mismo, aplicado por segunda
vez.

Sus tablas **no se salvan de nada**: nacen con `tenant_id`, política RLS y prueba
de aislamiento, como manda §3. El gate que recorre `pg_class` las revisa igual, y
se pone rojo igual. _Un esquema aparte es una frontera de organización, no un
permiso para relajar el aislamiento._

### 2 · Dependencia unidireccional, verificada por un gate

**El add-on puede importar del core. El core NUNCA del add-on.** Es la única
condición que hace que el módulo se pueda apagar sin romper a un colegio que no
lo contrató.

Y no se deja en el honor de quien programa: se declara en `eslint.config.mjs`
como `no-restricted-imports`, de modo que **importar `deportivo` desde el core
ponga el build en rojo**. Es la doctrina del proyecto aplicada: un estándar
escrito que no es un gate ejecutable se incumple en el tercer sprint — pasó con
§28 hasta que el Sprint 4 lo hizo ejecutable (§46).

### 3 · Contratación por escuela, en el esquema `plataforma`

Qué módulos tiene contratados una escuela **es información de negocio de
ZaharDev, no de la escuela**: determina lo que factura, entra al MRR y lo
manipula el panel de clientes de E9. Por eso vive en `plataforma`, junto al
resto del modelo comercial (ADR-008), y no en `public`.

Un módulo contratado tiene vigencia, igual que una beca (`AZ-M4.3a`): se activa,
se renueva y **caduca solo**. Lo que pasa con los datos del add-on cuando la
escuela deja de pagarlo es una decisión de producto que este ADR **no toma** —
pero la deja planteada, porque borrarlos sería lo peor de las opciones.

### 4 · La navegación deriva de rol **×** módulos activos

`AZ-D3.2` (Sprint 9) construye la navegación derivada del rol. Con add-ons, la
regla completa es: **un destino se ofrece si el rol lo permite Y el módulo está
contratado.**

Es la misma doctrina que ya motivó el rediseño —ofrecer una puerta que devuelve
`403` es un defecto de prevención de errores—, con una segunda causa de `403`:
el módulo no contratado. Un menú que ofrece «Roster» a un colegio que no compró
la vertical deportiva comete exactamente el error que el Sprint 9 está
corrigiendo.

## Consecuencias

**A favor.** Un add-on se puede vender, apagar y cobrar aparte. El core se
mantiene delgado y la escuela que no hace deporte no ve ni paga nada de esto.
La frontera es verificable por una máquina, no por una revisión de código.

**En contra, y es real.** Cuatro condiciones es más trabajo que meter las tablas
en `public` y seguir. Habrá joins entre esquemas —Postgres los resuelve, pero
hay que escribirlos— y el mecanismo de contratación es una épica en sí mismo que
hoy no existe.

**Deuda que este ADR crea y declara:** `AZ-A1` (RVOE) **ya está construido
dentro del core** y no cumple ninguna de las cuatro condiciones. O se migra, o
se le quita el prefijo `AZ-A` y se acepta que es core. **Dejarlo llamándose
add-on sin serlo es la clase de mentira documental que este proyecto persigue.**
No se resuelve aquí: se registra para el gate que reestructure el plan.

## Alternativas descartadas

| Alternativa                                              | Por qué no                                                                                                                              |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Mismo esquema `public` con prefijo en el nombre de tabla | No es una frontera: nada impide que el core importe del add-on mañana, y no hay forma de no desplegarlo                                 |
| Un servicio aparte (microservicio)                       | Desproporcionado para el tamaño actual. Duplicaría autenticación, RLS y despliegue para ganar un aislamiento que el esquema ya da       |
| Banderas de funcionalidad sin esquema propio             | Resuelve apagar la pantalla, no separar los datos ni la dependencia. Un colegio seguiría cargando el peso de tablas que nunca va a usar |
| Repositorio aparte                                       | Rompe el monorepo y el `pnpm` único, que es de lo poco que ha funcionado sin fricción desde el Sprint 0                                 |
