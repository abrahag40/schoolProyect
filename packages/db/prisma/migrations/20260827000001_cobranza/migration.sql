-- CreateEnum
CREATE TYPE "Periodicidad" AS ENUM ('MENSUAL', 'UNICO', 'ANUAL');

-- CreateEnum
CREATE TYPE "EstadoCargo" AS ENUM ('PENDIENTE', 'PAGADO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "NivelEducativo" AS ENUM ('PREESCOLAR', 'PRIMARIA', 'SECUNDARIA', 'PROFESIONAL_TECNICO', 'BACHILLERATO');

-- AlterTable
ALTER TABLE "configuracion_escuela" ADD COLUMN     "dia_vencimiento_por_omision" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "dias_gracia_sin_recargo" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "recargo_porcentaje" DECIMAL(5,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "concepto_cargo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "clave" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "periodicidad" "Periodicidad" NOT NULL,
    "monto_base" DECIMAL(10,2) NOT NULL,
    "dia_vencimiento" INTEGER NOT NULL DEFAULT 5,
    "cohorte_id" UUID,
    "deducible_iedu" BOOLEAN NOT NULL DEFAULT false,
    "nivel_educativo" "NivelEducativo",
    "vigente_desde" DATE NOT NULL,
    "avisado_en" DATE,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "concepto_cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "alumno_id" UUID NOT NULL,
    "concepto_id" UUID NOT NULL,
    "periodo" VARCHAR(7) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha_vencimiento" DATE NOT NULL,
    "fecha_limite_sin_recargo" DATE NOT NULL,
    "estado" "EstadoCargo" NOT NULL DEFAULT 'PENDIENTE',
    "clave" TEXT NOT NULL,
    "generado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generado_por" UUID,
    "cancelado_en" TIMESTAMPTZ(6),
    "motivo_cancelacion" TEXT,

    CONSTRAINT "cargo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parte_de_cargo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "porcentaje" DECIMAL(5,2) NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "parte_de_cargo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "concepto_cargo_tenant_id_activo_idx" ON "concepto_cargo"("tenant_id", "activo");

-- CreateIndex
CREATE UNIQUE INDEX "concepto_cargo_tenant_id_clave_key" ON "concepto_cargo"("tenant_id", "clave");

-- CreateIndex
CREATE INDEX "cargo_tenant_id_periodo_idx" ON "cargo"("tenant_id", "periodo");

-- CreateIndex
CREATE INDEX "cargo_tenant_id_alumno_id_periodo_idx" ON "cargo"("tenant_id", "alumno_id", "periodo");

-- CreateIndex
CREATE INDEX "cargo_tenant_id_estado_fecha_vencimiento_idx" ON "cargo"("tenant_id", "estado", "fecha_vencimiento");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_tenant_id_clave_key" ON "cargo"("tenant_id", "clave");

-- CreateIndex
CREATE INDEX "parte_de_cargo_tenant_id_tutor_id_idx" ON "parte_de_cargo"("tenant_id", "tutor_id");

-- CreateIndex
CREATE UNIQUE INDEX "parte_de_cargo_cargo_id_tutor_id_key" ON "parte_de_cargo"("cargo_id", "tutor_id");

-- AddForeignKey
ALTER TABLE "concepto_cargo" ADD CONSTRAINT "concepto_cargo_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "concepto_cargo" ADD CONSTRAINT "concepto_cargo_cohorte_id_fkey" FOREIGN KEY ("cohorte_id") REFERENCES "cohorte"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_alumno_id_fkey" FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo" ADD CONSTRAINT "cargo_concepto_id_fkey" FOREIGN KEY ("concepto_id") REFERENCES "concepto_cargo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parte_de_cargo" ADD CONSTRAINT "parte_de_cargo_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parte_de_cargo" ADD CONSTRAINT "parte_de_cargo_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integridad del dinero (§3, §4). Estas reglas viven en la BASE y no solo en
-- la aplicacion porque una importacion, un script de mantenimiento o un
-- servicio futuro pueden escribir sin pasar por el dominio.
-- ---------------------------------------------------------------------------
ALTER TABLE "concepto_cargo"
  ADD CONSTRAINT concepto_cargo_monto_no_negativo CHECK ("monto_base" >= 0),
  ADD CONSTRAINT concepto_cargo_dia_valido CHECK ("dia_vencimiento" BETWEEN 1 AND 31),
  -- REGLA FISCAL EN LA BASE: el complemento IEDU exige el nivel educativo. Un
  -- concepto marcado como deducible sin nivel produce un CFDI que el SAT
  -- rechaza al timbrar, y para entonces la familia ya perdio su deduccion.
  ADD CONSTRAINT concepto_cargo_iedu_completo
    CHECK (NOT "deducible_iedu" OR "nivel_educativo" IS NOT NULL);

ALTER TABLE "cargo"
  ADD CONSTRAINT cargo_monto_no_negativo CHECK ("monto" >= 0),
  ADD CONSTRAINT cargo_periodo_formato CHECK ("periodo" ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  -- El limite sin recargo NUNCA puede ser anterior al vencimiento: cobrar mora
  -- antes de que algo venza no tiene sentido, y el Articulo 4 del Acuerdo DOF
  -- 10-mar-1992 ademas obliga a los primeros diez dias naturales del mes.
  ADD CONSTRAINT cargo_limite_no_anterior_al_vencimiento
    CHECK ("fecha_limite_sin_recargo" >= "fecha_vencimiento"),
  -- Cancelar exige decir por que. Un cargo que desaparece sin motivo es un
  -- agujero en la contabilidad de la escuela.
  ADD CONSTRAINT cargo_cancelacion_con_motivo
    CHECK (("cancelado_en" IS NULL) = ("motivo_cancelacion" IS NULL));

ALTER TABLE "parte_de_cargo"
  ADD CONSTRAINT parte_porcentaje_valido CHECK ("porcentaje" > 0 AND "porcentaje" <= 100),
  ADD CONSTRAINT parte_monto_no_negativo CHECK ("monto" >= 0);

-- NOTA sobre la invariante que NO esta aqui: "la suma de las partes es
-- exactamente el monto del cargo" es una condicion entre filas, y expresarla
-- exigiria un trigger de constraint diferido — una pieza mas que puede fallar
-- y que hay que mantener. Se sostiene en su lugar con la funcion pura de
-- reparto (probada por invariante sobre un barrido de importes) y con una
-- prueba de cableado real que la verifica contra esta misma base. Si algun dia
-- otro camino escribe partes, esta decision se revisa.

-- ---------------------------------------------------------------------------
-- RLS de las tablas nuevas (§3). El gate de aislamiento recorre pg_class y se
-- pone rojo si una tabla de negocio nace sin politica: no es opcional.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['concepto_cargo', 'cargo', 'parte_de_cargo'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = app_tenant_actual()) WITH CHECK (tenant_id = app_tenant_actual())',
      t || '_aislamiento', t);
  END LOOP;
END $$;
