# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) · Versionado: [SemVer](https://semver.org/lang/es/).

Se escribe desde el primer commit, no al final: reconstruir la historia despues
es caro; anotarla por release es gratis.

## [0.6.0] — 2026-08-25 — Sprint 5: Estado de cuenta y morosidad

Objetivo: que la familia vea **exactamente lo que debe y por qué**, que la
escuela vea **quién le debe y desde cuándo** sin exportar a Excel, y que un pago
registrado a mano se aplique al pagador correcto sin ambigüedad.

**Cambio C2 trazado:** el Plan Maestro especificaba "Cobranza II: dinero real"
(pago en línea + conciliación + POC Facturama). Se sustituyó porque el pago en
línea depende de tres cosas inexistentes —decisión de proveedor, cuenta de
comercio y staging, ya que un webhook no llega a `localhost`—. Este sprint
recupera además el estado de cuenta (M4.5), que el Plan comprometía en el S4.

### Agregado

- **Estado de cuenta de la familia (AZ-M4.5)** — pantalla 2 de la matriz D10.
  Cada pagador ve **su parte**, no el total: mostrarle $2,450 a quien paga el
  60% lo invita a pagar de más. Con desglose a la vista —el "por qué" no puede
  estar detrás de un enlace— y la fecha real sin recargo dicha, no deducida.
- **Panel de morosidad (AZ-M4.8)** — pantalla 5. Los tres números arriba y
  juntos, y **la lectura legal ya hecha**: el panel dice si el Artículo 7 ya
  permite suspender el servicio, cuántos meses faltan si aún no, y recuerda que
  hacen falta 15 días de aviso y que el alumno conserva su documentación.
- **Registro manual de pagos (AZ-M4.9)**, aplicado **de lo más viejo a lo más
  nuevo**: los meses vencidos —no los pesos— son lo que la ley cuenta. Lo que
  sobra queda a favor de la familia en vez de rechazarse.
- **Recargo por mora (AZ-M4.6a)** calculado sobre la fecha límite que ya venía
  congelada en cada cargo desde el S4. No hay forma de cobrarlo antes: el dato
  no lo permite.

### Corregido

- **`pnpm typecheck` no miraba las pruebas.** Estaban fuera del `tsconfig` de su
  paquete, así que nunca se les comprobaron los tipos. Al incluirlas aparecieron
  errores que llevaban ahí desde el Sprint 1. Ahora cada paquete tiene un
  proyecto que cubre todo su contenido y la compilación va en
  `tsconfig.build.json` (§49).
- **Dos defectos de la pantalla de morosidad, vistos en el navegador y no
  supuestos:** los importes se desbordaban de sus tarjetas a 360 px —y la página
  scrolleaba de lado—, y una familia sin pagadores registrados mostraba
  "Paga:" seguido de nada. Ahora los tres números caben, los importes llevan
  separadores de millar y el vacío se dice ("Sin pagador registrado").

### Seguridad y datos

- Dos tablas nuevas (`pago`, `aplicacion_de_pago`) con RLS habilitado y forzado,
  más pruebas de aislamiento: no se puede registrarle un pago a un tutor de otra
  escuela ni con su identificador en la mano.
- **El vínculo tutor–alumno se comprueba siempre** en el estado de cuenta: RLS
  no separa a dos familias de la misma escuela, eso lo hace el `WHERE`.
- Restricciones en la base: un pago de cero o negativo no entra, y cancelar
  exige motivo.

### Documentación

- `docs/sprints/S5-estado-de-cuenta.md` — Sprint Backlog con el cambio C2.
- Decisiones §47–§49.
- **Revisión del Plan Maestro v1.2**: comprometido contra entregado sprint por
  sprint, avance por épica, y la brecha de alcance de S3 y S4 reconocida.

## [0.5.0] — 2026-08-25 — Sprint 4: El dinero

Objetivo: que cada escuela defina **qué cobra y a quién**, y que el sistema
genere los cargos del mes sin que nadie los teclee — con la ventana de diez días
naturales sin recargo del Artículo 4 escrita en el dominio, no en una casilla de
configuración que cualquiera puede mover.

### Deuda vencida, PAGADA

