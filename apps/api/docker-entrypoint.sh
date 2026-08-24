#!/usr/bin/env bash
# Arranque del API en la nube: migrar -> preparar rol -> servir.
#
# Contrato de credenciales (ADR-004 no cambia en la nube):
#   DATABASE_URL        -> rol azahar_app (NOBYPASSRLS). La usa el runtime.
#   DATABASE_URL_OWNER  -> owner de Neon. SOLO migraciones y grants. Si falta,
#                          el arranque SALTA la migracion (deploy de codigo sin
#                          cambios de esquema) y lo dice en el log.
set -euo pipefail

# Neon entrega cadenas con channel_binding=require, que rompe al driver pg
# (gotcha documentado en el runbook de Zentor, 2026). Se limpia aqui, una vez,
# en lugar de esperar que cada humano lo recuerde al pegar la cadena.
limpiar() { echo "$1" | sed -E 's/([?&])channel_binding=require&?/\1/; s/[?&]$//'; }

export DATABASE_URL="$(limpiar "${DATABASE_URL:?Falta DATABASE_URL (rol azahar_app)}")"

if [[ -n "${DATABASE_URL_OWNER:-}" ]]; then
  # Migrar exige la conexion DIRECTA (sin -pooler): PgBouncer en modo
  # transaccion no soporta los advisory locks de prisma migrate.
  export DATABASE_URL_OWNER="$(limpiar "$DATABASE_URL_OWNER" | sed 's/-pooler//')"
  echo "[entrypoint] aplicando migraciones pendientes..."
  node packages/db/scripts/ensure-app-role.mjs
  (cd packages/db && pnpm exec prisma migrate deploy)
  node packages/db/scripts/ensure-app-role.mjs --grants-only
  echo "[entrypoint] esquema al dia."
else
  echo "[entrypoint] AVISO: sin DATABASE_URL_OWNER — se omite la migracion." >&2
fi

echo "[entrypoint] arrancando API..."
exec node apps/api/dist/main.js
