# Runbook de infraestructura — Staging

Cómo dejar Azahar corriendo en la nube. Arquitectura (ADR-009):
**Neon** (Postgres) · **Render** (API en contenedor) · **Vercel** (web).

> ## ESTADO ACTUAL: **DESPLEGADO** (4-sep-2026)
>
> Azahar corre en la nube por primera vez. El impedimento que estuvo abierto
> desde el Sprint 0 —escalado tres veces, siete sprints sin staging— queda
> cerrado.
>
> | Pieza        | Identificador                                   | URL / Estado                                    |
> | ------------ | ----------------------------------------------- | ----------------------------------------------- |
> | DB (Neon)    | proyecto `azahar` · `jolly-lake-32570910`       | PG 16, AWS us-west-2 · 13 migraciones aplicadas |
> | API (Render) | workspace `Azahar` · `srv-dadfc3vqj5pc738shm9g` | https://azahar-api.onrender.com · **Live**      |
> | Web (Vercel) | proyecto `azahar-web`                           | https://azahar-web-neon.vercel.app · **Ready**  |
>
> El sufijo `-neon` del dominio de Vercel lo asignó Vercel al azar y **no tiene
> relación con la base de datos Neon**. Se anota porque induce a error al leerlo.
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
> ### Lo que costó este primer despliegue: cuatro intentos
>
> Vale documentarlo porque tres de los cuatro fallos fueron de **procedimiento**,
> no de código, y el procedimiento era mío:
>
> | #   | Síntoma                                     | Causa                                                        |
> | --- | ------------------------------------------- | ------------------------------------------------------------ |
> | 1   | `TypeError: Invalid URL, input: 'npg_...'`  | El runbook pedía editar a mano una cadena de 130 caracteres. |
> | 2   | `getaddrinfo ENOTFOUND base`                | Automaticé 2 de 3 valores y el fallo se mudó al tercero.     |
> | 3   | Desplegaba `sprint-0-fundaciones`           | El cambio de rama del blueprint exigía aprobar un sync.      |
> | 4   | `ALTER ROLE ... NOSUPERUSER` → `user.c:764` | **Defecto real.** En Neon el owner no es superusuario.       |
>
> Del #4 salió una mejora que va más allá del arreglo: el script ya no _impone_
> `NOSUPERUSER NOBYPASSRLS` sino que los **verifica**. Un rol nuevo nace así de
> todos modos; lo que hacía falta era demostrarlo. Si mañana alguien le diera
> `BYPASSRLS` a `azahar_app`, la versión vieja lo habría "corregido" en silencio;
> la nueva se niega a arrancar y dice cómo arreglarlo.
>
> ### Fuga de credenciales de este despliegue — ACCIÓN PENDIENTE DEL CEO
>
> Tres contraseñas quedaron en texto claro en registros que no controlamos:
>
> - El **owner de Neon del proyecto `azahar`** y el de **`adrimarket`** (otro
>   producto), por capturas de la ventana _Connect_ de Neon.
> - La de **`azahar_app`**, en los logs de Render: un error de Postgres incluye
>   el texto completo de la sentencia, y un `ALTER ROLE ... PASSWORD` lleva la
>   contraseña dentro porque el DDL no admite parámetros.
>
> Corregido en el código (el script ya no propaga el error crudo), pero **las
> tres contraseñas hay que rotarlas**: Neon → _Reset password_ en cada proyecto,
> y volver a correr `node scripts/cadena-app.mjs` para regenerar la de la app.
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
   `render.yaml` y propone el servicio `azahar-api`. Rama: **`main`**.
   Si cambias la rama de un blueprint ya creado, Render exige **aprobar un
   sync** antes de que surta efecto; si no, sigue desplegando la anterior.
3. En **Environment** del servicio, pega los secretos (`sync:false` significa
   que el repo NO los trae — se cargan aquí):
   - `DATABASE_URL` → la cadena pooled con `azahar_app` (paso 1.3).
   - `DATABASE_URL_OWNER` → la cadena direct con el owner de Neon, tal cual.
   - `AUTH_SECRET` → `openssl rand -base64 32`.
   - `NEXT_PUBLIC_WEB_ORIGIN` → la URL ESTABLE de Vercel (paso 3), **sin barra
     final**. Desde el 4-sep-2026 el API **no arranca sin ella en producción**:
     antes caía en silencio a un origen de `localhost` y dejaba el CORS cerrado
     contra su propia web, con `/salud` en verde (§59).