- **ESLint real en todo el monorepo.** Se declaró "entra en S1" y llevaba tres
  sprints; `pnpm lint` imprimía verde ejecutando solo el gate de tokens. Ahora
  corre con **información de tipos** —sin eso `no-floating-promises` queda
  apagada de hecho— y **§28 dejó de ser un documento**: construir un
  `PrismaClient` fuera de `packages/db` rompe el gate.
- **Encontró 65 hallazgos.** Dos defectos reales de React (`setState` síncrono
  dentro de un efecto, que encadena renders), ocho manejadores `async`
  entregados a props que esperan `void` —donde un rechazo se pierde en
  silencio— y cuarenta contaminaciones de `any` con un solo origen:
  `response.json()`. Se resolvieron creando **una frontera de confianza por
  superficie** (`apps/web/app/api.ts`, `apps/mobile/api.ts`), no apagando reglas.
- **Se verificó que el gate muerde:** se inyectó a propósito el despacho de
  avisos sin `await` y el pipeline se puso rojo señalando la línea exacta.
- Se retiraron también los `echo` que fingían pruebas en `apps/web`,
  `apps/mobile` y `packages/ui`. No crea cobertura, pero `pnpm test` deja de
  reportar como exitosos tres paquetes sin una sola prueba.

### Agregado

- **Catálogo de cargos (AZ-M4.1)** — pantalla 8 de la matriz D10. Conceptos con
  periodicidad, importe, día de vencimiento, alcance por cohorte y **bandera
  deducible con nivel educativo** para el complemento IEDU.
- **Generación de cargos (AZ-M4.2)**, idempotente por clave
  `{alumno}:{concepto}:{periodo}` impuesta por la base. Correrla dos veces
  devuelve `generados: 0`. Un concepto de periodicidad única se ancla al ciclo
  escolar, no al mes pedido: anclarlo al mes lo cobraría doce veces al año.
- **Reparto entre pagadores (AZ-M4.3)** por el método del resto mayor, con la
  invariante probada de que **la suma de las partes es exactamente el total**.
  El reparto se **congela** al generar: un convenio nuevo en marzo no reescribe
  lo que cada quien debía en enero (§44, ADR-011).
- **Las reglas mexicanas, en el dominio (AZ-M4.4).** El Artículo 4 impone que la
  fecha límite sin recargo nunca sea anterior al día 10; la configuración de la
  escuela solo puede ser más generosa. El Artículo 5-I rechaza un ajuste de
  precio con menos de 60 días de aviso, y el mensaje dice cuántos faltan.

### Corregido

- **La generación devolvía CERO cargos en silencio** cuando el concepto entraba
  en vigor a mitad de mes — que es justo lo que pasa cuando el ciclo escolar
  arranca el 17 de agosto. La escuela no habría cobrado su primer mes y nadie
  habría visto un error. Cazado en la demo, no por una prueba: las pruebas
  usaban un ciclo que empezaba el día 1. Ya tiene su prueba de regresión, en
  ambos sentidos.

### Seguridad y datos

- Tres tablas nuevas (`concepto_cargo`, `cargo`, `parte_de_cargo`) con RLS
  habilitado y forzado, más pruebas de aislamiento propias: no se puede
  facturarle a un alumno de otra escuela ni con su identificador en la mano.
- **Reglas que viven en la base**, porque una importación o un script pueden
  escribir sin pasar por el dominio: un concepto deducible sin nivel educativo
  no entra; un cargo cancelado sin motivo tampoco; una fecha límite anterior al
  vencimiento tampoco.

### Documentación

- `docs/sprints/S4-cobranza.md` — Sprint Backlog con la plantilla de 10 campos.
- ADR-011 — representación del dinero y reparto, con lo que deliberadamente NO
  se puso en la base y por qué.
- Decisiones §43–§46.

### Infraestructura

- **Se reparó el entorno de Docker desde la terminal.** Diagnóstico: el disco
  del Mac estaba al 100% (133 MB libres de 228 GB), lo que colgó a Docker
  Desktop y corrompió su almacén de imágenes a media escritura. Se liberaron
  ~17 GB de cachés regenerables (npm, build de Docker, artefactos del repo) y se
  reinició el demonio en limpio. `pnpm ensayo:despliegue` vuelve a pasar: 8/8
  migraciones y 21 tablas con RLS forzado en una base vacía.

