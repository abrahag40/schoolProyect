-- ---------------------------------------------------------------------------
-- Sprint 6 — prorrateo al alta y descuento por pronto pago (AZ-M4.1 / AZ-M4.3b).
--
-- Migracion aparte de la anterior, y no una edicion de aquella, porque
-- 20260830000001 ya se aplico: reescribir una migracion aplicada rompe la suma
-- de verificacion de Prisma y deja la base de cualquiera que ya migro en un
-- estado que no coincide con el historial. Se agrega, no se reescribe.
-- ---------------------------------------------------------------------------

-- PRORRATEO como categoria propia. Va ANTES que BECA en el orden de aplicacion
-- (ver `descuentos.ts`): no es un descuento, fija el precio real de lo que se
-- cobra. Aplicar la beca antes del prorrateo becaria dias que el alumno no
-- estuvo en la escuela.
ALTER TYPE "CategoriaDescuento" ADD VALUE IF NOT EXISTS 'PRORRATEO' BEFORE 'BECA';

-- ---------------------------------------------------------------------------
-- Pronto pago: se declara en el concepto y se CONGELA en cada cargo.
--
-- Por que congelado: si la escuela cambia su politica de descuentos en
-- noviembre, los cargos de septiembre tienen que conservar lo que se le ofrecio
-- a la familia cuando se emitieron. Es el mismo criterio que la fecha limite
-- sin recargo del Articulo 4 (§44, ADR-011).
-- ---------------------------------------------------------------------------
ALTER TABLE "concepto_cargo"
  ADD COLUMN "descuento_pronto_pago_porcentaje" DECIMAL(5,2),
  ADD COLUMN "dia_pronto_pago" INTEGER;

ALTER TABLE "cargo"
  ADD COLUMN "fecha_limite_pronto_pago" DATE,
  ADD COLUMN "descuento_pronto_pago_porcentaje" DECIMAL(5,2);

ALTER TABLE "descuento_de_cargo"
  ADD COLUMN "parte_de_cargo_id" UUID;

CREATE INDEX "descuento_de_cargo_tenant_id_parte_de_cargo_id_idx"
  ON "descuento_de_cargo"("tenant_id", "parte_de_cargo_id");

ALTER TABLE "descuento_de_cargo" ADD CONSTRAINT "descuento_de_cargo_parte_de_cargo_id_fkey"
  FOREIGN KEY ("parte_de_cargo_id") REFERENCES "parte_de_cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Que no se pueda capturar un pronto pago que nunca se podra aplicar.
-- ---------------------------------------------------------------------------
ALTER TABLE "concepto_cargo"
  -- Los dos campos van juntos o ninguno. Un porcentaje sin fecha no se puede
  -- aplicar nunca, y una fecha sin porcentaje no descuenta nada: en los dos
  -- casos la escuela cree que ofrece un descuento y no ofrece ninguno.
  ADD CONSTRAINT concepto_pronto_pago_completo CHECK (
    ("descuento_pronto_pago_porcentaje" IS NULL) = ("dia_pronto_pago" IS NULL)
  ),
  ADD CONSTRAINT concepto_pronto_pago_en_rango CHECK (
    "descuento_pronto_pago_porcentaje" IS NULL
    OR ("descuento_pronto_pago_porcentaje" > 0 AND "descuento_pronto_pago_porcentaje" <= 100)
  ),
  ADD CONSTRAINT concepto_dia_pronto_pago_en_rango CHECK (
    "dia_pronto_pago" IS NULL OR ("dia_pronto_pago" >= 1 AND "dia_pronto_pago" <= 31)
  );

ALTER TABLE "cargo"
  ADD CONSTRAINT cargo_pronto_pago_completo CHECK (
    ("fecha_limite_pronto_pago" IS NULL) = ("descuento_pronto_pago_porcentaje" IS NULL)
  ),
  -- La ventana de pronto pago NO puede terminar despues de la fecha limite sin
  -- recargo: premiar por "pagar temprano" un dia en que ya se cobra mora seria
  -- premiar y penalizar el mismo acto.
  ADD CONSTRAINT cargo_pronto_pago_antes_del_limite CHECK (
    "fecha_limite_pronto_pago" IS NULL
    OR "fecha_limite_pronto_pago" <= "fecha_limite_sin_recargo"
  );
