# Catálogo de flujos del sistema (`AZ-F#.#`)

| Campo     | Valor                                                                    |
| --------- | ------------------------------------------------------------------------ |
| Origen    | Instrucción del CEO del 7-sep-2026, previa al rediseño de la interfaz    |
| Estándar  | ISO 9241-210:2019 · Análisis jerárquico de tareas (Annett & Duncan 1967) |
| Vigencia  | **VIVO.** Es la vara del rediseño: se actualiza al entregar cada flujo   |
| Artefacto | https://claude.ai/code/artifact/a1e87799-97ed-4976-92ac-b78206f47adf     |

---

## Por qué existe

El CEO reportó tres defectos de interfaz. Verificados, los tres apuntan al mismo
hueco: **se construyeron pantallas sin haber definido antes los flujos**. Al
buscar la causa aparecieron dos hallazgos que pesan más que los tres reportes:

1. **El menú es una lista plana e idéntica para los siete roles.** Una docente ve
   «Cobranza», «Catálogo de cargos» y «Becas», y el API le responde `403`.
2. **El sistema sabe operar una escuela, pero no darla de alta.** No hay pantalla
   para registrar un alumno, vincular tutores o invitar personal. Toda escuela
   nace hoy de un script de semilla.

## Declaración de método, antes de las conclusiones

**NO hay investigación primaria.** Nadie ha observado a una docente pasar lista,
ni a una cajera capturar un pago. Las frecuencias, aparatos y prisas que este
catálogo afirma son **inferencia razonada** desde el esquema, la matriz de roles
del API, el marco legal y la Definición de Producto aprobada — no medición.

Eso fija su techo: **ordena y prioriza con criterio; no sustituye ver a alguien
usarlo.** La primera escuela piloto convierte esta inferencia en dato.

## Marcador

**42 flujos · 11 funcionan · 8 a medias · 23 sin empezar · cobertura 26 %.**

Se actualiza al cerrar cada sprint, igual que el catálogo de escenarios de
cobranza. Si el documento y el código difieren, manda el código.

## Los tres hallazgos que ordenan el rediseño

1. **El dinero está cortado a la mitad.** De 19 flujos, funcionan los de
   _calcular_ y falta casi todo lo de _cobrar_. Azahar es hoy una calculadora de
   colegiaturas muy correcta, no un sistema de cobranza. La distancia son cuatro
   flujos: pagar en línea, conciliar, facturar y contactar al moroso.
2. **El alumno no tiene puerta de entrada.** Los 7 flujos del ciclo del alumno
   están sin empezar. El más grave es `AZ-F2.2` —quién paga y en qué proporción—:
   el reparto entre pagadores es de lo mejor construido del sistema y **no hay
   forma de capturar el convenio que lo alimenta**.
3. **Los avisos van en un solo sentido.** La familia lee y no puede responder.
   Esas conversaciones ocurren hoy en WhatsApp, fuera del sistema y sin registro.

**El patrón que las tres comparten:** lo construido es lo que el sistema hace
_solo_; lo que falta es donde una persona _captura_ o _responde_.

## Las cinco exigencias que esto le impone al layout

| Exige                                        | Porque                                                                                                   | Hoy |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------- | --- |
| La navegación sale del ROL, no es lista fija | Una docente tiene 1 flujo; cobranza tiene 19. Ofrecer puertas que dan 403 es error de prevención         | ❌  |
| Tres experiencias, no una                    | Consola de administración · herramienta del docente · portal de la familia. Comparten tokens, no armazón | ❌  |
| El panel es distinto por rol                 | El dueño quiere una cifra; la cajera una cola de trabajo; la docente un botón                            | ❌  |
| Toda tarea con entrada y salida visibles     | Es el defecto del menú lateral, generalizado                                                             | 🟡  |
| Un patrón único de diálogo                   | Encabezado · cuerpo desplazable · pie con las acciones SIEMPRE debajo                                    | ❌  |

## El patrón de diálogo, normativo

Fuente: **W3C ARIA Authoring Practices Guide — Dialog (Modal) Pattern**. No es
opinión de estilo.

- `role="dialog"` con `aria-modal`, título asociado.
- **Foco atrapado** dentro mientras está abierto.
- **Escape cierra** y el **foco vuelve** al elemento que lo abrió.
- **Tres zonas:** encabezado (título + descripción), cuerpo (lo ÚNICO que se
  desplaza) y pie. **El pie no se desplaza**: si el botón de confirmar se va con
  el scroll, en un formulario largo desaparece.
- **Orden de acciones:** principal a la derecha, cancelar a su izquierda
  (convención de Apple HIG y Material). En móvil, apiladas a todo el ancho con la
  principal arriba.
- **Cuándo NO usar diálogo** (Nielsen Norman Group): interrumpen y ocultan el
  contexto. Un formulario de doce campos —«agregar un concepto»— pertenece a una
  página, no a un diálogo.

## Recomendación de alcance

**No es rehacerlo todo.** Es rehacer la capa de navegación, que es donde está el
error, y dejar intacto lo validado.

- **Se conserva:** el dominio, el API, los tokens, los 78 componentes adoptados y
  el contenido de las seis pantallas.
- **Se rehace:** la navegación, derivada del rol, con tres armazones.
- **Se estandariza:** el diálogo, en un componente propio.
- **Se corrige:** el botón de cerrar del panel lateral y el menú de perfil.
- **Se abre:** el ciclo del alumno, sin el cual ninguna escuela piloto puede
  empezar sin un script.

## Los 42 flujos

El detalle completo, con actor y estado, vive en el artefacto. Resumen por ciclo:

| Ciclo                       | Flujos | Funcionan | A medias | Sin empezar |
| --------------------------- | ------ | --------- | -------- | ----------- |
| 1 · La escuela como cliente | 6      | 0         | 0        | 6           |
| 2 · El alumno               | 7      | 0         | 0        | 7           |
| 3 · El dinero               | 19     | 7         | 4        | 8           |
| 4 · El día a día            | 9      | 3         | 1        | 5           |
| 5 · Cumplimiento            | 5      | 1         | 2        | 2           |
