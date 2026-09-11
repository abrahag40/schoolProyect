# AZ-A12 · Vertical deportiva — épica E10, módulo add-on

| Campo               | Valor                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| ID épica            | **E10 · Vertical deportiva** (add-on, no core)                                         |
| Prefijo             | `AZ-A12.#` — add-on, por ISO/IEC/IEEE 29148:2018                                       |
| Origen              | **D21**, decisión del CEO del 11-sep-2026, tras el análisis del prospecto OFASE        |
| Estado              | **EN CARTERA.** Documentada y priorizada; **sin sprint asignado**                      |
| Vigencia            | **VIVO.** Es la vara de la épica E10, como escenarios-cobranza.md lo es de E4          |
| Artefacto           | https://claude.ai/code/artifact/0797c219-c9f9-4c79-a235-1ae214ccbc54                   |
| Origen del análisis | https://claude.ai/code/artifact/fe1baabe-f1ec-4af1-9db0-7d1265a6e291 (prospecto OFASE) |

---

## 0 · Qué decidió el CEO, y qué NO decidió

**D21 (11-sep-2026):** la vertical deportiva se construye **como módulo
independiente** —add-on o plugin— que se ofrece como extra sobre Azahar, y
resuelve situaciones que la funcionalidad básica no cubre. Dentro de ese
módulo, su alcance es `Must`.

**La distinción que hay que dejar clavada, porque ISO 29148 existe justamente
para eliminar esta ambigüedad:**

| «Must» significa aquí                                         | «Must» NO significa aquí      |
| ------------------------------------------------------------- | ----------------------------- |
| Obligatorio **dentro de E10**. Sin esto el módulo no se vende | Obligatorio para el **MVP**   |
| El módulo entero sigue siendo opcional para la escuela        | Que E10 entre antes que E1–E9 |
| Prioriza el orden **interno** del backlog de E10              | Que el MVP se mueva otra vez  |

_Por qué importa: el MVP ya se corrió del Sprint 12 al 14 por C3, y luego lo
movieron C4, C5 y C6 sin que nadie recalculara la fecha. Si «Must» se leyera
como «Must del MVP», E10 lo movería una quinta vez. No es lo que se decidió._

## 1 · Product Goal de la épica

> Que una academia deportiva pueda **inscribir, agrupar por categoría de edad,
> documentar y cobrarle** a sus deportistas con las mismas reglas de dinero que
> Azahar ya usa para un colegio — sin que el colegio que no hace deporte pague
> ni vea una sola pantalla de esto.

La segunda mitad es la que define la arquitectura: **si el add-on se nota desde
el core, está mal construido.**

## 2 · La frontera: qué es add-on y qué es core

Esta es la parte que decide si E10 es vendible o es una rama de producto.

| Vive en el CORE (ya existe o está planeado)       | Vive en el ADD-ON E10                                |
| ------------------------------------------------- | ---------------------------------------------------- |
| Alumno, tutor, convenio de pagadores (`AZ-F2.*`)  | Deportista = alumno **con** categoría y elegibilidad |
| Cargos, becas, recargos, saldo a favor, FIFO (E4) | Costo por **categoría/temporada**                    |
| Pase de lista (E3)                                | Pase de lista **de partido** y del rival             |
| Expediente y documentos                           | Doble validación club↔federación                     |
| Roles y navegación (E7)                           | Permisos por equipo (mánager)                        |

**Regla de dependencia, unidireccional y no negociable:** el add-on **puede**
depender del core; el core **nunca** del add-on. Ver ADR-014. Es lo único que
hace que el módulo se pueda apagar sin romper a un colegio.

## 3 · Backlog priorizado

MoSCoW según DSDM (Agile Business Consortium). La columna «Origen» dice de dónde
sale cada requisito: **OFASE** = documentado en sus guías; **defecto OFASE** =
lo construimos _al revés_ de como ellos lo tienen, con la razón escrita;
**Azahar** = lo exige nuestra propia doctrina; **legal** = lo exige la ley.

### AZ-A12.1 · Identidad y elegibilidad del deportista

