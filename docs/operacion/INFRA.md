# Runbook de infraestructura — Staging

Cómo dejar Azahar corriendo en la nube. Arquitectura (ADR-009):
**Neon** (Postgres) · **Render** (API en contenedor) · **Vercel** (web).

> ## ESTADO ACTUAL: RECURSOS CREADOS, PENDIENTE EL PRIMER DEPLOY (2-sep-2026)
>
> Las tres cuentas existen y los recursos están creados. **Falta un solo paso
> humano**: pegar tres secretos en Render, porque son credenciales y no las
> maneja el asistente.
>
> | Pieza        | Identificador                        | Estado                          |
> | ------------ | ------------------------------------ | ------------------------------- |
> | DB (Neon)    | proyecto `azahar` · `jolly-lake-32570910` | **Creada.** PG 16, AWS us-west-2 |
> | API (Render) | workspace `Azahar` · blueprint `azahar` | Configurado, sin desplegar      |
> | Web (Vercel) | proyecto `azahar-web`                | Configurado, sin desplegar      |
>
> **Por qué Postgres 16 y no 18:** es la versión con la que corren el desarrollo
> y `pnpm ensayo:despliegue`. Staging que no coincide con lo que se prueba es
> staging que miente (§41, en espíritu).
>
> **Por qué el deploy de Vercel espera al de Render:** `NEXT_PUBLIC_API_URL` se
> incrusta en el bundle en tiempo de compilación. Desplegar la web antes de
> conocer la URL del API hornearía `http://localhost:3333` dentro del JavaScript
> que se le sirve a las familias.
>
> ### Defecto de repositorio corregido de paso (2-sep-2026)
>
> La rama por omisión en GitHub seguía siendo **`sprint-0-fundaciones`**, de
> siete sprints atrás. Por eso Render y Vercel proponían esa rama al importar, y
> cualquiera que clonara el repo se llevaba el código del Sprint 0. Corregida a
> `main`.
>
> ### Para el CEO, no es una decisión del equipo
>
> **El repositorio es PÚBLICO.** Eso incluye `docs/`, con el Plan Maestro, los
> estudios de mercado, la comparativa con la competencia y las decisiones de
> negocio. No lo he cambiado porque hacerlo privado —o dejarlo público— es una
> decisión comercial tuya, no técnica.
>
> **Dominio propio:** no hay y no urge. Los subdominios gratis bastan para
> staging/beta. Se vuelve necesario cuando entre el correo transaccional (exige
> dominio verificado). Es compra del CEO (marca + tarjeta).

```
Vercel (web)  ──HTTPS──►  Render (API)  ──TCP/SSL──►  Neon (Postgres + RLS)
```

---

## Paso 1 — Neon (Postgres) · lo hace el CEO · ~10 min

1. ~~Crea cuenta y proyecto~~ **HECHO el 2-sep-2026.** Proyecto `azahar`,
   Postgres 16, AWS us-west-2 (Oregon — misma región que Render, para latencia
   mínima entre API y base).
2. De la pantalla de conexión copia **dos** cadenas:
   - **Pooled** (host con `-pooler`) → será `DATABASE_URL` en Render.
   - **Direct** → será `DATABASE_URL_OWNER` en Render.
   - Pégalas tal cual: el entrypoint les quita solo `channel_binding` y
     `-pooler` donde toca (gotchas 3 y 4 del ADR-009).
3. **No edites la cadena a mano.** Corre esto y pega ahí la cadena pooled:

   ```bash
   node scripts/cadena-app.mjs
   ```

   Te devuelve la `DATABASE_URL` y el `AUTH_SECRET` listos para copiar. El rol
   restringido `azahar_app` NO lo creas tú: lo crea el entrypoint en el primer
   deploy (`ensure-app-role.mjs`) con la contraseña que venga en esa cadena.

   > **Por qué hay un script y no una instrucción.** El primer despliegue real
   > (4-sep-2026) falló justo aquí: al sustituir `usuario:contraseña` a mano se
   > perdió el resto de la cadena y `DATABASE_URL` acabó siendo un fragmento de
   > contraseña. El error que produce —`TypeError: Invalid URL`— no dice nada
   > sobre la causa. Editar cadenas de conexión a mano es trabajo de máquina.

