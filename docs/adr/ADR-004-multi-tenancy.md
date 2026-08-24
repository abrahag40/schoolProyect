# ADR-004 — Aislamiento multi-tenant con RLS y rol restringido

| Estado   | Aceptado (Sprint 0, 23-ago-2026)               |
| -------- | ---------------------------------------------- |
| Decide   | Arquitecto, con veto de Seguridad & Compliance |
| Vigencia | Vivo                                           |

## Contexto

Azahar aloja en una sola instalacion los datos de muchas escuelas: expedientes
de menores, cobranza y comunicacion familiar. Una fuga entre escuelas no es un
defecto grave — es un evento que termina la empresa, con consecuencias legales
bajo la LFPDPPP 2025 por tratarse de datos de menores.

El aislamiento debia decidirse en el Sprint 0 porque, como registra el proyecto
del que se rescato la practica, retro-instalar RLS obliga a auditar cada
consulta ya escrita; nacer con el cuesta aproximadamente diez veces menos.

## Opciones consideradas

1. **Filtrado en la aplicacion.** Cada consulta agrega `WHERE tenant_id = ?`.
   Simple y sin infraestructura, pero la seguridad depende de que ningun
   desarrollador olvide una clausula, para siempre. Un solo olvido es una fuga.
2. **Base de datos por escuela.** Aislamiento perfecto, pero migrar N bases,
   conectar N pools y operar N respaldos hace inviable el modelo de precios
   accesibles que el producto necesita.
3. **RLS de PostgreSQL + filtrado en la aplicacion (elegida).** La base rechaza
   filas ajenas aunque la consulta este mal escrita; la aplicacion filtra
   ademas. Defensa en profundidad.

## Decision

Se adopta la opcion 3 con cuatro piezas que solo funcionan juntas:

1. **RLS con `FORCE`** en toda tabla de negocio. Sin `FORCE`, el dueno de la
   tabla se salta sus propias politicas.
2. **Politicas deny-by-default:** comparan contra
   `NULLIF(current_setting('app.current_tenant', true), '')::uuid`. Si nadie
   declaro el tenant, la comparacion da NULL y no se ve NINGUNA fila. Una
   consulta que olvida abrir contexto no ve datos ajenos: no ve nada. Falla
   cerrado.
3. **Rol de aplicacion `azahar_app`** con `NOSUPERUSER NOBYPASSRLS`. El rol
   dueno existe solo para migrar (§26).
4. **`conTenant()`** declara el tenant con `set_config(..., is_local => true)`
   dentro de una transaccion, de modo que el valor muere con ella (§27). Con
   pooling, un ajuste de sesion sobreviviria a la peticion y la siguiente
   heredaria el tenant anterior.

## Consecuencias

**A favor.** El aislamiento es una propiedad de la base, verificable de forma
independiente del codigo de aplicacion. La prueba correspondiente detecta la
falla real: al desactivar RLS en una tabla, cinco pruebas se ponen rojas.

**En contra.** Toda tabla nueva debe nacer con su politica; se mitiga con un
gate que recorre `pg_class` y falla si alguna tabla de negocio carece de RLS o
de `FORCE`. Las operaciones de plataforma (resolver una escuela por slug en el
login) necesitan una via explicita: se resolvio con una funcion
`SECURITY DEFINER` de superficie minima, no abriendo la tabla.

**Costo aceptado.** Las pruebas de datos exigen un Postgres real; no se pueden
sustituir por dobles de prueba, porque un doble no evalua politicas RLS.

## Escape hatch

Si una escuela creciera tanto que su volumen degradara al resto, la salida es
moverla a su propia base conservando el mismo esquema y las mismas politicas: el
codigo no cambia, cambia la cadena de conexion. La decision se tomaria con
mediciones, no por precaucion.
