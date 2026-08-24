-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "plataforma";

-- CreateEnum
CREATE TYPE "plataforma"."RolPlataforma" AS ENUM ('CEO', 'SOCIO', 'SOPORTE');

-- CreateEnum
CREATE TYPE "plataforma"."EstadoCliente" AS ENUM ('CORTESIA', 'ACTIVO', 'SUSPENDIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "TipoPeriodo" AS ENUM ('CICLO_ESCOLAR', 'TEMPORADA', 'CONTINUO');

-- CreateEnum
CREATE TYPE "TipoCohorte" AS ENUM ('GRADO', 'CATEGORIA', 'NIVEL', 'TALLER');

-- CreateEnum
CREATE TYPE "EstadoInscripcion" AS ENUM ('ACTIVA', 'BAJA', 'EGRESADO');

-- CreateEnum
CREATE TYPE "Parentesco" AS ENUM ('MADRE', 'PADRE', 'TUTOR', 'ABUELO', 'OTRO');

-- CreateEnum
CREATE TYPE "Finalidad" AS ENUM ('GESTION_ESCOLAR', 'COBRANZA', 'COMUNICACION_OPERATIVA', 'EXPEDIENTE_SALUD', 'IMAGENES', 'COMUNIDAD', 'COMUNICACION_COMERCIAL');

-- CreateEnum
CREATE TYPE "CanalConsentimiento" AS ENUM ('APP', 'WEB', 'PAPEL', 'IMPORTACION');

-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'DOCENTE';

-- AlterTable
ALTER TABLE "sede" ALTER COLUMN "creadaEn" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
ALTER TABLE "tenant" ALTER COLUMN "creadoEn" SET DATA TYPE TIMESTAMPTZ(6);

-- AlterTable
-- NOTA: el DROP COLUMN "rol" se movio al FINAL de esta migracion, despues de
-- copiar los roles existentes a usuario_rol. Prisma genera el DROP antes de
-- crear la tabla destino; ejecutarlo en ese orden perderia el rol de cada
-- usuario ya dado de alta.
ALTER TABLE "usuario"
ALTER COLUMN "creadoEn" SET DATA TYPE TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "plataforma"."miembro" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "plataforma"."RolPlataforma" NOT NULL,
    "socio_id" UUID,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "miembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plataforma"."socio" (
    "id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "porcentaje_comision" DECIMAL(5,2) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plataforma"."cliente" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "estado" "plataforma"."EstadoCliente" NOT NULL DEFAULT 'CORTESIA',
    "plan" TEXT NOT NULL DEFAULT 'base',
    "precio_mensual" DECIMAL(10,2) NOT NULL,
    "moneda" TEXT NOT NULL DEFAULT 'MXN',
    "alumnos_maximos" INTEGER NOT NULL DEFAULT 200,
    "modulos_activos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cortesia_hasta" TIMESTAMPTZ(6),
    "socio_id" UUID,
    "alta_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plataforma"."evento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID,
    "actor_email" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "ocurrido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datos" JSONB,
    "monto_mxn" DECIMAL(10,2),

    CONSTRAINT "evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol" "Rol" NOT NULL,
    "sede_id" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "periodo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoPeriodo" NOT NULL,
    "inicio" DATE NOT NULL,
    "fin" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cohorte" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "periodo_id" UUID NOT NULL,
    "sede_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoCohorte" NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cohorte_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alumno" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "fecha_nacimiento" DATE,
    "curp" TEXT,
    "matricula" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscripcion" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "alumno_id" UUID NOT NULL,
    "cohorte_id" UUID NOT NULL,
    "estado" "EstadoInscripcion" NOT NULL DEFAULT 'ACTIVA',
    "alta_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baja_en" TIMESTAMPTZ(6),

    CONSTRAINT "inscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT NOT NULL,
    "email" TEXT,
    "telefono" TEXT,
    "usuario_id" UUID,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_alumno" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "alumno_id" UUID NOT NULL,
    "parentesco" "Parentesco" NOT NULL DEFAULT 'TUTOR',
    "es_pagador" BOOLEAN NOT NULL DEFAULT false,
    "porcentaje_pago" DECIMAL(5,2),
    "es_contacto_emergencia" BOOLEAN NOT NULL DEFAULT false,
    "puede_recoger" BOOLEAN NOT NULL DEFAULT false,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_alumno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aviso_privacidad" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "contenido" TEXT NOT NULL,
    "publicado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigente_al" TIMESTAMPTZ(6),

    CONSTRAINT "aviso_privacidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consentimiento" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "aviso_id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "alumno_id" UUID,
    "finalidad" "Finalidad" NOT NULL,
    "otorgado" BOOLEAN NOT NULL,
    "canal" "CanalConsentimiento" NOT NULL,
    "otorgado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revocado_en" TIMESTAMPTZ(6),

    CONSTRAINT "consentimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_auditoria" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "actor_id" UUID,
    "tipo" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidad_id" UUID,
    "ocurrido_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "datos" JSONB,

    CONSTRAINT "evento_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "miembro_email_key" ON "plataforma"."miembro"("email");

-- CreateIndex
CREATE UNIQUE INDEX "socio_email_key" ON "plataforma"."socio"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_tenant_id_key" ON "plataforma"."cliente"("tenant_id");

-- CreateIndex
CREATE INDEX "cliente_estado_idx" ON "plataforma"."cliente"("estado");

-- CreateIndex
CREATE INDEX "cliente_socio_id_idx" ON "plataforma"."cliente"("socio_id");

-- CreateIndex
CREATE INDEX "evento_tenant_id_ocurrido_en_idx" ON "plataforma"."evento"("tenant_id", "ocurrido_en");

-- CreateIndex
CREATE INDEX "evento_tipo_ocurrido_en_idx" ON "plataforma"."evento"("tipo", "ocurrido_en");

-- CreateIndex
CREATE INDEX "usuario_rol_tenant_id_idx" ON "usuario_rol"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_rol_usuario_id_rol_sede_id_key" ON "usuario_rol"("usuario_id", "rol", "sede_id");

-- CreateIndex
CREATE INDEX "periodo_tenant_id_activo_idx" ON "periodo"("tenant_id", "activo");

-- CreateIndex
CREATE INDEX "cohorte_tenant_id_periodo_id_idx" ON "cohorte"("tenant_id", "periodo_id");

-- CreateIndex
CREATE INDEX "alumno_tenant_id_idx" ON "alumno"("tenant_id");

-- CreateIndex
CREATE INDEX "alumno_tenant_id_activo_idx" ON "alumno"("tenant_id", "activo");

-- CreateIndex
CREATE INDEX "inscripcion_tenant_id_estado_idx" ON "inscripcion"("tenant_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "inscripcion_alumno_id_cohorte_id_key" ON "inscripcion"("alumno_id", "cohorte_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_usuario_id_key" ON "tutor"("usuario_id");

-- CreateIndex
CREATE INDEX "tutor_tenant_id_idx" ON "tutor"("tenant_id");

-- CreateIndex
CREATE INDEX "tutor_alumno_tenant_id_idx" ON "tutor_alumno"("tenant_id");

-- CreateIndex
CREATE INDEX "tutor_alumno_alumno_id_es_pagador_idx" ON "tutor_alumno"("alumno_id", "es_pagador");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_alumno_tutor_id_alumno_id_key" ON "tutor_alumno"("tutor_id", "alumno_id");

-- CreateIndex
CREATE UNIQUE INDEX "aviso_privacidad_tenant_id_version_key" ON "aviso_privacidad"("tenant_id", "version");

-- CreateIndex
CREATE INDEX "consentimiento_tenant_id_finalidad_idx" ON "consentimiento"("tenant_id", "finalidad");

-- CreateIndex
CREATE INDEX "consentimiento_tutor_id_finalidad_idx" ON "consentimiento"("tutor_id", "finalidad");

-- CreateIndex
CREATE INDEX "evento_auditoria_tenant_id_ocurrido_en_idx" ON "evento_auditoria"("tenant_id", "ocurrido_en");

-- CreateIndex
CREATE INDEX "evento_auditoria_tenant_id_entidad_entidad_id_idx" ON "evento_auditoria"("tenant_id", "entidad", "entidad_id");

-- AddForeignKey
ALTER TABLE "plataforma"."miembro" ADD CONSTRAINT "miembro_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "plataforma"."socio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plataforma"."cliente" ADD CONSTRAINT "cliente_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "plataforma"."socio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "periodo" ADD CONSTRAINT "periodo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorte" ADD CONSTRAINT "cohorte_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorte" ADD CONSTRAINT "cohorte_periodo_id_fkey" FOREIGN KEY ("periodo_id") REFERENCES "periodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cohorte" ADD CONSTRAINT "cohorte_sede_id_fkey" FOREIGN KEY ("sede_id") REFERENCES "sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alumno" ADD CONSTRAINT "alumno_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_cohorte_id_fkey" FOREIGN KEY ("cohorte_id") REFERENCES "cohorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor" ADD CONSTRAINT "tutor_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor" ADD CONSTRAINT "tutor_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_alumno" ADD CONSTRAINT "tutor_alumno_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_alumno" ADD CONSTRAINT "tutor_alumno_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aviso_privacidad" ADD CONSTRAINT "aviso_privacidad_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimiento" ADD CONSTRAINT "consentimiento_aviso_id_fkey" FOREIGN KEY ("aviso_id") REFERENCES "aviso_privacidad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consentimiento" ADD CONSTRAINT "consentimiento_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ===========================================================================
-- MIGRACION DE DATOS: rol de columna a tabla (AZ-M1.3, roles multiples)
-- ===========================================================================
-- Se ejecuta AQUI (no donde Prisma lo puso) porque usuario_rol ya existe.
-- Cada usuario conserva el rol que tenia; a partir de ahora puede tener varios.
INSERT INTO "usuario_rol" ("id", "tenant_id", "usuario_id", "rol", "creado_en")
SELECT gen_random_uuid(), u."tenant_id", u."id", u."rol"::text::"Rol", now()
  FROM "usuario" u
 WHERE u."rol" IS NOT NULL;

ALTER TABLE "usuario" DROP COLUMN "rol";

-- ===========================================================================
-- RLS de las tablas nuevas de public (§3, ADR-004)
-- ===========================================================================
-- Toda tabla de negocio nace con politica. No es un recordatorio: el gate
-- test/aislamiento.test.ts recorre pg_class y se pone rojo si falta alguna.
--
-- Las tablas de "plataforma" NO llevan RLS de tenant a proposito (ADR-008):
-- su dueno es ZaharDev, no una escuela. Su frontera es el guard de plataforma
-- del API. Por eso el gate solo exige RLS en el esquema public.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'usuario_rol', 'periodo', 'cohorte', 'alumno', 'inscripcion',
    'tutor', 'tutor_alumno', 'aviso_privacidad', 'consentimiento',
    'evento_auditoria'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = app_tenant_actual()) WITH CHECK (tenant_id = app_tenant_actual())',
      t || '_aislamiento', t
    );
  END LOOP;
END $$;

-- La bitacora es append-only (§12): ni siquiera la aplicacion puede reescribir
-- la historia. Sin esto, "append-only" seria una convencion que el primer
-- UPDATE apresurado rompe en silencio.
CREATE RULE evento_auditoria_sin_update AS ON UPDATE TO "evento_auditoria" DO INSTEAD NOTHING;
CREATE RULE evento_auditoria_sin_delete AS ON DELETE TO "evento_auditoria" DO INSTEAD NOTHING;