## Paso 2 — Render (API) · lo hace el CEO · ~10 min

1. Crea cuenta en https://render.com y un workspace **NUEVO llamado
   "Azahar"** — no reutilices el de Zentor/Zenix. Los minutos de build son por
   workspace; compartirlo ya costó 3 días sin deploys una vez (lección 1 del
   ADR-009).
2. New → **Blueprint** → conecta el repo `abrahag40/schoolProyect` → Render lee
   `render.yaml` y propone el servicio `azahar-api`. Rama: la que te indique el
   equipo (hoy: `sprint-0-fundaciones`; tras el merge, `main`).
3. En **Environment** del servicio, pega los secretos (`sync:false` significa
   que el repo NO los trae — se cargan aquí):
   - `DATABASE_URL` → la cadena pooled con `azahar_app` (paso 1.3).
   - `DATABASE_URL_OWNER` → la cadena direct con el owner de Neon, tal cual.
   - `AUTH_SECRET` → `openssl rand -base64 32`.
   - `NEXT_PUBLIC_WEB_ORIGIN` → la URL de Vercel del paso 3 (vuelve aquí a
     pegarla cuando exista; mientras tanto pon `http://localhost:3010`).
4. Deploy. El log debe mostrar `[entrypoint] aplicando migraciones...`,
   `[db] rol azahar_app listo`, `[entrypoint] arrancando API...`. Verifica
   `https://<tu-servicio>.onrender.com/salud` → `{"estado":"ok","baseDatos":"ok"}`.

## Paso 3 — Vercel (web) · lo hace el CEO · ~5 min

1. Crea cuenta en https://vercel.com → Add New Project → importa
   `abrahag40/schoolProyect`.
2. **Root Directory: `apps/web`** (Vercel detecta el monorepo pnpm; el
   `vercel.json` de esa carpeta ya trae el build con Turbo).
3. Environment Variables: `NEXT_PUBLIC_API_URL` → la URL del API de Render.
4. Deploy. Abre la URL, entra con la cuenta demo del seed.
5. **Cierra el círculo:** vuelve a Render y pon `NEXT_PUBLIC_WEB_ORIGIN` = la
   URL de Vercel (sin esto, CORS rechaza a la web en producción — es a
   propósito: solo ese origen puede llamar al API con credenciales).

## Paso 4 — Sembrar staging · lo hace el equipo

Con la cadena del owner de Neon en un `.env` local temporal:
`pnpm db:seed`. (Las escuelas demo; en cuanto exista el wizard de plataforma
—cambio C1— las altas reales se harán desde la consola, no por seed.)

---

## Gotchas conocidos (heredados con evidencia)

| #   | Síntoma                                                                       | Causa y remedio                                                                                                                   |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `password authentication failed for user 'azahar_app'` tras rotar contraseñas | La rotación en Neon y el `DATABASE_URL` de Render se cambian **en el mismo paso**, o el API queda con la vieja.                   |
| 2   | El deploy corre pero los datos "no aparecen"                                  | Estás conectado con el owner (BYPASSRLS apagaría RLS) o sin contexto de tenant (deny-by-default = cero filas). Ver §26/§27.       |
| 3   | `prisma migrate` congelado en la nube                                         | Estás migrando por la cadena pooled. Migrar usa SIEMPRE la directa (el entrypoint ya lo hace; a mano, quita `-pooler`).           |
| 4   | Driver truena al conectar a Neon                                              | `channel_binding=require` en la cadena. El entrypoint lo limpia; en local, quítalo a mano.                                        |
| 5   | Cold start ~50 s en la primera petición                                       | Render free duerme tras ~~15 min. Aceptable en staging; Starter (~~$7/mes) antes del primer cliente de pago (trigger en ADR-009). |
