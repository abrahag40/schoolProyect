-- ---------------------------------------------------------------------------
-- Sprint 6 — RVOE por nivel educativo y cuotas voluntarias (AZ-A1 / AZ-M4.2).
--
-- Dos correcciones que comparten una idea: el sistema estaba permitiendo cosas
-- que la ley no permite, y ninguna de las dos se notaba mirando la pantalla.
-- ---------------------------------------------------------------------------

-- ===========================================================================
-- 1 · EL RVOE VA POR NIVEL, NO POR SEDE  (defecto de datos maestros)
-- ===========================================================================
-- El Reconocimiento de Validez Oficial de Estudios se otorga por programa y
-- nivel. Una escuela con preescolar, primaria y secundaria tiene TRES acuerdos
-- con numeros distintos, y el complemento IEDU del SAT exige el que corresponde
-- al nivel del concepto que se factura.
--
-- Guardabamos uno solo por plantel desde el Sprint 0. Con tres niveles, dos de
-- cada tres CFDI habrian salido con el acuerdo equivocado: un dato fiscal
-- incorrecto en un comprobante YA TIMBRADO, que no se arregla editando sino
-- cancelando y reemitiendo, con la ventana dura del CFF 29-A encima.
--
-- Se corrige AHORA porque no hay una sola escuela real cargada. En el Release 2
-- esto mismo cuesta una migracion de datos de clientes en produccion.

CREATE TABLE "rvoe" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "sede_id" UUID NOT NULL,
    "nivel_educativo" "NivelEducativo" NOT NULL,
    "acuerdo" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rvoe_pkey" PRIMARY KEY ("id")
);

-- Un solo acuerdo por sede y nivel: dos filas para primaria en el mismo plantel
-- harian que la factura dependiera de cual leyo la consulta primero.
CREATE UNIQUE INDEX "rvoe_sede_id_nivel_educativo_key" ON "rvoe"("sede_id", "nivel_educativo");
CREATE INDEX "rvoe_tenant_id_idx" ON "rvoe"("tenant_id");

ALTER TABLE "rvoe" ADD CONSTRAINT "rvoe_sede_id_fkey"
  FOREIGN KEY ("sede_id") REFERENCES "sede"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "rvoe"
  ADD CONSTRAINT rvoe_acuerdo_no_vacio CHECK (length(btrim("acuerdo")) > 0);

-- Backfill: por cada sede con RVOE capturado, se crea una fila por cada nivel
-- educativo que esa escuela usa de verdad en su catalogo de cargos.
--
-- LIMITE CONOCIDO, y por eso queda escrito: el acuerdo se copia igual para
-- todos los niveles, porque el dato viejo no distinguia. Si una escuela tenia
-- tres niveles, las tres filas nacen con el mismo numero y hay que corregir dos
-- a mano. Es lo mas fiel que se puede reconstruir de una columna que nunca supo
-- de que nivel hablaba — y sigue siendo mejor que perder el dato.
INSERT INTO "rvoe" (id, tenant_id, sede_id, nivel_educativo, acuerdo, creado_en)
SELECT gen_random_uuid(), s.tenant_id, s.id, niveles.nivel_educativo, s.rvoe, now()
  FROM "sede" s
  JOIN (
    SELECT DISTINCT tenant_id, nivel_educativo
      FROM "concepto_cargo"
     WHERE nivel_educativo IS NOT NULL
  ) niveles ON niveles.tenant_id = s.tenant_id
 WHERE s.rvoe IS NOT NULL AND length(btrim(s.rvoe)) > 0;

-- Se ELIMINA la columna vieja en vez de dejarla "por si acaso": dos fuentes de
-- la verdad para el mismo dato fiscal es como se reintroduce el defecto. Quien
-- busque el RVOE ahora encuentra un solo lugar donde mirar.
ALTER TABLE "sede" DROP COLUMN "rvoe";

-- ===========================================================================
-- 2 · CUOTAS VOLUNTARIAS  (Acuerdo DOF 10-mar-1992, arts. 3 y 5-III)
-- ===========================================================================
-- El Acuerdo obliga a informar que pagos son obligatorios y cuales voluntarios,
-- y prohibe condicionar el servicio educativo a los voluntarios.
--
-- Un sistema que deja generar una "cooperacion voluntaria" a los 400 alumnos de
-- golpe la vuelve obligatoria de hecho: aparece en el estado de cuenta, suma al
-- adeudo y entra a la lista de morosos. Llamarla voluntaria en la pantalla no
-- cambia lo que el sistema hace con ella.
--
-- Por eso un concepto VOLUNTARIO no se genera masivamente: solo se le cobra a
-- quien lo acepto, y la aceptacion queda con fecha y con quien la registro. Esa
-- fila ES la prueba de que la escuela informo y la familia eligio.

CREATE TYPE "Obligatoriedad" AS ENUM ('OBLIGATORIA', 'VOLUNTARIA');

-- Nace OBLIGATORIA porque es lo que eran todos los conceptos hasta hoy: el
-- default no cambia el comportamiento de lo ya capturado.
ALTER TABLE "concepto_cargo"
  ADD COLUMN "obligatoriedad" "Obligatoriedad" NOT NULL DEFAULT 'OBLIGATORIA';

CREATE TABLE "aceptacion_de_cuota" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "alumno_id" UUID NOT NULL,
    "concepto_id" UUID NOT NULL,
    "aceptada_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registrada_por" UUID,

    CONSTRAINT "aceptacion_de_cuota_pkey" PRIMARY KEY ("id")
);

-- Aceptar dos veces la misma cuota es la misma aceptacion, no dos.
CREATE UNIQUE INDEX "aceptacion_de_cuota_alumno_id_concepto_id_key"
  ON "aceptacion_de_cuota"("alumno_id", "concepto_id");
CREATE INDEX "aceptacion_de_cuota_tenant_id_concepto_id_idx"
  ON "aceptacion_de_cuota"("tenant_id", "concepto_id");

ALTER TABLE "aceptacion_de_cuota" ADD CONSTRAINT "aceptacion_de_cuota_alumno_id_fkey"
  FOREIGN KEY ("alumno_id") REFERENCES "alumno"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "aceptacion_de_cuota" ADD CONSTRAINT "aceptacion_de_cuota_concepto_id_fkey"
  FOREIGN KEY ("concepto_id") REFERENCES "concepto_cargo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Una cuota voluntaria NO puede ser colegiatura. La colegiatura es la
-- contraprestacion del servicio educativo: si fuera voluntaria, no habria nada
-- que cobrar. Y marcada asi entraria al contador del Articulo 7, que es
-- exactamente el defecto que §52 acaba de cerrar.
ALTER TABLE "concepto_cargo"
  ADD CONSTRAINT concepto_voluntaria_no_es_colegiatura CHECK (
    "obligatoriedad" = 'OBLIGATORIA' OR NOT "es_colegiatura"
  );

-- ---------------------------------------------------------------------------
-- RLS de las tablas nuevas (§3).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rvoe', 'aceptacion_de_cuota'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (tenant_id = app_tenant_actual()) WITH CHECK (tenant_id = app_tenant_actual())',
      t || '_aislamiento', t);
  END LOOP;
END $$;
