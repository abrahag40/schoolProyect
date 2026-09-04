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

### Nuevas del cambio C1 (24-ago-2026)

- **§36** — Los datos de ZaharDev sobre sus clientes (suscripciones, precios,
  cartera de socios, salud de cuenta) viven en el esquema `plataforma`, fuera
  del RLS de tenants, tras un guard de plataforma propio. Una cuenta demo
  JAMAS es de plataforma (bug real cazado en Zentor: la demo compartible abria
  la consola cross-tenant).
- **§37** — Reglas BI-ready obligatorias para toda tabla nueva (ADR-008):
  hechos como eventos append-only; cuatro coordenadas en todo evento
  (tenant_id, actor, timestamptz UTC, tipo estable); dimensiones con claves
  estables; hechos consultables en columnas tipadas, no JSON; la analitica
  jamas sobre el primario OLTP.
- **§38** — Cada producto de ZaharDev vive en su propio workspace de nube. Los
  minutos de build compartidos entre productos ya costaron 3 dias sin deploys
  (Zentor/Zenix, jul-2026).

### Nuevas del Sprint 3 (24-ago-2026)

- **§39** — La asistencia es un **hecho corregible**, no un evento inmutable: la
  fila `(alumno, cohorte, fecha)` se actualiza, y CADA correccion escribe un
  `asistencia.corregida` en `evento_auditoria`, que si es append-only (§12).
  _(Por que se aparta de §37: un docente se equivoca y la justificacion llega
  dos dias despues. Con solo-agregar, responder "¿falto Sofia el martes?"
  obligaria a reducir N eventos en cada consulta y en cada reporte. Asi la
  lectura es una fila y la historia sigue siendo indestructible.)_
- **§40** — El motor de avisos tiene dos frenos que no se quitan sin gate: un
  **retardo nunca avisa**, y el aviso acumulado se limita a **uno por alumno por
  mes** (clave de idempotencia con ano-mes). _(Origen: Rogers & Feller 2018
  usa recordatorios espaciados a lo largo del ciclo, no diarios. Una familia
  que silencia la app deja de recibir tambien lo importante — el sobre-aviso no
  es un exceso de celo, es como se pierde el canal.)_
- **§41** — El comando de desarrollo usa el **mismo compilador** que la imagen
  de produccion. Prohibido un runtime de desarrollo distinto (type-stripping de
  Node, transpiladores parciales). _(Defecto real del 24-ago-2026: con Node
  25.2.1 el type-stripping no resuelve un import `.js` a su hermano `.ts` y no
  emite `emitDecoratorMetadata`, asi que la inyeccion de dependencias de Nest
  fallaria SOLO en desarrollo. Un entorno que difiere del que se despliega
  produce fallos que no se reproducen donde se investigan.)_
- **§42** — Mientras no exista staging real, **ningun sprint cierra sin ensayo
  de despliegue** (`pnpm ensayo:despliegue`): imagen construida, arranque contra
  base vacia, migracion automatica y verificacion del aislamiento en el esquema
  desplegado. _(Origen: tres sprints y siete migraciones sin desplegar. El
  ensayo no sustituye al staging y lo dice en su propia salida — pero convierte
  la mayoria de las sorpresas del primer deploy en fallos vistos con calma. Ya
  cazo uno: `ensure-app-role` moria en base vacia por un cast a `regnamespace`
  sobre un esquema inexistente, es decir, el primer despliegue habria fallado.)_

### Nuevas del Sprint 4 (25-ago-2026)

- **§43** — El dinero se calcula en **centavos enteros** dentro del dominio y se
  guarda como `Decimal` en la base. Jamás punto flotante, jamás `number` en un
  JSON. El criterio de redondeo es **uno solo** y está escrito: al centavo más
  cercano, medio hacia arriba. _(`0.1 + 0.2` no es `0.3` en ningún lenguaje con
  IEEE-754. Dos partes del sistema redondeando distinto es como aparecen las
  diferencias que nadie sabe explicar, meses después, en el corte del mes.)_
- **§44** — El reparto de un cargo entre pagadores se **congela** al generarlo,
  junto con el importe y la fecha límite sin recargo. Cambiar un convenio no
  reescribe lo ya emitido. _(Recalcular al leer haría que un acuerdo nuevo en
  marzo cambiara retroactivamente lo que cada quien debía en enero, y volvería
  imposible demostrar que se cobró lo que se anunció.)_
- **§45** — Cuando una ley acota al negocio, el límite vive en el **dominio**, no
  en una casilla de configuración. La escuela puede ser más generosa que la ley;
  más estricta, nunca. _(Art. 4 del Acuerdo DOF 10-mar-1992: diez días naturales
  sin recargo. Un parámetro configurable lo respeta hasta que alguien lo mueve —
  un empleado nuevo, una promoción, una importación — y quien paga la multa es
  la escuela. El estudio comparativo con WispHub mostró exactamente ese diseño
  en un motor de cobranza genérico.)_
