-- Lectura de nombres de escuela para la consola de plataforma (C1).
--
-- EL PROBLEMA: la consola necesita mostrar "Colegio Azahar" junto a su
-- suscripcion, pero public.tenant esta bajo RLS deny-by-default y la consola
-- opera SIN contexto de tenant (mira a todos los clientes a la vez, que es
-- justamente su trabajo).
--
-- LO QUE NO SE HIZO: dar BYPASSRLS al rol de aplicacion — apagaria el
-- aislamiento de TODA la operacion para resolver una etiqueta de una pantalla.
--
-- LA SOLUCION: la misma del login (migracion 20260823000002): una funcion
-- SECURITY DEFINER de superficie minima. Devuelve id, nombre y vertical de las
-- escuelas QUE SON CLIENTES, y nada mas: ni correos, ni alumnos, ni datos
-- operativos. Vive en el esquema plataforma porque es una capacidad de la
-- consola, no de la operacion.

CREATE OR REPLACE FUNCTION plataforma.escuelas_de_clientes()
  RETURNS TABLE (id uuid, nombre text, vertical text)
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public, plataforma, pg_temp
  AS $$
    SELECT t.id, t.nombre, t.vertical::text
      FROM public.tenant t
     WHERE EXISTS (SELECT 1 FROM plataforma.cliente c WHERE c.tenant_id = t.id)
  $$;

REVOKE ALL ON FUNCTION plataforma.escuelas_de_clientes() FROM PUBLIC;