| ID          | Requisito                                                                                                        | MoSCoW | Origen       |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ------ | ------------ |
| `AZ-A12.1a` | CURP validada de verdad: 18 caracteres RENAPO, el género coincide con la posición 11, la fecha con los 6 dígitos | Must   | OFASE        |
| `AZ-A12.1b` | Autollenado de género y fecha de nacimiento desde la CURP, confirmables                                          | Must   | OFASE        |
| `AZ-A12.1c` | Candado anti-dedazo: CURP que difiere en 1–2 caracteres de una existente **frena y pide revisión**               | Should | OFASE        |
| `AZ-A12.1d` | CURP genérica para deportista extranjero, marcada como tal                                                       | Should | OFASE        |
| `AZ-A12.1e` | Categoría por rango de año de nacimiento, con margen configurable hacia los más jóvenes                          | Must   | OFASE        |
| `AZ-A12.1f` | Elegibilidad por rama cuando la categoría es de una sola                                                         | Must   | OFASE        |
| `AZ-A12.1g` | El motivo de inelegibilidad se dice **en la pantalla que bloquea**, con el rango concreto                        | Must   | Azahar (§UX) |

### AZ-A12.2 · Equipo y roster

| ID          | Requisito                                                                   | MoSCoW | Origen |
| ----------- | --------------------------------------------------------------------------- | ------ | ------ |
| `AZ-A12.2a` | Equipo por categoría y temporada; el equipo no se cambia de categoría       | Must   | OFASE  |
| `AZ-A12.2b` | Dorsal único dentro del equipo, con el conflicto nombrado («ya lo tiene X») | Must   | OFASE  |
| `AZ-A12.2c` | Entrenador responsable asignado al equipo                                   | Should | OFASE  |
| `AZ-A12.2d` | Posiciones destacadas con tope configurable (no «QB máx. 2» a fuego)        | Could  | OFASE  |
| `AZ-A12.2e` | Roster imprimible y hoja de conteo, **sin CURP** en la copia del mánager    | Should | legal  |

### AZ-A12.3 · Inscripción con máquina de estados

| ID          | Requisito                                                                      | MoSCoW | Origen        |
| ----------- | ------------------------------------------------------------------------------ | ------ | ------------- |
| `AZ-A12.3a` | Estados explícitos: solicitado → aceptado → habilitado para competir           | Must   | OFASE         |
| `AZ-A12.3b` | **El cargo nace con la inscripción ACEPTADA, nunca con la solicitud**          | Must   | defecto OFASE |
| `AZ-A12.3c` | **Dar de baja una inscripción NO borra un solo asiento del ledger**            | Must   | defecto OFASE |
| `AZ-A12.3d` | Un deportista en dos categorías = dos inscripciones, dos saldos, una identidad | Must   | OFASE         |
| `AZ-A12.3e` | Autoinscripción de la familia con código de acceso nominal y con caducidad     | Should | defecto OFASE |

### AZ-A12.4 · Expediente documental

| ID          | Requisito                                                                 | MoSCoW | Origen        |
| ----------- | ------------------------------------------------------------------------- | ------ | ------------- |
| `AZ-A12.4a` | Tipos de documento configurables por la academia, con bandera «requerido» | Must   | OFASE         |
| `AZ-A12.4b` | **Todo rechazo de documento avisa a la familia**, venga de quien venga    | Must   | defecto OFASE |
| `AZ-A12.4c` | Reemplazar un archivo reinicia las validaciones                           | Must   | OFASE         |
| `AZ-A12.4d` | Doble validación academia ↔ federación                                    | Could  | OFASE         |

### AZ-A12.5 · Cobranza deportiva (se apoya en E4, no la duplica)