- **§46** — Un gate que no revisa nada **se implementa o se retira**; no se
  recicla en silencio de sprint en sprint. _(ESLint estuvo declarado como deuda
  "entra en S1" durante tres sprints mientras `pnpm lint` imprimía verde
  ejecutando solo el gate de tokens. Un check verde que no comprueba nada es
  peor que su ausencia: da una garantía falsa. Al implementarlo aparecieron 65
  hallazgos, dos de ellos defectos reales de React.)_

### Nuevas del Sprint 5 (25-ago-2026)

- **§47** — El saldo se **deriva**, nunca se guarda. Un cargo no cambia de
  importe cuando alguien paga: se registra el pago, se aplica, y lo que falta es
  una resta. _(Una columna de saldo hay que mantenerla sincronizada con cada
  abono, y el día que la columna y la suma difieran nadie sabrá cuál de las dos
  creer. Lo mismo vale para el estado `PAGADO` del cargo: no se escribe.)_
- **§48** — Un pago es un **asiento** y se aplica **de lo más viejo a lo más
  nuevo**. _(El Artículo 7 del Acuerdo DOF 10-mar-1992 cuenta COLEGIATURAS
  vencidas —meses—, no pesos: saldar el mes corriente y dejar agosto abierto
  mantiene a la familia en riesgo de suspensión aunque haya pagado lo mismo. Y
  lo que sobra queda a favor, no se rechaza: una familia que paga por adelantado
  no se equivocó.)_
- **§49** — El `tsconfig.json` de cada paquete cubre **todo** su contenido
  —fuentes, pruebas y archivos de configuración— y la compilación vive en
  `tsconfig.build.json`. _(Con las pruebas fuera del proyecto, `pnpm typecheck`
  ni las miraba: al incluirlas en el Sprint 5 aparecieron errores de tipo que
  llevaban ahí desde el Sprint 1. Además obligaba a mantener una lista de
  excepciones en el linter cuyo tope se alcanzaba cada vez que alguien agregaba
  una prueba.)_
- **§50** — Las pruebas de extremo a extremo verifican lo que **solo un
  navegador puede verificar** —que la cookie httpOnly viaje, que la pantalla se
  arme con datos reales, que no scrollee de lado a 360 px— y no repiten lo que
  ya cubren las pruebas del API. _(Duplicar cobertura en la capa más lenta y más
  frágil es como una suite deja de correrse. Y se preparan solas: sembrar y
  generar datos a mano antes de correrlas es una instrucción que alguien va a
  olvidar, y entonces se culpa a la prueba en vez de al defecto.)_
- **§51** — Toda regla legal que acote el cobro se declara **por vertical**, y el
  ámbito vive en el dominio junto con la regla (`marco-legal.ts`), nunca en la
  pantalla. El Acuerdo DOF 10-mar-1992 alcanza a los particulares con RVOE de
  educación básica y normal: en nuestro modelo, al vertical `COLEGIO`. A una
  universidad, una academia o un taller **no** se les impone su ventana de
  gracia, su aviso de 60 días ni su umbral de suspensión. _(Aplicar la ley "por
  si acaso" suena prudente y no lo es: le impone al cliente obligaciones que su
  contrato no tiene y encima le afirma en pantalla que son la ley. Eso es
  informarle mal sobre su propia obligación legal. El mapeo vertical→ámbito es
  inferencia nuestra y está marcada como tal en el módulo: el día que exista una
  academia con RVOE de básica habrá que preguntar por el RVOE del plantel.)_
- **§52** — El contador del Artículo 7 cuenta **colegiaturas, no adeudos**. Un
  concepto declara si lo es (`esColegiatura`) y nace en `false`: el sistema no
  adivina cuál de los cobros mensuales de una escuela es la colegiatura y cuál
  el comedor. _(De los dos errores posibles, contar de menos cuesta dinero —la
  escuela no suspende cuando podría— y contar de más cuesta una multa —suspende
  cuando la ley todavía no se lo permite—. El defecto real: hasta el Sprint 5
  tres excursiones impagas empujaban a una familia al umbral de suspensión sin
  deber una sola colegiatura.)_
- **§53** — Las funcionalidades **legalmente prohibidas no se construyen**, ni
  desactivadas, ni detrás de una bandera: retener documentos por adeudo (LGE
  art. 146 y 170-XXII, multa de 1,001 a 7,000 UMA) y exhibir morosos (Acuerdo
  9.º). Ninguna exportación ni notificación grupal puede identificar a un alumno
  por su adeudo. _(Una casilla apagada es una invitación encendida: alguien la
  prende un lunes de corte y la multa la paga el cliente.)_
