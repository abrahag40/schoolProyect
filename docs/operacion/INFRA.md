# Runbook de infraestructura — Staging

Cómo dejar Azahar corriendo en la nube. Arquitectura (ADR-009):
**Neon** (Postgres) · **Render** (API en contenedor) · **Vercel** (web).

> ## ESTADO ACTUAL: NO DESPLEGADO (24-ago-2026)
>
> La infraestructura está **declarada en el repo** (`render.yaml`,
> `apps/api/Dockerfile`, `docker-entrypoint.sh`, `apps/web/vercel.json`) pero
> **no existe ninguna cuenta de nube todavía**. Los pasos 1–3 de abajo los
> ejecuta **el CEO** (crear cuentas es acción administrativa: correo de la
> empresa + navegador; sin tarjeta — todo arranca en plan free).
>
> Cuando algo se despliegue, ESTA tabla se actualiza en el mismo PR — regla
> heredada de Zentor: una sesión nueva intentó re-desplegar desde cero lo que
> ya existía porque el estado vivo no estaba documentado. El estado va arriba;
> los pasos, abajo.
>
> | Pieza        | URL / id | Estado              |
> | ------------ | -------- | ------------------- |
> | Web (Vercel) | —        | pendiente de cuenta |
> | API (Render) | —        | pendiente de cuenta |
> | DB (Neon)    | —        | pendiente de cuenta |
>
> **Dominio propio:** no hay y no urge. Los subdominios gratis de cada
> plataforma bastan para staging/beta. Se vuelve necesario en S6-S7 (el correo
> transaccional exige dominio verificado). Es compra del CEO (marca + tarjeta).

```
Vercel (web)  ──HTTPS──►  Render (API)  ──TCP/SSL──►  Neon (Postgres + RLS)
```

---

## Paso 1 — Neon (Postgres) · lo hace el CEO · ~10 min

1. Crea cuenta en https://neon.tech (con el correo de ZaharDev) y un proyecto
   **`azahar`**, región AWS us-west-2 (Oregon — misma región que Render, para
   latencia mínima entre API y base).
2. De la pantalla de conexión copia **dos** cadenas:
   - **Pooled** (host con `-pooler`) → será `DATABASE_URL` en Render.
   - **Direct** → será `DATABASE_URL_OWNER` en Render.
   - Pégalas tal cual: el entrypoint les quita solo `channel_binding` y
     `-pooler` donde toca (gotchas 3 y 4 del ADR-009).
3. **Nada más.** El rol restringido `azahar_app` NO lo creas tú: lo crea el
   entrypoint en el primer deploy (`ensure-app-role.mjs`), con la contraseña
   que declares en la propia `DATABASE_URL`. Para eso, edita la cadena pooled
   cambiando usuario y contraseña a `azahar_app:<contraseña-fuerte-nueva>`
   (genera una: `openssl rand -base64 24`).

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
