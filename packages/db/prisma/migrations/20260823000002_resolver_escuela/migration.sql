-- Resolucion de escuela por slug para el inicio de sesion.
--
-- EL PROBLEMA (detectado al probar el login de punta a punta, Sprint 0):
-- la tabla "tenant" esta bajo RLS deny-by-default, asi que sin contexto de
-- tenant no se ve ninguna fila. Pero el login necesita justamente lo contrario:
-- resolver "colegio-azahar" -> uuid ANTES de poder declarar contexto. Es un
-- huevo-y-gallina inherente al diseno, no un descuido.
--
-- LO QUE NO SE HIZO Y POR QUE:
--   a) Quitar RLS de "tenant": abriria el listado completo de escuelas
--      clientes de ZaharDev a cualquier consulta de la aplicacion.
--   b) Que el login use el rol dueno: tiraria por la borda todo el modelo de
--      aislamiento por conveniencia de un endpoint.
--
-- LA SOLUCION: una funcion SECURITY DEFINER con superficie minima. Corre con
-- los privilegios del dueno (por eso ve la fila) pero SOLO puede hacer una
-- cosa: devolver los datos publicos de UNA escuela dado su slug exacto. No
-- lista, no busca por prefijo, no expone otras columnas. El slug ya es publico
-- por diseno (va en la URL de acceso de cada escuela).
--
-- search_path fijo: sin el, un atacante con permiso de crear objetos podria
-- anteponer un esquema propio y secuestrar lo que la funcion resuelve.

CREATE OR REPLACE FUNCTION resolver_escuela_por_slug(p_slug text)
  RETURNS TABLE (id uuid, nombre text, vertical text, activo boolean)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, pg_temp
  AS $$
    SELECT t.id, t.nombre, t.vertical::text, t.activo
      FROM tenant t
     WHERE t.slug = p_slug
     LIMIT 1
  $$;

-- Nadie la ejecuta por defecto; ensure-app-role.mjs otorga EXECUTE al rol de
-- aplicacion. Asi el permiso vive junto al resto de los grants y no se olvida.
REVOKE ALL ON FUNCTION resolver_escuela_por_slug(text) FROM PUBLIC;
