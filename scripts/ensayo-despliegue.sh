#!/usr/bin/env bash
# Ensayo de despliegue (AZ-INF.1, Sprint 3).
#
# POR QUE EXISTE: al cierre del Sprint 2 el staging llevaba tres sprints
# bloqueado por cuentas de nube que aun no existen, con seis migraciones y tres
# superficies que nunca habian corrido fuera de una laptop. El problema de
# acumular no es el tamano: es que cuando por fin se despliegue apareceran
# varios fallos a la vez y ninguno dira cual causo cual.
#
# Esto NO sustituye al staging — no prueba Neon, ni Render, ni el TLS, ni el
# pooler. Prueba lo que si se puede probar aqui: que la imagen construye, que
# el contenedor arranca contra una base VACIA, que migra solo y que el esquema
# resultante conserva el aislamiento. Es decir, convierte la mayoria de las
# sorpresas del primer deploy en fallos que vemos con calma.
#
# Uso: pnpm ensayo:despliegue
set -euo pipefail
cd "$(dirname "$0")/.."

RED=azahar-ensayo
DB=azahar-ensayo-db
API=azahar-ensayo-api
IMAGEN=azahar-api:ensayo
PUERTO=3334
PW=ensayo_pw

# Credenciales del ensayo. Mismo contrato que en la nube (ADR-004): el rol
# dueno SOLO migra; la aplicacion corre con el restringido.
URL_OWNER="postgresql://ensayo_owner:${PW}@${DB}:5432/azahar?schema=public"
URL_APP="postgresql://azahar_app:${PW}@${DB}:5432/azahar?schema=public"

paso() { printf '\n\033[1m▸ %s\033[0m\n' "$1"; }
fallo() { printf '\033[31m✗ %s\033[0m\n' "$1"; exit 1; }
ok() { printf '\033[32m✓ %s\033[0m\n' "$1"; }

limpiar() {
  docker rm -f "$API" "$DB" >/dev/null 2>&1 || true
  docker network rm "$RED" >/dev/null 2>&1 || true
}
# El trap va ANTES de crear nada: si el script muere a la mitad, no deja
# contenedores zombis ocupando puertos hasta que alguien los note.
trap limpiar EXIT
limpiar

paso "1/6 Construyendo la imagen del API (contexto = raiz del repo)"
docker build -f apps/api/Dockerfile -t "$IMAGEN" . >/tmp/ensayo-build.log 2>&1 \
  || { tail -30 /tmp/ensayo-build.log; fallo "la imagen no construye"; }
ok "imagen $IMAGEN construida"

paso "2/6 Levantando una base VACIA (como el primer dia en la nube)"
docker network create "$RED" >/dev/null
docker run -d --name "$DB" --network "$RED" \
  -e POSTGRES_USER=ensayo_owner -e POSTGRES_PASSWORD="$PW" -e POSTGRES_DB=azahar \
  postgres:16-alpine >/dev/null
for _ in $(seq 1 30); do
  docker exec "$DB" pg_isready -U ensayo_owner -d azahar >/dev/null 2>&1 && break
  sleep 1
done
docker exec "$DB" pg_isready -U ensayo_owner -d azahar >/dev/null 2>&1 \
  || fallo "la base no acepto conexiones"
ok "postgres 16 arriba, sin una sola tabla"

paso "3/6 Arrancando el API: debe migrar SOLO antes de servir"
docker run -d --name "$API" --network "$RED" -p "${PUERTO}:3333" \
  -e DATABASE_URL="$URL_APP" \
  -e DATABASE_URL_OWNER="$URL_OWNER" \
  -e AUTH_SECRET="secreto-de-ensayo-de-al-menos-32-caracteres" \
  -e API_PORT=3333 \
  "$IMAGEN" >/dev/null

listo=false
for _ in $(seq 1 60); do
  if curl -sf "http://localhost:${PUERTO}/salud" >/tmp/ensayo-salud.json 2>/dev/null; then
    listo=true; break
  fi
  sleep 2
done
$listo || { docker logs "$API" | tail -40; fallo "el API nunca respondio"; }
grep -q '"estado":"ok"' /tmp/ensayo-salud.json \
  || { cat /tmp/ensayo-salud.json; fallo "el API responde pero no alcanza la base"; }
ok "API arriba y con base alcanzable: $(cat /tmp/ensayo-salud.json)"

psql() { docker exec "$DB" psql -U ensayo_owner -d azahar -tAc "$1"; }

paso "4/6 ¿Se aplicaron TODAS las migraciones del repo?"
enRepo=$(ls -1 packages/db/prisma/migrations | grep -v migration_lock | wc -l | tr -d ' ')
aplicadas=$(psql 'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL')
[ "$enRepo" = "$aplicadas" ] \
  || fallo "el repo tiene $enRepo migraciones y la base $aplicadas: el arranque no migro todo"
ok "$aplicadas/$enRepo migraciones aplicadas por el propio contenedor"

paso "5/6 ¿El esquema desplegado conserva el aislamiento? (§3)"
sinRls=$(psql "SELECT string_agg(relname, ', ') FROM pg_class
                WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
                  AND relname NOT LIKE '\\_prisma%'
                  AND (NOT relrowsecurity OR NOT relforcerowsecurity)")
[ -z "$sinRls" ] || fallo "tablas sin RLS forzado en el despliegue: $sinRls"
tablas=$(psql "SELECT count(*) FROM pg_class
                WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
                  AND relname NOT LIKE '\\_prisma%'")
ok "las $tablas tablas de negocio nacen con RLS habilitado y forzado"

paso "6/6 ¿El rol de la aplicacion sigue sin poder saltarse RLS?"
# La comprobacion que convierte todo lo anterior en algo real: si el rol de la
# app tuviera BYPASSRLS, las politicas no se evaluarian y el aislamiento seria
# decorativo (el defecto que heredamos de Zentor).
bypass=$(psql "SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = 'azahar_app'")
[ "$bypass" = "f" ] || fallo "azahar_app puede evadir RLS en el despliegue"
ok "azahar_app es NOSUPERUSER y NOBYPASSRLS"

printf '\n\033[32m═══ ENSAYO SUPERADO ═══\033[0m\n'
echo "La imagen construye, arranca contra una base vacia, migra sola y el"
echo "esquema desplegado conserva el aislamiento multi-tenant."
echo
echo "LO QUE ESTE ENSAYO NO PRUEBA (y sigue pendiente de staging real):"
echo "  - Neon: TLS, channel_binding y el pooler de PgBouncer."
echo "  - Render: limites de memoria, arranque en frio y variables del panel."
echo "  - Vercel: la web contra un API que no es localhost (CORS y cookies)."
