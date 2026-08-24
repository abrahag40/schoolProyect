# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) · Versionado: [SemVer](https://semver.org/lang/es/).

Se escribe desde el primer commit, no al final: reconstruir la historia despues
es caro; anotarla por release es gratis.

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