## [0.4.0] — 2026-08-24 — Sprint 3: La operación diaria

Objetivo: que el docente tome asistencia desde su teléfono en menos de 30
segundos y que, cuando un alumno acumula faltas, **su familia reciba el aviso en
la app sin que nadie lo escriba a mano**.

### Agregado

- **Pase de lista (AZ-M3.1):** pantalla móvil-primero con "Todos presentes" en
  un toque —el caso del 90% de los días—, controles de 44 px y guardado único al
  final. El estado seleccionado se marca con grosor y símbolo, no con color: el
  color nunca porta solo el significado (WCAG 2.2 SC 1.4.1).
- **Asignación docente↔cohorte (AZ-M3.2):** tabla y no columna, porque existe la
  co-docencia y las academias con entrenador y auxiliar. Una docente ve solo sus
  grupos; dirección y administración ven todos.
- **Motor de avisos automáticos (AZ-M5.1):** al guardar la lista, la falta
  genera aviso a **todos** los tutores con acceso a la app —enterarse de que su
  hijo faltó es de la crianza, no de la cobranza— y al alcanzar el umbral se
  suma el aviso acumulado, que dice **cuántas** faltas lleva. Ese número es el
  mecanismo con evidencia (Rogers & Feller 2018), no un adorno.
- **Bandeja de avisos de la familia (AZ-M5.2):** `GET /mis-avisos` y su sección
  en el home de la app, con marcar-leído. Existe porque el push puede no llegar
  —permisos, app cerrada, iOS sin cuenta de desarrollador— y un aviso que solo
  vive en el push se pierde sin dejar rastro.
- **Parámetros de asistencia por escuela (AZ-M3.3):** umbral, ventana, si se
  avisa la falta del día y **zona horaria**. México tiene varias zonas y el
  servidor corre en UTC: calcular "hoy" con la hora del servidor marcaría la
  falta del día equivocado en las escuelas del noroeste.
- **Ensayo de despliegue (`pnpm ensayo:despliegue`):** construye la imagen,
  arranca contra una base **vacía**, comprueba que migra sola y que el esquema
  desplegado conserva el aislamiento. No sustituye a staging y lo dice en su
  propia salida.

### Corregido

- **El arranque en una base vacía moría** (`ERR 3F000`): `ensure-app-role`
  buscaba funciones con un cast a `regnamespace` sobre el esquema `plataforma`,
  que en una base nueva todavía no existe. Es decir: **el primer despliegue a la
  nube habría fallado**. Cazado por el ensayo de despliegue, antes de que
  existiera la cuenta de Neon.
- **`pnpm dev` del API no arrancaba con Node 25:** el type-stripping no resuelve
  un import `.js` a su hermano `.ts` ni emite `emitDecoratorMetadata`, así que
  la inyección de dependencias de Nest habría fallado solo en desarrollo. Ahora
  desarrollo usa el mismo compilador que la imagen de producción (§41).
- **El mensaje al guardar decía "familias" cuando contaba avisos.** Una alumna
  con tres tutores que además cruza el umbral produce seis avisos, no seis
  familias. Una cifra falsa en la pantalla del docente es un dato que después
  nadie vuelve a creer.

### Seguridad

- Cuatro tablas nuevas (`asistencia`, `asignacion_docente`, `notificacion`,
  `configuracion_escuela`) con RLS habilitado y forzado, más pruebas de
  aislamiento propias: no se puede registrar la falta de un alumno de otra
  escuela ni con su identificador en la mano.
- **Frontera de grupo, que RLS no cubre:** marcar a un alumno que no pertenece
  a la cohorte se rechaza en la aplicación. Son del mismo tenant, así que la
  base los dejaría pasar.
- Marcar un aviso como leído filtra por `usuarioId`: dos familias de la misma
  escuela no se tocan entre sí.

### Documentación

- `docs/sprints/S3-operacion-diaria.md` — Sprint Backlog con la plantilla de 10
  campos. Nuevo: los sprints ahora dejan su backlog en el repo.
- ADR-010 (outbox transaccional, con los disparadores para cambiar a una cola).
- Decisiones §39–§42.
- **Corrección de evidencia:** el impacto de las alertas se citó en el cierre
  del Sprint 2 como "+17% asistencia / −38% reprobación". Las cifras verificadas
  contra la fuente son **+12% y −27%** (Bergman & Chan 2021, JHR 56(1)).

