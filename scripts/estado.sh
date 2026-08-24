#!/usr/bin/env bash
# Estado real del proyecto, MEDIDO del repositorio.
#
# Por que existe (§7): un documento de estado que hay que acordarse de
# actualizar se deja de actualizar, y entonces miente en ambos sentidos —
# declara terminado lo que no lo esta y omite lo que si. Esto se genera.
#
# Uso: pnpm estado
set -uo pipefail
cd "$(dirname "$0")/.."

echo "==================================================================="
echo " AZAHAR — estado medido el $(date '+%Y-%m-%d %H:%M')"
echo "==================================================================="
echo
echo "--- Git ---"
if git rev-parse HEAD >/dev/null 2>&1; then
  echo "rama:      $(git rev-parse --abbrev-ref HEAD)"
  echo "ultimo:    $(git log -1 --pretty='%h %s')"
else
  echo "rama:      (aun sin commits)"
  echo "ultimo:    (aun sin commits)"
fi
cambios=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
echo "sin commitear: ${cambios} archivo(s)"
echo
echo "--- Sprint activo (leido de CLAUDE.md) ---"
grep -m1 'Sprint activo' CLAUDE.md 2>/dev/null | sed 's/^ *- *//' || echo "no declarado"
echo
echo "--- Base de datos ---"
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q azahar-db-dev; then
  echo "contenedor: arriba"
  ultima=$(ls -1 packages/db/prisma/migrations 2>/dev/null | grep -v migration_lock | tail -1)
  echo "migracion mas alta: ${ultima:-ninguna}"
  aplicadas=$(docker exec azahar-db-dev psql -U azahar_owner -d azahar -tAc \
    'SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL' 2>/dev/null || echo '?')
  echo "migraciones aplicadas: ${aplicadas}"
else
  echo "contenedor: abajo (pnpm db:up)"
fi
echo
echo "--- Codigo ---"
printf "paquetes:  "; ls -1 packages 2>/dev/null | tr '\n' ' '; echo
printf "apps:      "; ls -1 apps 2>/dev/null | tr '\n' ' '; echo
echo "archivos de prueba: $(find . -path ./node_modules -prune -o \( -name '*.test.ts' -o -name '*.test.mjs' \) -print 2>/dev/null | wc -l | tr -d ' ')"
echo
echo "--- Servicios locales ---"
for par in "3333:api" "3010:web" "5434:postgres"; do
  puerto="${par%%:*}"; nombre="${par##*:}"
  if lsof -nP -iTCP:"$puerto" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "  $nombre ($puerto): arriba"
  else
    echo "  $nombre ($puerto): abajo"
  fi
done
echo
echo "El plan de trabajo vive en el Plan Maestro (ver CLAUDE.md)."
echo "Este resumen describe el REPO, no el plan: si difieren, manda el plan."