- **§54** — Ningún dato de incumplimiento de pago sobrevive **72 meses**
  (LFPDPPP 2025, art. 10). _(Un alumno pasa seis años en primaria: cualquier
  "historial completo de pagos" viola la ley por construcción. Se escribe ahora
  aunque la purga se implemente en el sprint de reportes, porque el dato que hoy
  se acumula es el que mañana hay que borrar.)_
- **§55** — El **orden de aplicación del dinero se declara y se prueba**:
  prorrateo → beca → descuento, cada uno sobre lo que quedó. _(Con una beca del
  50 % y un pronto pago del 10 %, en cascada la familia paga el 45 % del precio
  de lista; sumando los porcentajes pagaría el 40 %. Sobre una colegiatura de
  2,450 son 122.50 pesos AL MES. Lo caro no es elegir mal: es que dos partes del
  sistema elijan distinto y el corte no cuadre sin que nadie sepa explicarlo. El
  prorrateo abre la fila porque no es un descuento — fija el precio real de lo
  que se cobra, y aplicar la beca antes becaría días que el alumno no estuvo.)_
- **§56** — Una **beca es un asiento, no un campo** en el cargo, y lleva
  **motivo obligatorio**. El cargo conserva su precio de lista y el descuento se
  registra encima. _(Un cargo de 2,205 y nada más no puede contestar "¿por qué
  2,205 y no 2,450?". Y la beca del 5 % de la matrícula es obligación legal —LGE
  art. 149-III, LGES art. 70—, no cortesía: una autoridad puede pedir a quién se
  otorgó y con qué criterio, y "el monto ya venía rebajado" no es prueba. El
  CHECK del motivo está en la base, no solo en el servicio.)_
- **§57** — El **prorrateo solo se aplica DENTRO del periodo**. Si la fecha de
  alta es posterior al periodo, se cobra completo. _(La fecha de alta es cuando
  el alumno entró a NUESTRO SISTEMA, no a la escuela. Una escuela que migra en
  noviembre y genera los cargos de agosto a octubre tiene a todos sus alumnos
  con alta de noviembre: prorratear ahí dejaría el trimestre en CERO, sin un
  solo error, y perdería un trimestre de ingresos sin enterarse hasta el corte.
  El error contrario —cobrarle agosto a quien llegó tarde— lo reclama la familia
  el mismo día. Entre un fallo silencioso que cuesta dinero y uno ruidoso que se
  corrige en un minuto, se elige el ruidoso. Tampoco se prorratea un concepto
  UNICO: una inscripción cuesta lo que cuesta.)_
- **§58** — Una **cuota voluntaria solo genera cargo a quien la aceptó**, y no
  puede marcarse como colegiatura. _(El Acuerdo DOF 10-mar-1992, arts. 3 y 5-III,
  prohíbe condicionar el servicio educativo a un pago voluntario. Generarle una
  "cooperación" a los 400 alumnos de golpe la vuelve obligatoria de hecho, por
  más que la etiqueta diga otra cosa. Y voluntaria + colegiatura es la
  combinación que convierte dos reglas correctas en una ilegal: contaría para el
  Artículo 7 y acercaría a la familia a la suspensión por no pagar algo que la
  ley dice que es opcional.)_
- **§59** — Una **regla que no se puede satisfacer es un defecto**, por correcta
  que sea. Todo gate que exija un dato nace con la pantalla donde capturarlo.
  _(El catálogo rechaza crear un concepto deducible sin el RVOE de su nivel. Sin
  la pantalla de datos fiscales, ese gate deja de proteger y se vuelve un muro:
  la escuela no puede avanzar y no sabe por qué. Lo mismo con las aceptaciones
  de cuota voluntaria — sin dónde registrarlas, marcar una cuota como voluntaria
  la vuelve incobrable en silencio.)_

- **§60** — **Ninguna prueba puede depender del día en que se corre.** Toda
  fecha de una siembra se escribe explícita; `now()` queda prohibido en datos
  que después se comparan contra importes o periodos esperados.
  _(Descubierto el 4-sep-2026, al primer despliegue. Las pruebas de cableado de
  cobranza sembraban `alta_en = now()` y afirmaban los importes del periodo
  `2026-09`. Mientras la fecha real quedó fuera de septiembre, el prorrateo
  (§57) no entraba y todo cuadraba. El 1 de septiembre siguió verde por un
  centímetro —`alta = inicio del periodo` devuelve el cargo completo— y del 2 en
  adelante se puso roja sola, sin que nadie tocara una línea. El código estaba
  bien; la prueba afirmaba algo sobre el calendario, no sobre el sistema.)_
  _**Consecuencia que duele:** el acta del Sprint 6 declaró «270 pruebas
  verdes» el 2-sep. Ese número no pudo medirse ese día. Se reportó de memoria,
  que es justo lo que §7 prohíbe. La regla ya existía; lo que faltó fue
  cumplirla._
  _**Corolario:** un camino que solo se ejercita por accidente no está cubierto.
  El prorrateo se «probaba» en cableado por el efecto secundario de `now()`;
  al fijar las fechas quedó al descubierto que no tenía prueba de cableado
  propia (§13 exige tres: pura, NO-camino y cableado). Ahora la tiene._