| ID          | Requisito                                                                                 | MoSCoW | Origen        |
| ----------- | ----------------------------------------------------------------------------------------- | ------ | ------------- |
| `AZ-A12.5a` | Costo por categoría y temporada, que **reusa el motor de cargos del core**                | Must   | Azahar        |
| `AZ-A12.5b` | Plan de parcialidades con la invariante `I1` **visible en pantalla** («Suma: $X / $Y»)    | Must   | OFASE         |
| `AZ-A12.5c` | Cambiar el precio **avisa** a las familias afectadas                                      | Must   | defecto OFASE |
| `AZ-A12.5d` | Bajar el precio por debajo de lo pagado **genera saldo a favor** (`AZ-M4.10`, ya existe)  | Must   | defecto OFASE |
| `AZ-A12.5e` | El adeudo **no desaparece** cuando termina la temporada que lo originó                    | Must   | defecto OFASE |
| `AZ-A12.5f` | Permiso de cobranza **por equipo**, encendible y apagable, sobre una cuenta que ya existe | Should | OFASE         |

### AZ-A12.6 · Competencia y credencial

| ID          | Requisito                                            | MoSCoW | Origen |
| ----------- | ---------------------------------------------------- | ------ | ------ |
| `AZ-A12.6a` | Foto oficial capturada en vivo, no subida de archivo | Should | OFASE  |
| `AZ-A12.6b` | Credencial digital ligada al estado «habilitado»     | Should | OFASE  |
| `AZ-A12.6c` | Pase de lista de partido                             | Could  | OFASE  |
| `AZ-A12.6d` | Estadística de juego                                 | Won't  | —      |

### AZ-A12.7 · Federación multi-club — **la frontera del add-on**

| ID          | Requisito                                | MoSCoW | Origen |
| ----------- | ---------------------------------------- | ------ | ------ |
| `AZ-A12.7a` | Jerarquía federación → club → equipo     | Could  | OFASE  |
| `AZ-A12.7b` | Transferencia de deportista entre clubes | Could  | OFASE  |
| `AZ-A12.7c` | Torneos, calendario y sedes              | Could  | OFASE  |

> **Disenso documentado, sombrero de Arquitecto + PM.** `AZ-A12.7` **no es un
> add-on: es un segundo producto.** Azahar es multi-tenant por escuela; una
> federación introduce un tenant que _contiene_ a otros tenants, con datos
> compartidos entre ellos (un deportista que se transfiere) y una autoridad
> externa que valida. Eso toca RLS (§3), el modelo de tenencia (ADR-004) y la
> facturación. **Recomiendo separarlo como `AZ-A13` y dejarlo en cartera sin
> priorizar.** Si el CEO decide que entra en E10, entra — pero con esta
> advertencia escrita y con ADR propio antes de la primera línea de código.

## 4 · Lo que la ley exige, y que nadie pide

Sombrero de Seguridad & Compliance. Tres hallazgos del análisis de OFASE que
cambian requisitos:

| Hallazgo                                                                                                                        | Consecuencia para E10                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **El tipo de sangre es dato personal SENSIBLE** (LFPDPPP art. 3-VI: datos de salud). OFASE lo captura en el alta ordinaria      | `AZ-A12.1h` **Must**: si se captura, va con consentimiento **expreso y por escrito** del tutor, aparte del aviso de privacidad general |
| **§51 — el Acuerdo de PROFECO alcanza a `COLEGIO`, no a academias.** La vertical deportiva tiene otro marco legal               | El Art. 4 (ventana de 10 días) y el Art. 7 (suspensión) **no aplican** aquí. El motor de cobranza debe seguir decidiendo por vertical  |
| **El deslinde de responsabilidad** que OFASE pide firmar. En México un deslinde **no exime de responsabilidad por negligencia** | Se puede almacenar como documento del expediente; **jamás presentarlo en producto como que exime a la academia**                       |

**Pregunta legal abierta, que no resuelve el equipo:** §53 prohíbe construir lo
legalmente prohibido, ni siquiera apagado — y suspender el servicio por adeudo
lo está para un colegio (Art. 7). Pero §51 dice que ese Acuerdo no alcanza a una
academia deportiva. **¿Puede E10 ofrecer bloqueo por adeudo?** Necesita sombrero
legal y decisión de gate. Hasta entonces: **no se construye.**

## 5 · Dependencias — el orden lo decide esto, no el gusto

