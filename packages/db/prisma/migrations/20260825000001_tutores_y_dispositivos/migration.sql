-- CreateEnum
CREATE TYPE "Plataforma" AS ENUM ('IOS', 'ANDROID', 'WEB');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'TUTOR';

-- CreateTable
CREATE TABLE "dispositivo_push" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "plataforma" "Plataforma" NOT NULL,
    "visto_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispositivo_push_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dispositivo_push_token_key" ON "dispositivo_push"("token");

-- CreateIndex
CREATE INDEX "dispositivo_push_tenant_id_idx" ON "dispositivo_push"("tenant_id");

-- CreateIndex
CREATE INDEX "dispositivo_push_usuario_id_idx" ON "dispositivo_push"("usuario_id");

-- AddForeignKey
ALTER TABLE "dispositivo_push" ADD CONSTRAINT "dispositivo_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS de la tabla nueva (§3). El gate de aislamiento recorre pg_class y se
-- pone rojo si una tabla de negocio nace sin politica: esto no es opcional.
ALTER TABLE "dispositivo_push" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dispositivo_push" FORCE ROW LEVEL SECURITY;
CREATE POLICY dispositivo_push_aislamiento ON "dispositivo_push"
  USING (tenant_id = app_tenant_actual())
  WITH CHECK (tenant_id = app_tenant_actual());
