-- CreateEnum
CREATE TYPE "MetodoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA', 'DEPOSITO', 'TARJETA', 'OTRO');

-- CreateTable
CREATE TABLE "pago" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "tutor_id" UUID NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha" DATE NOT NULL,
    "metodo" "MetodoPago" NOT NULL,
    "referencia" TEXT,
    "nota" TEXT,
    "registrado_por" UUID,
    "registrado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelado_en" TIMESTAMPTZ(6),
    "motivo_cancelacion" TEXT,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aplicacion_de_pago" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "pago_id" UUID NOT NULL,
    "parte_de_cargo_id" UUID NOT NULL,
    "monto" DECIMAL(10,2) NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aplicacion_de_pago_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pago_tenant_id_fecha_idx" ON "pago"("tenant_id", "fecha");

-- CreateIndex
CREATE INDEX "pago_tenant_id_tutor_id_idx" ON "pago"("tenant_id", "tutor_id");

-- CreateIndex
CREATE INDEX "aplicacion_de_pago_tenant_id_parte_de_cargo_id_idx" ON "aplicacion_de_pago"("tenant_id", "parte_de_cargo_id");

-- CreateIndex
CREATE UNIQUE INDEX "aplicacion_de_pago_pago_id_parte_de_cargo_id_key" ON "aplicacion_de_pago"("pago_id", "parte_de_cargo_id");

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "pago_tutor_id_fkey" FOREIGN KEY ("tutor_id") REFERENCES "tutor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacion_de_pago" ADD CONSTRAINT "aplicacion_de_pago_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pago"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aplicacion_de_pago" ADD CONSTRAINT "aplicacion_de_pago_parte_de_cargo_id_fkey" FOREIGN KEY ("parte_de_cargo_id") REFERENCES "parte_de_cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Integridad del dinero que entra (§3, §4).
-- ---------------------------------------------------------------------------
ALTER TABLE "pago"
  -- Un pago de cero no es un pago; uno negativo es una devolucion, y eso es
  -- otro concepto que hoy no existe. Se rechaza en vez de aceptarse a medias.
  ADD CONSTRAINT pago_monto_positivo CHECK ("monto" > 0),
  -- Cancelar exige decir por que, igual que en los cargos.
  ADD CONSTRAINT pago_cancelacion_con_motivo
    CHECK (("cancelado_en" IS NULL) = ("motivo_cancelacion" IS NULL));

ALTER TABLE "aplicacion_de_pago"
  ADD CONSTRAINT aplicacion_monto_positivo CHECK ("monto" > 0);

-- NOTA sobre las dos invariantes que NO estan aqui: "la suma aplicada de un
-- pago no excede su importe" y "la suma aplicada a una parte no excede lo que
-- debe" son condiciones ENTRE FILAS. Expresarlas exigiria triggers diferidos,
-- una pieza mas que mantener y que dispara en cada escritura. Se sostienen con
-- la funcion pura de aplicacion (probada por invariante) y con pruebas de
-- cableado que las verifican contra esta misma base — el mismo criterio que
-- ADR-011 fijo para el reparto.

-- ---------------------------------------------------------------------------
-- RLS de las tablas nuevas (§3).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['pago', 'aplicacion_de_pago'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = app_tenant_actual()) WITH CHECK (tenant_id = app_tenant_actual())',
      t || '_aislamiento', t);
  END LOOP;
END $$;
