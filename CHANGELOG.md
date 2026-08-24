# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) · Versionado: [SemVer](https://semver.org/lang/es/).

Se escribe desde el primer commit, no al final: reconstruir la historia despues
es caro; anotarla por release es gratis.

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