4. Deploy. El log debe mostrar `[entrypoint] aplicando migraciones...`,
   `[db] rol azahar_app listo`, `[entrypoint] arrancando API...`. Verifica
   `https://<tu-servicio>.onrender.com/salud` → `{"estado":"ok","baseDatos":"ok"}`.

## Paso 3 — Vercel (web) · lo hace el CEO · ~5 min

1. Crea cuenta en https://vercel.com → Add New Project → importa
   `abrahag40/schoolProyect`.
2. **Root Directory: `apps/web`** (Vercel detecta el monorepo pnpm; el
   `vercel.json` de esa carpeta ya trae el build con Turbo).
3. Environment Variables: `NEXT_PUBLIC_API_URL` → la URL del API de Render
   (hoy `https://azahar-api.onrender.com`).
4. Deploy. Abre la URL, entra con la cuenta demo del seed.
5. **Cierra el círculo:** vuelve a Render y pon `NEXT_PUBLIC_WEB_ORIGIN` = la
   URL de Vercel (sin esto, CORS rechaza a la web en producción — es a
   propósito: solo ese origen puede llamar al API con credenciales).

## Paso 4 — Sembrar staging · lo hace el equipo

```bash
DATABASE_URL_OWNER='<cadena DIRECTA de Neon>' pnpm db:seed
```

> **El seed BORRA lo que haya antes** (y trunca la bitácora). En una base vacía
> da igual; en una con datos, no.
>
> **Por qué funciona pese al FORCE RLS.** Todas las tablas llevan
> `FORCE ROW LEVEL SECURITY` (§3), que alcanza tambien al dueño de la tabla —
> solo se libra quien tenga `superuser` o `bypassrls`. En desarrollo el dueño es
> el superusuario del contenedor y no se nota. En Neon **no** es superusuario,
> así que el seed era sospechoso de fallar; el arranque lo MIDE y lo reporta:
> `[db] dueno "neondb_owner" PUEDE saltarse RLS (superuser=false, bypassrls=true)`.
> Si algún día ese renglón dice lo contrario, el seed necesitará contexto de
> tenant por cada escuela en vez de insertar de corrido. (Las escuelas demo; en cuanto exista el wizard de plataforma
> —cambio C1— las altas reales se harán desde la consola, no por seed.)

---

## Gotchas conocidos (heredados con evidencia)

| #   | Síntoma                                                                       | Causa y remedio                                                                                                                                                                   |
| --- | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `password authentication failed for user 'azahar_app'` tras rotar contraseñas | La rotación en Neon y el `DATABASE_URL` de Render se cambian **en el mismo paso**, o el API queda con la vieja.                                                                   |
| 2   | El deploy corre pero los datos "no aparecen"                                  | Estás conectado con el owner (BYPASSRLS apagaría RLS) o sin contexto de tenant (deny-by-default = cero filas). Ver §26/§27.                                                       |
| 3   | `prisma migrate` congelado en la nube                                         | Estás migrando por la cadena pooled. Migrar usa SIEMPRE la directa (el entrypoint ya lo hace; a mano, quita `-pooler`).                                                           |
| 4   | Driver truena al conectar a Neon                                              | `channel_binding=require` en la cadena. El entrypoint lo limpia; en local, quítalo a mano.                                                                                        |
| 5   | Cold start ~50 s en la primera petición                                       | Render free duerme tras ~~15 min. Aceptable en staging; Starter (~~$7/mes) antes del primer cliente de pago (trigger en ADR-009).                                                 |
| 6   | La web no puede llamar al API, pero `/salud` responde bien                    | Falta `NEXT_PUBLIC_WEB_ORIGIN` o tiene barra final. El navegador manda el `Origin` sin barra y la comparación es exacta. Desde el 4-sep el API no arranca sin ella en producción. |
| 7   | Cambiaste una variable en Render y "ya quedó", pero sigue igual               | El contenedor viejo sirve hasta que el nuevo pasa el health check. Verifica el VALOR del header, no su presencia (§14).                                                           |
| 8   | `ALTER ROLE ... NOSUPERUSER` falla con `user.c:764`                           | En Neon el owner no es superusuario y no puede tocar esos atributos. No hace falta pedirlos: un rol nuevo nace así. El script los VERIFICA.                                       |
| 9   | Una contraseña aparece en los logs del proveedor                              | Un error de Postgres trae el texto completo de la sentencia, y `ALTER ROLE ... PASSWORD` la lleva dentro (el DDL no admite parámetros). Nunca propagues el error crudo.           |
