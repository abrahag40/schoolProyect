# Prompt para la siguiente sesión

> Copiar y pegar tal cual al abrir la sesión. Está escrito para que el agente no
> tenga que reconstruir contexto ni pueda ampliarse solo.

---

Sprint 9. Objetivo único: **rediseñar la capa de navegación de la web sobre el
catálogo de flujos, y estandarizar el diálogo.** No se toca el dominio, ni el
API, ni el contenido de las pantallas.

**Lee primero, en este orden:**

1. `CLAUDE.md` — completo. Presta atención a «Los flujos son la fuente del
   diseño» y a «Precisión del trabajo por sesión».
2. `docs/ux/flujos.md` — los 42 flujos y las cinco exigencias que le imponen al
   layout. Es la vara.
3. `docs/adr/ADR-013-armazon-de-metronic.md` — por qué el armazón es el del
   demo1, y sus dos defectos aceptados.
4. `docs/adr/inventario-metronic.md` — qué código NO escribimos nosotros.

**El alcance, cerrado. Cinco entregables y ni uno más:**

| ID        | Qué                                                                                     | MoSCoW |
| --------- | --------------------------------------------------------------------------------------- | ------ |
| `AZ-D3.1` | `Dialogo` propio con el patrón del W3C ARIA APG, y los dos diálogos existentes migrados | Must   |
| `AZ-D3.2` | Navegación derivada del rol: el menú se arma de los permisos, no de una lista fija      | Must   |
| `AZ-D3.3` | El panel lateral en móvil recupera su botón de cerrar                                   | Must   |
| `AZ-D3.4` | Panel de inicio distinto por rol (dueño · cobranza · docente)                           | Must   |
| `AZ-D3.5` | Menú de perfil con los destinos que de verdad existan                                   | Should |

**Lo que NO entra en esta sesión, y si aparece va al gate de §8:** los flujos del
ciclo del alumno (`AZ-F2.*`), el pago en línea, la mensajería, y cualquier
pantalla nueva de negocio.

**Definición de terminado, por entregable:**

- Recorrido como usuario, no como autor: entrar, hacer la tarea, salir.
- Las tres preguntas contestadas en cada pantalla tocada: ¿cómo se cierra esto? ·
  ¿qué ve aquí un rol SIN permiso? · ¿se parece a lo que dijimos?
- Prueba de navegador con **mordida verificada** por cada regla nueva.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check` y la suite sin caché
  (`npx turbo run test --concurrency=1 --force`).
- Cierre de avance completo: commit **y push**, en el mismo acto. El despliegue
  es ejecución aparte.
- **Nunca `git add -A` ni `git add .`** Se nombran los archivos, y antes de
  commitear se lee `git diff --cached --name-only` entero. **Este directorio
  contiene material personal que no es del proyecto** (carpetas `monica*`, ya
  ignoradas) y el repositorio es **público**.

**Contexto operativo que ya está resuelto y no hay que redescubrir:**

- Staging: https://azahar-web-neon.vercel.app · `colegio-azahar` /
  `directora@colegioazahar.mx` / `azahar-demo-2026`. El API de Render duerme: la
  primera petición puede tardar ~50 s y **no es un fallo**.
- Desplegar es `cd apps/web && npx vercel deploy --prod --yes`. Existe
  `.vercelignore` porque el CLI **no lee** `.gitignore`.
- Los clics sintéticos del navegador integrado **no disparan los manejadores de
  React** en esta app. Para probar interacción, Playwright.
- Medir anchos con JavaScript desde el navegador da valores un paso por detrás:
  el compositor no avanza durante la evaluación. Usar Playwright o una captura.
- Roles reales: `DUENO` `DIRECTOR` `ADMIN` `COBRANZA` `DOCENTE` `STAFF` `TUTOR`.
  Grupos de permiso en el API: `ROLES_COBRANZA`, `ROLES_TODA_LA_ESCUELA`,
  `ROLES_PASE_LISTA`, `ROLES_DATOS_FISCALES`.

**Dos decisiones del CEO siguen pendientes** y no las tomes tú: qué hacer con los
15 MB de arte licenciado que quedaron en el historial de git, y si la validación
compartida de formularios (`react-hook-form` + zod, `AZ-D2.10`) entra a este
sprint o va al backlog.

Empieza proponiendo el Sprint Goal en una frase y el orden de los cinco
entregables, con su porqué. No escribas código hasta que lo apruebe.