- **§61** — **Las fechas del dominio de dinero se resuelven en la zona horaria
  de la escuela, no en UTC.** _(HALLAZGO ABIERTO, no corregido: `alta_en` es
  `timestamptz` y el generador hace `.toISOString().slice(0,10)`, que es UTC.
  Para una escuela en el centro de México (UTC−6), un alta capturada el 31 de
  agosto a las 19:00 se guarda como 1 de septiembre. Eso corre el prorrateo un
  día y, en el borde de mes, puede mover un cargo de periodo. El impacto medido
  hoy es de pesos, no de miles, y arreglarlo toca el generador — por eso se
  registra para decisión en gate (§8) en vez de colarse en un arreglo de
  pruebas.)_

- **§62** — **La cookie de sesión viaja `SameSite=None` en producción, y a cambio
  todo `POST` exige `Content-Type: application/json`.** Lo segundo no es un
  detalle: es lo que sustituye a la defensa que se pierde con lo primero.
  _(Defecto encontrado el 4-sep-2026 al probar el despliegue en el navegador. En
  local la web —3010— y el API —3333— son el MISMO sitio, `localhost`, así que
  una cookie `Lax` viaja y todo funciona. En la nube son `vercel.app` y
  `onrender.com`: sitios distintos. El navegador guardaba la cookie y no la
  reenviaba, así que el login respondía `200` y la petición siguiente `401`.
  **Entrabas y te expulsaba al instante.** Siete sprints de pruebas verdes no
  podían verlo porque el defecto no está en el código sino en la diferencia
  entre dos entornos.)_
  _**Lo que se pierde y por qué se compensa así:** `Lax` era la defensa CSRF de
  base. Con `None` la cookie sí viaja en peticiones de terceros, y lo único que
  queda es el preflight del CORS — que solo ocurre si la petición NO es
  "simple". Un `POST` con `x-www-form-urlencoded`, `multipart/form-data` o
  `text/plain` es simple y NO lleva preflight; **se comprobó contra el API
  desplegado que uno así respondía `200` desde un origen ajeno**. Exigir
  `application/json` obliga al preflight, donde el CORS rechaza por origen._
  _**Por qué el encabezado y no el contenido:** "solo parseamos JSON" no cierra
  nada, porque hay endpoints que mutan SIN cuerpo (`/becas/:id/retirar`,
  `/mis-avisos/:id/leido`). A esos les bastaría un POST vacío._
  _**Dónde vive:** en el módulo, no en `main.ts` — una defensa que solo existe
  en producción es una defensa que nadie prueba. Verificado por mordida: al
  desactivarla, 3 pruebas se ponen rojas._
  _**La solución buena, para cuando haya dominio propio:** `app.azahar.mx` +
  `api.azahar.mx` devuelven a los dos al mismo sitio registrable y permiten
  volver a `Lax`. Es compra del CEO._

- **§63** — **El panel de morosidad deriva del precio NETO, no del de lista.**
  Un descuento de emisión (prorrateo, beca) reduce lo que se debe; uno de pronto
  pago salda la parte de un pagador y cuenta como cobrado. Los dos se restan, y
  no son lo mismo.
  _(Defecto encontrado el 4-sep-2026 probando staging con datos reales. Un
  alumno con alta el 15 de septiembre llevaba $1,540 de prorrateo. Su estado de
  cuenta —la pantalla de la FAMILIA— lo restaba bien y pedía $6,660. El panel de
  cobranza —el de la ESCUELA— decía $8,200, porque sumaba `cargo.monto`, que por
  diseño guarda el precio de lista (§43): los descuentos viven como asientos
  aparte justamente para poder explicarlos. **Dos pantallas hablando del mismo
  dinero sin coincidir, y la equivocada era la que le dice a la escuela a quién
  perseguir.** El total del panel también iba $1,540 alto.)_
  _**Por qué ninguna prueba lo vio:** las de morosidad usaban cargos sin ningún
  descuento, así que lista y neto coincidían y el defecto era invisible. La
  invariante `I1` tampoco lo alcanzaba: verifica que `Σ partes` cuadre con los
  descuentos, y morosidad no leía las partes. Ahora hay una prueba que compara
  el saldo del panel contra el neto de un alumno prorrateado, verificada por
  mordida (sin el arreglo reporta 7350.00 en vez de 6533.33)._
