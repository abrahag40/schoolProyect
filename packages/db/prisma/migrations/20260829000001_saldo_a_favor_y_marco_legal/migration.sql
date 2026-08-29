-- ---------------------------------------------------------------------------
-- Sprint 5, ampliacion aprobada en el gate del 26-ago-2026 (D15, cambio C3).
--
-- Dos banderas en el catalogo de cargos. Ninguna es una preferencia de la
-- escuela: cada una cierra un defecto concreto.
--
--   es_colegiatura       -> el Articulo 7 del Acuerdo DOF 10-mar-1992 cuenta
--                           COLEGIATURAS, no adeudos. Hasta hoy el panel de
--                           morosidad contaba cualquier cargo vencido, asi que
--                           una excursion impaga podia empujar a una familia al
--                           umbral de suspension antes de tiempo. Eso es
--                           exposicion legal DEL CLIENTE causada por nosotros.
--
--   acepta_saldo_a_favor -> que conceptos pueden saldarse con el dinero que la
--                           familia ya tiene a favor (AZ-M4.10).
-- ---------------------------------------------------------------------------

ALTER TABLE "concepto_cargo"
  ADD COLUMN "es_colegiatura" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acepta_saldo_a_favor" BOOLEAN NOT NULL DEFAULT true;

-- ---------------------------------------------------------------------------
-- Backfill de es_colegiatura, y por que este criterio y no otro.
--
-- El default es `false` porque de los dos errores posibles, contar de MENOS
-- solo cuesta dinero (la escuela no suspende cuando podria) y contar de MAS
-- cuesta una multa (suspende cuando la ley todavia no se lo permite). Ante la
-- duda, el lado seguro.
--
-- Pero dejar TODO en false apagaria en silencio la lectura del Articulo 7 para
-- lo ya capturado, y un gate que deja de revisar es peor que no tenerlo (§46).
-- Asi que se marca lo que se puede afirmar con fundamento: un concepto MENSUAL
-- **y** deducible para el complemento IEDU es, por construccion fiscal, el pago
-- del servicio educativo — el Decreto de 2013 hace deducible la colegiatura,
-- no el comedor.
--
-- LIMITE CONOCIDO DE ESTE CRITERIO: el transporte escolar obligatorio tambien
-- es deducible y puede ser mensual, asi que un concepto de transporte quedaria
-- marcado de mas. Se acepta porque hoy no hay ninguna escuela real cargada y
-- porque la pantalla del catalogo deja corregirlo con una casilla. Quien lea
-- esto migrando datos de verdad: revisa el catalogo antes de confiar en el
-- contador del Articulo 7.
-- ---------------------------------------------------------------------------
UPDATE "concepto_cargo"
   SET "es_colegiatura" = true
 WHERE "periodicidad" = 'MENSUAL'
   AND "deducible_iedu" = true;

-- Las dos columnas nacen en una tabla que ya tiene RLS forzado y su politica de
-- aislamiento desde 20260827000001_cobranza: agregar columnas no la altera. No
-- hay tabla nueva, asi que no hay politica nueva que crear (§3).
