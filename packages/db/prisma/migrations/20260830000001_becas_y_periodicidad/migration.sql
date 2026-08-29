-- ---------------------------------------------------------------------------
-- Sprint 6 — becas, descuentos y periodicidad de cobro (AZ-M4.3a / AZ-M4.1c).
--
-- Dos cosas que el sistema no podia expresar y que una escuela real da por
-- sentadas:
--
--   1. Cobrar por bimestre, cuatrimestre o semestre. Hasta hoy solo habia
--      MENSUAL, UNICO y ANUAL, asi que un semestre no cabia: ANUAL lo cobraria
--      una vez cuando deberian ser dos, y MENSUAL doce.
--
--   2. Becas con vigencia. La del 5% de la matricula es OBLIGACION LEGAL
--      (LGE art. 149-III, LGES art. 70), no un descuento comercial, y hay que
--      poder demostrar a quien se beco y por que.
-- ---------------------------------------------------------------------------

-- Periodicidades nuevas. Se AGREGAN al enum existente: los conceptos ya
-- capturados conservan la suya y nada se recalcula.
ALTER TYPE "Periodicidad" ADD VALUE IF NOT EXISTS 'BIMESTRAL';
ALTER TYPE "Periodicidad" ADD VALUE IF NOT EXISTS 'CUATRIMESTRAL';
ALTER TYPE "Periodicidad" ADD VALUE IF NOT EXISTS 'SEMESTRAL';

-- NOTA sobre la columna `cargo.periodo`: sigue siendo VARCHAR(7) y NO se
-- ensancha. Las claves nuevas caben tal cual —`2026-S1`, `2026-B3`, `2026-C2`,
-- `2026-A1` son siete caracteres, igual que `2026-09`—, asi que los indices y
-- la clave de idempotencia siguen funcionando sin tocarse. Hay una prueba que
-- lo verifica: si algun formato creciera, fallaria en produccion y no en CI.

CREATE TYPE "TipoDescuento" AS ENUM ('PORCENTAJE', 'MONTO_FIJO');
CREATE TYPE "CategoriaDescuento" AS ENUM ('BECA', 'DESCUENTO');

CREATE TABLE "beca" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "alumno_id" UUID NOT NULL,
    "tipo" "TipoDescuento" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "concepto_id" UUID,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "motivo" TEXT NOT NULL,
    "es_obligacion_legal" BOOLEAN NOT NULL DEFAULT false,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "otorgada_por" UUID,
    "creada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "beca_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "descuento_de_cargo" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "beca_id" UUID,
    "categoria" "CategoriaDescuento" NOT NULL,
    "concepto" TEXT NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "descuento_de_cargo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "beca_tenant_id_alumno_id_idx" ON "beca"("tenant_id", "alumno_id");
CREATE INDEX "beca_tenant_id_activa_idx" ON "beca"("tenant_id", "activa");
CREATE INDEX "descuento_de_cargo_tenant_id_cargo_id_idx" ON "descuento_de_cargo"("tenant_id", "cargo_id");

ALTER TABLE "beca" ADD CONSTRAINT "beca_alumno_id_fkey"
  FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "beca" ADD CONSTRAINT "beca_concepto_id_fkey"
  FOREIGN KEY ("concepto_id") REFERENCES "concepto_cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "descuento_de_cargo" ADD CONSTRAINT "descuento_de_cargo_cargo_id_fkey"
  FOREIGN KEY ("cargo_id") REFERENCES "cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "descuento_de_cargo" ADD CONSTRAINT "descuento_de_cargo_beca_id_fkey"
  FOREIGN KEY ("beca_id") REFERENCES "beca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Integridad del dinero que NO se cobra (§43, §4).
--
-- Un descuento mal capturado es tan caro como un cargo mal capturado, y se
-- descubre mas tarde porque nadie reclama que le cobraron de menos.
-- ---------------------------------------------------------------------------
ALTER TABLE "beca"
  -- Una beca de cero no es una beca; una negativa es un recargo disfrazado.
  ADD CONSTRAINT beca_valor_positivo CHECK ("valor" > 0),
  -- Un porcentaje mayor que 100 seria la escuela pagandole al alumno por venir.
  ADD CONSTRAINT beca_porcentaje_en_rango
    CHECK ("tipo" <> 'PORCENTAJE' OR "valor" <= 100),
  -- Una vigencia que termina antes de empezar no aplica nunca, y nadie se da
  -- cuenta: el alumno simplemente no recibe su beca.
  ADD CONSTRAINT beca_vigencia_coherente
    CHECK ("vigente_hasta" IS NULL OR "vigente_hasta" >= "vigente_desde"),
  -- El motivo es la prueba de por que se beco. Vacio no es motivo.
  ADD CONSTRAINT beca_motivo_no_vacio CHECK (length(btrim("motivo")) > 0);

ALTER TABLE "descuento_de_cargo"
  ADD CONSTRAINT descuento_monto_positivo CHECK ("monto" > 0);

-- NOTA sobre la invariante que NO esta aqui: "Σ descuentos <= monto del cargo"
-- es una condicion ENTRE FILAS y expresarla exigiria un trigger diferido. Se
-- sostiene con la funcion pura (probada por invariante sobre 127 importes x 5
-- combinaciones) y con pruebas de cableado que la verifican contra esta misma
-- base — el mismo criterio que ADR-011 fijo para el reparto y el Sprint 5 para
-- las aplicaciones de pago.

-- ---------------------------------------------------------------------------
-- RLS de las tablas nuevas (§3). Sin esto el gate de aislamiento se pone rojo.
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['beca', 'descuento_de_cargo'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = app_tenant_actual()) WITH CHECK (tenant_id = app_tenant_actual())',
      t || '_aislamiento', t);
  END LOOP;
END $$;