### Pendiente declarado

- **Push en dispositivo físico:** la tubería está probada contra el proveedor
  simulado y el registro de dispositivos es real, pero ningún teléfono ha
  recibido todavía un aviso. Requiere build de EAS.
- **Home de la familia con avisos:** compila y consume un contrato verificado
  por pruebas, pero no se ha ejecutado en un dispositivo ni en un emulador.
- **Staging:** sigue bloqueado por las tres cuentas de nube.

### Deuda vencida NO pagada (incumplimiento)

- **ESLint sigue sin existir** en `apps/api`, `apps/web`, `apps/mobile` y
  `packages/db`. Se declaró "entra en S1"; van tres sprints. `pnpm lint`
  imprime verde porque el único gate real que corre es el de tokens. Un check
  verde que no revisa nada es peor que no tenerlo: da una garantía falsa
  (§6). **Corrección de registro:** el cierre del Sprint 2 reportó "cero deuda
  declarada abierta"; era falso — se contaron las deudas de diseño y sesión, y
  se pasó por alto ésta.

## [0.3.0] — 2026-08-24 — Sprint 2: La app de familias

Objetivo: que quien entre a la app móvil sea una **madre o un padre**, no un
empleado de la escuela; que vea a sus hijos; y que la sesión de la web deje de
ser robable por un script.

### Agregado

- **Acceso de tutores (AZ-M6.1):** rol `TUTOR` y endpoint `GET /mis-hijos`.
  Devuelve los hijos de quien pregunta con su grupo, sede, escuela, parentesco
  y si es pagador. Un tutor de otra escuela ve a otra familia con el mismo
  correo; el personal recibe 403 — ver a todos los alumnos jamás debe salir por
  la puerta de "mis hijos".
- **Home de la familia en móvil:** una tarjeta por hijo, con el vocabulario de
  su vertical (Grupo / Categoría / Nivel), etiquetas de accesibilidad y
  deslizar-para-refrescar.
- **Sesión persistente con biometría:** quien ya entró no vuelve a teclear su
  contraseña; el teléfono confirma que es la misma persona. Si el dispositivo
  no tiene sensor, se continúa sin bloquear en lugar de dejar a alguien fuera
  de ver a su hijo.
- **Tubería de notificaciones (AZ-M5.3, cimiento):** tabla de dispositivos por
  persona (una familia usa varios teléfonos), registro en cada arranque —los
  tokens rotan y un registro viejo deja a la familia sin avisos, sin error
  visible—, envío de prueba y baja automática de tokens muertos. Puerto
  `Mensajero` con proveedor `simulated` por defecto (§18).

### Seguridad

- **DEUDA DEL SPRINT 0 PAGADA:** la sesión de la web pasó de `sessionStorage` a
  **cookie httpOnly + SameSite=Lax**. Verificado en el navegador: JavaScript no
  puede leerla. Se agregó `POST /auth/logout`, porque con cookie httpOnly el
  cliente ya no puede borrarla solo. La app móvil sigue con encabezado y
  `SecureStore`: cada superficie usa el mecanismo seguro de su plataforma.
- Tabla nueva `dispositivo_push` con RLS forzado, como toda tabla de negocio.

### Corregido

- **Los errores de validación devolvían 500 en vez de 400.** Un 500 miente
  sobre de quién es la culpa, ensucia el monitoreo (si la mitad de las alertas
  son datos mal escritos, nadie vuelve a mirarlas) y no le dice al cliente qué
  corregir. Ahora responden 400 con el detalle campo por campo, en lenguaje de
  persona. Detectado al probar la tubería de notificaciones.

### Documentación

- **Pre-diseño D10 entregado** (deuda del Sprint 1): matriz maestra de las 8
  pantallas críticas con su objetivo de pasos, wireframes de baja fidelidad de
  las cuatro más importantes, y las 7 reglas comunes de interfaz.
- Protocolo de cierre de sprint en `CLAUDE.md`, con la precisión de que el
  Daily es diario y lo que cierra el sprint son Review y Retrospectiva.

### Pendiente declarado