```
        ┌─────────────────────────────────────────────┐
        │  E10 · Vertical deportiva (add-on)          │
        └──────────────────┬──────────────────────────┘
                           │ depende de ↓
   ┌───────────────────────┼───────────────────────────┐
   │                       │                           │
E2 · Ciclo del alumno   E4 · Cobranza            E7 · Navegación
(AZ-F2.1 alta,          (motor de cargos,        por rol Y POR
 AZ-F2.2 pagadores,      FIFO, saldo a favor)     MÓDULO CONTRATADO
 AZ-F2.3 inscripción)
   ▲                       ▲                           ▲
   │                       │                           │
SIN EMPEZAR             13/24 escenarios          Sprint 9 (en curso)
(0 de 7 flujos)         13/14 `Must`
```

**El hallazgo de planificación, y es el que ordena todo:** E10 **no puede
arrancar antes que el ciclo del alumno.** Un deportista es un alumno con
categoría; si no existe la pantalla de dar de alta un alumno —hoy los 7 flujos
`AZ-F2.*` están sin empezar y toda escuela nace de un script de semilla—, el
add-on deportivo no tiene sobre qué montarse.

Dicho de otro modo: **el prospecto de fútbol americano no acelera E10; acelera
el ciclo del alumno**, que ya era el hueco más grande del catálogo de flujos.

## 6 · Cómo entra esto en el plan Scrum

Rolling-wave (§19 del Plan Maestro): resolución alta solo para lo próximo, baja
para lo lejano. E10 está lejos, así que se especifica en baja a propósito.

| Momento                                            | Qué pasa con E10                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **Hoy — Sprint 9 (navegación)**                    | Solo una consideración de forma del dato, sin ampliar alcance (§7 de abajo)          |
| **Sprints 10–13**                                  | Nada. E10 no compite con el MVP                                                      |
| **Ciclo del alumno entregado** (`AZ-F2.1` a `2.3`) | **Gate de arranque de E10.** Antes de eso el gate se rechaza solo                    |
| **Tras el MVP**                                    | E10 se estima en resolución alta y se parte en sprints con la plantilla de 10 campos |

**Gate de arranque de E10 — las cuatro condiciones, escritas por adelantado**
para no repetir la conversación de «¿lo arrancamos a medias?» que ya costó C2:

1. `AZ-F2.1`, `AZ-F2.2` y `AZ-F2.3` entregados y aceptados.
2. Existe el mecanismo de **módulos contratados por escuela** (ADR-014).
3. La pregunta legal del §4 de este documento está contestada por escrito.
4. Hay **un cliente firmado** de la vertical, no un prospecto. _(E10 no se
   construye en especulación: es un add-on de pago.)_

**Si falta cualquiera, E10 no arranca y no hay junta.** Misma mecánica que la
regla de intercambio del S7.

## 7 · Lo único que toca al Sprint 9, y no amplía su alcance

`AZ-D3.2` construye esta semana la navegación derivada del rol. Si mañana hay
módulos contratables, la navegación se deriva de **rol × módulos activos**, no
solo de rol.

**No pido cambiar el alcance** —eso sería §8 y lo sabría hacer— sino que la
**forma del dato** admita la segunda dimensión sin rehacerse: que la función que
arma el menú reciba el contexto de la escuela, aunque hoy ese contexto solo traiga
el rol. Es una firma de función, no una funcionalidad. Barato ahora, caro después.

## 8 · Marcador de la épica

**0 de 34 requisitos soportados · 0 de 19 `Must`.**

Se actualiza al cerrar cada sprint que toque E10, igual que
[escenarios-cobranza.md](../mercado/escenarios-cobranza.md) para E4. Si el
documento y el código difieren, manda el código.

## 9 · Advertencia de método, como en todo documento de este proyecto

Este backlog sale de **leer el manual de un tercero**, no de investigación
primaria. Nadie ha observado a una academia deportiva operar, ni a un padre
inscribir a su hijo, ni ha verificado una sola afirmación contra el sistema de
OFASE. Lo marcado «OFASE» es **lo que su manual dice que hace su sistema**.

Eso fija el techo del documento: **ordena y prioriza con criterio; no sustituye
ver a alguien usarlo.** El primer cliente firmado de la vertical convierte esta
inferencia en dato — y por eso es la condición 4 del gate.
