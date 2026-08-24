# Decisiones no negociables

Registro append-only. Cada decision tiene numero estable y se cita desde el
codigo y desde los PRs (`§14`, `§4`…). Su proposito: que ni una persona nueva ni
un asistente reintroduzcan un patron que ya se descarto, y que quien lo lea sepa
POR QUE, no solo QUE.

Una decision no se edita ni se borra: se marca como sustituida y se agrega la
nueva al final, con la fecha y el motivo del cambio.

| Vigencia | Vivo. Si algo lo contradice, gana este documento (salvo el Plan Maestro). |
| -------- | ------------------------------------------------------------------------- |

## Producto

- **§1** — La familia nunca paga por ver la informacion de su hijo. La
  monetizacion recae en la escuela. _(Origen: el paywall de ClassDojo es la
  queja mas airada del corpus de resenas; cobrar por una app impuesta se percibe
  como abuso.)_
- **§2** — La cobranza es nucleo, no add-on. Para una escuela de paga, cobrar ES
  el trabajo.
- **§21** — El KPI de la superficie de alumnos jamas sera tiempo en la app.
  Medir eso empuja al equipo, sprint a sprint, hacia las mecanicas que el
  proyecto tiene prohibidas.
- **§22** — Las mecanicas de la zona roja (scroll infinito, recompensa variable,
  likes publicos, rachas reciprocas, feed algoritmico para menores, rankings
  individuales publicos) no se implementan. Cambiarlo exige gate del CEO y
  dictamen legal.
- **§23** — Sin notificaciones a menores en horario nocturno ni escolar. Azahar
  conoce el horario real de cada escuela: puede cumplirlo mejor que nadie.
- **§25** — Sin canal telefonico ni SMS comercial (D13). El REPEP de PROFECO
  prohibe publicidad a numeros inscritos sin excepcion por ser cliente propio.

## Datos y seguridad

- **§3** — Toda tabla de negocio lleva `tenant_id`, politica RLS y prueba de
  aislamiento. El aislamiento no depende de que el desarrollador recuerde
  filtrar.
- **§4** — El dinero se maneja en Decimal, nunca en punto flotante. El ledger es
  append-only; las correcciones son contra-asientos, jamas ediciones.
- **§5** — Ningun numero de tarjeta toca nuestros servidores. Checkout alojado y
  tokenizacion: alcance PCI DSS SAQ A.
- **§10** — Los consentimientos se modelan por finalidad separada. Las
  finalidades voluntarias (comunidad, gamificacion, marketing) deben poder
  rechazarse sin perder el servicio educativo (LFPDPPP 2025).
- **§11** — Autorizacion en guard central deny-by-default. Todo endpoint nace
  protegido; abrir uno es una decision visible en el codigo.
- **§12** — Asistencia y eventos operativos son append-only.
- **§17** — Nada se concilia solo sin referencia unica. Los pagos sin referencia
  van a una bandeja manual con sugerencias.
- **§20** — "Contacto comercializable" son solo personas adultas, validado en el
  dominio y con prueba automatizada. Un alumno no puede ser audiencia.

### Nuevas del Sprint 0

- **§26** — La aplicacion se conecta SIEMPRE con el rol `azahar_app`
  (`NOSUPERUSER`, `NOBYPASSRLS`). El rol dueno solo migra. _(Motivo: el dueno
  ignora RLS; una prueba de aislamiento corriendo con el dueno da verde siempre
  y no prueba nada.)_
- **§27** — El contexto de tenant se declara con `set_config(..., is_local =>
true)` dentro de una transaccion, nunca como ajuste de sesion. _(Motivo: con
  pooling, un ajuste de sesion sobrevive a la peticion y la siguiente hereda el
  tenant anterior.)_
- **§28** — Ninguna capa fuera de `packages/db` construye un cliente de base de
  datos. Instanciar a mano abre la puerta a conectarse con la credencial
  equivocada.
- **§29** — Las funciones `SECURITY DEFINER` se otorgan una por una, nunca con
  `GRANT ON ALL FUNCTIONS`. Un grant masivo expondria cualquier funcion
  privilegiada futura sin que nadie lo decidiera.
- **§30** — El color de marca `#04A9F5` no se usa como texto sobre superficie
  clara ni como fondo de boton con texto blanco (2.63:1). Para eso existe
  `primary-strong`. Un test de contraste lo verifica en CI.
- **§31** — Ningun endpoint devuelve un tipo inferido de la capa de datos. El
  contrato de salida se declara explicitamente, o cada columna nueva se filtra
  sola al cliente.
- **§32** — Los mensajes de error de autenticacion son identicos para escuela
  inexistente, usuario inexistente y contrasena incorrecta. Distinguirlos
  permite enumerar escuelas y cuentas validas.

## Proceso

- **§6** — CI rojo/verde binario. Jamas `continue-on-error`. Las exclusiones se
  documentan en el YAML con su porque y su fecha de resolucion.
- **§7** — El plan de trabajo vive en UN solo lugar (el Plan Maestro). Este
  repositorio guarda reglas y estado medido, no el plan. Si se contradicen, manda
  el plan.
- **§8** — La velocidad medida recalibra el calendario, nunca el alcance ni el
  orden sin pasar por un gate.
- **§13** — Toda regla de negocio nace con tres pruebas: la regla decide bien, el
  NO-camino rechaza lo que debe, y el cableado muerde por el camino real. Sin la
  tercera, la regla esta escrita, no entregada.
- **§14** — Los efectos externos se prueban verificando EL EFECTO (el correo
  llego, la fila cambio), nunca un `ok: true`.
- **§15** — La generacion de cargos es idempotente: correrla dos veces no
  duplica nada.
- **§16** — Los webhooks de dinero usan outbox + reintento con backoff +
  dead-letter + alerta.
- **§18** — Las integraciones externas viven tras un adaptador con proveedor
  `simulated` por defecto, y se verifican con un smoke real antes de produccion.
  _(Lo simulado engana si nunca se prueba contra lo real.)_
- **§19** — Planificacion rolling-wave por tandas: la especificacion completa de
  un sprint se redacta en la frontera de su tanda, con la velocidad real.
- **§24** — GCLID y UTM se capturan y persisten desde el Sprint 9 aunque el
  modulo de marketing este diferido: es costo marginal hoy e imposible de
  reconstruir despues.

### Nuevas del Sprint 0

- **§33** — Un solo TypeScript para todo el monorepo. Dos versiones de
  compilador conviviendo producen diferencias sutiles que nadie asocia a su
  causa.
- **§34** — Toda decision de configuracion no obvia lleva su porque en el propio
  archivo, con el precedente que la origino. Asi nadie "optimiza" un valor sin
  conocer el fallo que lo puso ahi.
- **§35** — Los puertos de Azahar son propios (web 3010, api 3333, base 5434) y
  estan documentados. La maquina de desarrollo corre varios proyectos a la vez.