- **Push en dispositivo físico:** la tubería está completa y probada por efecto
  contra el proveedor simulado, pero la entrega real a un teléfono exige un
  build de EAS (y cuenta de Apple Developer para iPhone). Lo simulado engaña si
  nunca se prueba contra lo real: queda como validación pendiente, no como
  hecho.
- **Despliegue a staging:** sigue bloqueado por las cuentas de nube.

## [0.2.0] — 2026-08-24 — Sprint 1: Comunidad y plataforma

Objetivo: que el modelo de datos sea multi-vertical de verdad (no un colegio
con excepciones), que los consentimientos nazcan como los exige la ley de 2025,
y que exista el cimiento de la consola de ZaharDev (cambio C1).

### Agregado — operación de las escuelas

- **Cohorte, el átomo multi-vertical (AZ-M3.1, §9):** un grado de primaria, una
  categoría sub-12 y un nivel B1 de idiomas son la misma entidad. El `Periodo`
  que las contiene es ciclo escolar, temporada o inscripción continua. La
  interfaz habla el idioma de cada vertical leyendo el mismo dato.
- **Personas y familias (AZ-M2):** alumnos, tutores e inscripciones. El vínculo
  tutor–alumno soporta **multi-pagador con porcentaje** (dos padres que dividen
  60/40) y separa quién paga de quién puede recoger — el "tercer pagador" que
  las reseñas del sector piden y ningún competidor modela.
- **Roles múltiples (AZ-M1.3):** el rol pasó de columna a tabla. Una misma
  persona administra, da clase y cobra sin necesitar tres cuentas. La migración
  preserva los roles ya existentes.
- **Consentimientos por finalidad (AZ-M2.5, §10):** aviso de privacidad
  versionado (hay que poder probar qué texto exacto aceptó cada tutor) y
  consentimiento separado por finalidad, con evidencia de canal y fecha. Las
  voluntarias se pueden rechazar sin perder el servicio educativo.
- **Bitácora append-only (AZ-M1.4, §12):** reglas de base de datos que hacen
  que `UPDATE` y `DELETE` sobre la bitácora no tengan efecto — ni siquiera para
  la aplicación. "Append-only" dejó de ser una convención.

### Agregado — plataforma ZaharDev (C1 / ADR-008)

- **Esquema `plataforma` separado**: clientes, suscripciones, socios,
  membresías y eventos de negocio. Sin RLS de tenant a propósito (su dueño es
  ZaharDev), con su propia frontera de aplicación.
- **Guard de plataforma**: la membresía se resuelve **por correo** y se
  consulta en cada petición. Ser DUEÑO de una escuela no da acceso a la
  cartera; dar de baja a un miembro le corta el acceso al instante, sin esperar
  a que expire su token.
- **`GET /plataforma/panel`**: MRR, estado de la cartera y clientes. El **socio
  ve solo su cartera** — no es un filtro de interfaz: la consulta no alcanza
  clientes de otro socio.
- **Reglas BI-ready aplicadas (§37):** eventos con las cuatro coordenadas
  (tenant, actor, `timestamptz`, tipo), dinero en `Decimal` serializado como
  cadena para no perder centavos, y hechos en columnas tipadas.

### Seguridad

- 10 tablas nuevas nacen con RLS forzado y política de aislamiento; el gate
  recorre `pg_class` y se pone rojo si alguna falta.
- Segunda función `SECURITY DEFINER` de superficie mínima
  (`plataforma.escuelas_de_clientes`) para que la consola lea nombres de
  escuela sin abrir la tabla ni usar credenciales privilegiadas.
- 47 pruebas en verde (11 tokens, 15 base de datos, 21 API).

### Pendiente declarado

- **Pre-diseño (D10):** la matriz maestra de las 8 pantallas críticas y sus
  wireframes no se produjeron en este sprint. Se reprograma con el resto del
  alcance en la recalibración del CHECKPOINT T1.
- **Despliegue a staging** (parte de C1): sigue bloqueado por la creación de
  las cuentas de nube — acción administrativa del CEO (ver `docs/operacion/INFRA.md`).
- La deuda del token de sesión en `sessionStorage` sigue abierta; vence al
  cierre de la tanda.

## [0.1.0] — 2026-08-23 — Sprint 0: Fundaciones

