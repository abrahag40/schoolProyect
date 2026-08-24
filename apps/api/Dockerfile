# Imagen del API de Azahar para Render (ADR-009).
#
# Dos etapas: en la primera se instala y compila con el toolchain completo; la
# segunda solo hereda el resultado. El contexto de build es la RAIZ del repo
# (dockerContext: . en render.yaml) porque el API depende de packages/db.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /repo
COPY . .
# --frozen-lockfile: la imagen se construye con EXACTAMENTE lo que el lockfile
# declara; si alguien olvido commitear el lock, el build falla aqui y no en
# produccion a las 3 am.
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @azahar/tokens build \
 && pnpm --filter @azahar/db build \
 && pnpm --filter @azahar/api build

FROM node:24-alpine
RUN corepack enable && apk add --no-cache bash
WORKDIR /repo
COPY --from=build /repo .
ENV NODE_ENV=production
EXPOSE 3333
# El entrypoint migra ANTES de arrancar (fail-safe: si migrar falla, el proceso
# no arranca). Cierra la clase "codigo nuevo + esquema viejo = 500s en demo",
# el hueco que en Zentor tumbo una demo en vivo antes de cerrarse igual.
ENTRYPOINT ["bash", "apps/api/docker-entrypoint.sh"]
