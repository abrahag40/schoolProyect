-- Aislamiento multi-tenant por Row Level Security (ADR-004).
--
-- Estrategia: defensa en profundidad.
--   Capa 1 (esta): la base rechaza filas de otro tenant, pase lo que pase.
--   Capa 2 (app):  el repositorio filtra ademas por tenantId.
--
-- Deny-by-default: si la sesion no declaro su tenant, current_setting(...)
-- devuelve NULL, la comparacion da NULL y NINGUNA fila es visible. Una consulta
-- que "olvida" abrir contexto no ve datos ajenos: no ve nada. Es el
-- comportamiento correcto — fallar cerrado, nunca abierto.
--
-- FORCE: sin el, el dueno de la tabla se salta sus propias politicas. Con el,
-- ni el dueno escapa. El rol de aplicacion ademas es NOBYPASSRLS.

-- Funcion unica para leer el tenant de la sesion. Centralizarla evita que cada
-- politica repita (y eventualmente desincronice) la expresion.
CREATE OR REPLACE FUNCTION app_tenant_actual() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$ SELECT NULLIF(current_setting('app.current_tenant', true), '')::uuid $$;

-- El tenant se identifica a si mismo por id (no tiene tenant_id).
ALTER TABLE "tenant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_aislamiento ON "tenant"
  USING (id = app_tenant_actual())
  WITH CHECK (id = app_tenant_actual());

ALTER TABLE "sede" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sede" FORCE ROW LEVEL SECURITY;
CREATE POLICY sede_aislamiento ON "sede"
  USING (tenant_id = app_tenant_actual())
  WITH CHECK (tenant_id = app_tenant_actual());

ALTER TABLE "usuario" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "usuario" FORCE ROW LEVEL SECURITY;
CREATE POLICY usuario_aislamiento ON "usuario"
  USING (tenant_id = app_tenant_actual())
  WITH CHECK (tenant_id = app_tenant_actual());

-- Nota para quien agregue una tabla en un sprint futuro: el gate
-- test/rls-cobertura.test.ts falla si una tabla de negocio nace sin politica.
-- No es un recordatorio amable: es un test que se pone rojo.
