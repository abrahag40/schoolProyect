# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) · Versionado: [SemVer](https://semver.org/lang/es/).

Se escribe desde el primer commit, no al final: reconstruir la historia despues
es caro; anotarla por release es gratis.

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
