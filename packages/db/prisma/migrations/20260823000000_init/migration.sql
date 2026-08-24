-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Vertical" AS ENUM ('COLEGIO', 'UNIVERSIDAD', 'ACADEMIA_DEPORTIVA', 'ESCUELA_IDIOMAS', 'TALLER');

-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('DUENO', 'DIRECTOR', 'ADMIN', 'COBRANZA', 'STAFF');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "vertical" "Vertical" NOT NULL DEFAULT 'COLEGIO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sede" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "cct" TEXT,
    "rvoe" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creadaEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sede_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL DEFAULT 'STAFF',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "sede_tenant_id_idx" ON "sede"("tenant_id");

-- CreateIndex
CREATE INDEX "usuario_tenant_id_idx" ON "usuario"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_tenant_id_email_key" ON "usuario"("tenant_id", "email");

-- AddForeignKey
ALTER TABLE "sede" ADD CONSTRAINT "sede_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