Objetivo del sprint: que el esqueleto ande de punta a punta y que el aislamiento
entre escuelas este probado, no prometido.

### Agregado

- **Monorepo** Turborepo + pnpm con tres superficies (`apps/web`, `apps/api`,
  `apps/mobile`) y cinco paquetes (`tokens`, `ui`, `db`, y los que llegaran).
  Versiones de toolchain fijadas; TypeScript 5.9.3 unico para todo el repo.
- **Aislamiento multi-tenant (AZ-M1.1, ADR-004):** RLS de PostgreSQL con `FORCE`
  y politicas deny-by-default, rol de aplicacion `azahar_app` sin `BYPASSRLS`, y
  `conTenant()` que declara el tenant con `set_config(..., is_local => true)`
  dentro de la transaccion (seguro con pooling).
- **Gate de aislamiento:** 10 pruebas contra Postgres real con el rol
  restringido. Verificado que detecta la falla: al desactivar RLS en una tabla,
  5 pruebas se ponen rojas.
- **Sistema de diseno (D12, ADR-006):** tokens en formato W3C DTCG compilados
  con Style Dictionary a CSS (web) y objetos TS (React Native). Componentes
  propios en `packages/ui`. Public Sans y Phosphor (licencias libres).
- **API** NestJS 11 sobre ESM: `/salud` (sonda que consulta la base),
  `/auth/login` (Argon2id con parametros OWASP, JWT con el tenant dentro) y
  `/mi-escuela` protegido por guard deny-by-default.
- **Web** Next.js 16 con login y panel; ambos temas (claro/oscuro).
- **Movil** shell Expo con login, `SecureStore` para el token y lectura de los
  mismos tokens de diseno que la web.
- **CI** en tres capas bloqueantes: calidad (formato, lint, tipos, pruebas con
  base real), SCA (OSV-Scanner) y SAST (Semgrep).
- **Seed** con dos escuelas de verticales distintas (colegio K-12 y academia
  deportiva) en la misma instalacion: la prueba viva del modelo multi-vertical.

### Corregido (sobre la plantilla de referencia)

- **Contraste:** el azul de marca de la plantilla alcanza 2.63:1 contra blanco,
  insuficiente para WCAG 2.2 AA como texto y como fondo de boton con texto
  blanco. Se agrego la variante `primary-strong` (#0777B6, 4.86:1) y en tema
  oscuro el boton usa texto oscuro sobre el azul (6.74:1). Lo detecto un test
  de contraste automatizado, no el ojo.
- **Foco visible:** la plantilla no cambia el aspecto del campo enfocado
  (incumple SC 2.4.7). El tema define un anillo de foco global.
- **Meta viewport:** ausente en el primer intento; sin el la web no es
  responsive de verdad y los controles quedan bajo el area tactil minima.

### Decisiones tecnicas tomadas con evidencia

- **TypeScript 5.9.3 y no 7.x:** NestJS depende de `emitDecoratorMetadata`; se
  elige la linea probada con Prisma 7 y Next 16. Revisar con un spike en la
  frontera de tanda.
- **Prisma 7** saco la URL del esquema. Se aprovecho para separar credenciales:
  `prisma.config.ts` migra con el rol dueno, el runtime opera con el rol
  restringido.
- **Funcion `resolver_escuela_por_slug`** (SECURITY DEFINER, superficie minima):
  el login necesita resolver la escuela antes de tener contexto de tenant, y la
  tabla esta bajo RLS. Se resolvio sin abrir la tabla ni usar el rol dueno.
- **Puertos propios** (web 3010, api 3333, base 5434): la maquina de desarrollo
  ya corre otros proyectos en los puertos comunes.

### Deuda declarada (con dueno y vencimiento)

- **Token de sesion en `sessionStorage`** en la web: accesible desde JavaScript
  y por tanto expuesto a XSS. Debe migrar a cookie httpOnly + SameSite emitida
  por la API. Dueno: equipo. Vence: Sprint 1.
- **Despliegue a staging** pendiente: requiere cuentas de proveedor del CEO
  (accion administrativa, no de codigo).
- **Peer dependency** `react-native-worklets` fuera de rango en la cadena de
  Expo 57 / RN 0.86. No bloquea el shell. Revisar en S2.
