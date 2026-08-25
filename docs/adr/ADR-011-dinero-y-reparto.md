# ADR-011 — Representación del dinero y reparto entre pagadores

| Estado   | Aceptado (25-ago-2026, Sprint 4)                                     |
| -------- | -------------------------------------------------------------------- |
| Decide   | Arquitecto + Dev; veto de Cobranza si cambia lo que la escuela cobra |
| Vigencia | Vivo                                                                 |

## Contexto

El Sprint 4 introduce el primer cálculo con dinero del producto. Es también el
primer lugar donde un defecto no produce una pantalla rota sino algo peor: una
cifra creíble y equivocada, que nadie detecta hasta el corte del mes.

Dos problemas concretos:

1. **Cómo se representa un importe** a lo largo de todo el viaje: base de datos
   → dominio → JSON → interfaz → de vuelta.
2. **Cómo se reparte** un cargo entre varios pagadores cuando el reparto no es
   exacto — el caso normal en México, donde dos padres separados dividen la
   colegiatura y a veces entra un tercer pagador.

## Decisión 1 — Decimal en la base, centavos enteros en el dominio, cadena en el JSON

- **Base de datos:** `DECIMAL(10,2)`. Es exacto por definición.
- **Dominio:** enteros de centavos. `2450.00` viaja como `245000`. Todas las
  operaciones —repartir, calcular recargo— ocurren sobre enteros.
- **JSON:** cadena, nunca número. `"2450.00"`, no `2450.00`.

**Por qué la cadena y no el número:** en cuanto un importe se convierte a
`number` para pasar por JSON deja de ser exacto, y el error entra por una puerta
que nadie vigila. Se pierde la comodidad de operar directo en el cliente — que
es justamente lo que no queremos que el cliente haga.

**Redondeo:** al centavo más cercano, medio hacia arriba, en un solo lugar
(`calcularRecargo`). Que el criterio sea único importa más que cuál sea.

## Decisión 2 — Reparto por el método del resto mayor

Se asigna a cada pagador la parte entera de su porcentaje y el sobrante se
distribuye de a un centavo entre quienes tengan el resto más grande; los empates
se rompen por orden de llegada.

**Alternativa descartada — redondear cada parte por separado:** repartir 100.00
en tres partes iguales daría 33.33 tres veces, y 99.99 no es 100.00. Ese centavo
perdido reaparece meses después como "el corte no cuadra", y para entonces nadie
asocia el síntoma con su causa.

**La invariante:** la suma de las partes es **exactamente** el total. No se
confía a la inspección: se prueba barriendo ocho repartos reales del sector
—50/50, 60/40, tercios, beca del 15%, pagador único, cuartos— contra un rango de
importes de un centavo a diez mil pesos.

**Determinismo:** el mismo cargo repartido dos veces da el mismo resultado. Sin
esto, regenerar produciría diferencias de un centavo entre corridas.

## Decisión 3 — El reparto se congela

Las partes se calculan al generar el cargo y se guardan. No se recalculan al
leer.

**Por qué:** el porcentaje de un tutor puede cambiar (un convenio nuevo, un
divorcio, una beca). Recalcular al leer haría que ese cambio reescribiera
retroactivamente lo que cada quien debía en meses ya cerrados — y volvería
imposible demostrar que se cobró lo que se anunció, que es justamente lo que el
Acuerdo de PROFECO exige poder sostener.

## Decisión 4 — Qué NO se puso en la base de datos, y por qué

La invariante "la suma de las partes es el monto del cargo" es una condición
**entre filas**. Expresarla exigiría un trigger de constraint diferido: una
pieza más que puede fallar, que hay que mantener y que dispara en cada
escritura.

Se sostiene en su lugar con dos cosas: la función pura de reparto (probada por
invariante sobre un barrido de importes) y una prueba de cableado real que
verifica la suma **contra la base**, para todos los cargos repartidos. Si algún
día otro camino escribe partes —una importación, un servicio nuevo— esta
decisión se revisa.

Lo que sí quedó como restricción en la base, porque una importación o un script
de mantenimiento pueden escribir sin pasar por el dominio:

- Un concepto **deducible sin nivel educativo** no entra. El complemento IEDU lo
  exige; sin él, el CFDI se rechaza al timbrar y la familia pierde su deducción
  un año después, cuando ya no hay arreglo.
- Un cargo **cancelado sin motivo** no entra. Un cargo que desaparece sin
  explicación es un agujero en la contabilidad de la escuela.
- Una **fecha límite sin recargo anterior al vencimiento** no entra. Cobrar mora
  antes de que algo venza no tiene sentido.

## Consecuencias

**A favor.** El dinero es exacto de extremo a extremo y la exactitud está
probada, no supuesta. El cálculo vive en un módulo puro que se prueba en
milisegundos y sin base de datos.

**En contra, y declarado.** Operar con centavos obliga a convertir en la
frontera, y esa conversión es un lugar donde se puede introducir un defecto. Por
eso `aCentavos`/`aMonto` viven en un solo archivo, tienen prueba de ida y vuelta
y no se reimplementan en ningún otro lado.

**Pendiente para el Sprint 5.** Los pagos parciales y las notas de crédito
tocarán este mismo modelo. La decisión de congelar el reparto es lo que hará
posible aplicar un pago a la parte de un pagador concreto sin ambigüedad.
