# Estudio comparativo: Azahar vs. WispHub

| Pregunta del CEO | "¿Por qué debería contratar tu sistema y no wisphub.net?"                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Fecha            | 24-ago-2026                                                                                                                                 |
| Método           | Investigación de fuentes primarias (sitio, documentación y precios del proveedor) + normativa mexicana verificada en su publicación oficial |
| Vigencia         | Vivo. Los precios y funciones del competidor se re-verifican cada trimestre                                                                 |

---

## 0 · Antes de responder: hay que corregir la premisa

**Dato duro, verificado en la fuente primaria.** WispHub **no es un sistema de
gestión escolar**. Su titular literal es "Sistema Para Administrar Wisp e Isp de
Forma Online y Simple". Es una plataforma mexicana (51–200 empleados según su
perfil corporativo) para **proveedores de internet** — WISP e ISP — presente en
varios países de Latinoamérica.

Se revisaron su portada, su página de características y su documentación
pública. **Cero menciones** de alumno, grupo, calificación, asistencia, tutor,
inscripción, ciclo escolar o expediente. Su unidad de negocio es el
**suscriptor de internet**, y su automatización insignia es el **corte del
servicio por falta de pago** ejecutado sobre un router Mikrotik.

**Inferencia propia, marcada como tal.** Comparar Azahar con WispHub no es
comparar dos productos del mismo mercado. Pero **la comparación sí es legítima**,
y por eso vale la pena hacerla bien: vista de lejos, una escuela y un ISP se
parecen mucho. Cientos de pagadores mensuales, cargos recurrentes, recargos por
mora, CFDI, recordatorios por WhatsApp, portal del cliente y app móvil. Un
director que solo quiere dejar de perseguir pagos **puede razonablemente
considerar WispHub** — y a 20 USD al mes por 200 clientes, es varias veces más
barato que cualquier sistema escolar del mercado.

Esa es la objeción real. Se responde con hechos.

---

## 1 · Qué es cada cosa (dato duro, sin adjetivos)

|                         | **WispHub**                                                                                                | **Azahar**                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Qué administra          | Suscriptores de internet                                                                                   | Alumnos, familias y la operación escolar                     |
| Unidad de cobro         | Un cliente = un servicio = un pagador                                                                      | Un alumno con **varios** pagadores y porcentajes             |
| Automatización insignia | Corte del servicio en el router                                                                            | Aviso automático a la familia por inasistencia               |
| Precio de lista         | Gratis ≤30 clientes · 20 USD/mes ≤200 · 50 USD/mes ≤800 · 80 USD/mes ilimitado (con descuento al prepagar) | Hipótesis, aún sin gate de precio                            |
| CFDI                    | Sí, CFDI 4.0: la escuela sube su propio CSD y WispHub timbra                                               | Puerto `EmisorFiscal` (ADR-002, Facturama); cimientos en MVP |
| Madurez                 | Producto en operación, con clientes en varios países                                                       | En construcción; 4 sprints entregados, sin staging todavía   |

**Lo que WispHub sí hace muy bien** (y conviene decirlo antes que lo demás, o el
análisis no es serio): facturación recurrente automática, corte y reconexión,
recargos por mora configurables, pasarelas de pago múltiples, SMS/WhatsApp/push,
portal del cliente, tickets de soporte, inventario, contratos con firma digital,
API, dos apps móviles, y permisos por zona. Es un producto maduro y barato.

---

## 2 · La respuesta corta

> **WispHub le resuelve el cobro y le deja sin resolver la escuela.** Y en el
> camino la expone a tres normas mexicanas que ese software no conoce, porque no
> fue escrito para escuelas: el Acuerdo de PROFECO del 10-mar-1992, el
> complemento IEDU del CFDI, y la LFPDPPP en su trato a datos de menores.

---

## 3 · Dónde se rompe: cuatro fracturas verificables

### 3.1 · La familia mexicana no cabe en un "cliente"

En WispHub un cliente es una entidad: un contrato, un servicio, un pagador. En
una escuela, **quien paga no es quien recibe el servicio**, y con frecuencia no
es una sola persona.

El caso que ya está modelado en Azahar desde el Sprint 1 y que en un sistema de
ISP no tiene representación posible:

- Sofía y Mateo son hermanos, cada uno en su grupo.
- Su madre y su padre están separados y dividen la colegiatura **60/40**.
- La abuela **recoge** a los niños pero **no paga** — y aun así debe recibir los
  avisos de la escuela y aparecer como autorizada para recoger.

Modelar esto como "tres clientes" duplica al alumno tres veces; como "un
cliente" borra a dos de los tres adultos. El corpus de reseñas del sector
mexicano registra este reclamo de forma repetida contra los sistemas escolares
que sí son escolares — con más razón contra uno que ni siquiera lo intenta.

### 3.2 · El corte por falta de pago es ilegal antes del tercer mes

Aquí la fractura deja de ser de producto y pasa a ser **de riesgo jurídico**.

El **Acuerdo que establece las bases mínimas de información para la
comercialización de los servicios educativos que prestan los particulares**
(DOF, 10 de marzo de 1992; vigilancia a cargo de PROFECO) establece:

- **Artículo 4** — "Los prestadores del servicio educativo deberán aceptar **sin
  cargo alguno**, los pagos por concepto de colegiaturas dentro de los **primeros
  diez días naturales de cada mes**".
- **Artículo 7** — solo el incumplimiento de **tres o más colegiaturas**,
  equivalentes a cuando menos tres meses, libera a la escuela de seguir
  prestando el servicio, y aun entonces **con 15 días de aviso previo**.
- **Artículo 7, fracciones I y II** — el alumno conserva el derecho a recibir su
  **documentación oficial** en un plazo no mayor a quince días **sin costo
  alguno**, y a presentar exámenes de regularización **en igualdad de
  condiciones que los demás**.
- **Artículo 5, fracción I** — los ajustes de cuotas se informan **cuando menos
  60 días antes** del periodo de reinscripción.

Ahora contrástese con el motor de cobranza de WispHub, según su propia
documentación: los recargos por mora se aplican **automáticamente, todos los
días, a toda factura cuya fecha de pago sea anterior al día actual**, y el corte
del servicio es automático y configurable.

**Dato duro:** un sistema de ISP configurado de fábrica cobra recargo el día 2 y
corta cuando el administrador lo programe. **Inferencia propia:** eso es
exactamente una queja ante PROFECO esperando a ocurrir. La escuela puede
intentar configurarlo para respetar los diez días — pero el software **no conoce
la regla**, así que nada impide que un cambio de configuración, un empleado
nuevo o una promoción la rompan. En Azahar esa ventana es una **regla del
dominio**, no un ajuste que alguien puede mover por descuido.

### 3.3 · Sin complemento IEDU, el padre pierde su deducción

Las colegiaturas son deducibles en México, y para que el SAT las precargue en la
declaración anual el CFDI debe llevar el **complemento IEDU** con cinco datos
obligatorios: **nombre del alumno, CURP (18 caracteres), nivel educativo, RVOE**
y **RFC del pagador**; con **uso de CFDI D10** y la descripción del concepto
diciendo explícitamente "colegiatura" y el periodo. El SAT **coteja el RVOE
contra el padrón de la SEP**: un carácter mal escrito y se rechaza.

WispHub timbra CFDI 4.0 — para un **servicio de internet**. No tiene alumno, no
tiene CURP de alumno, no tiene nivel educativo ni RVOE, porque **esos campos no
existen en su modelo de datos**. La factura saldrá válida ante el SAT y **no
servirá para deducir**.

Traducido a lo que le importa al director: cada familia que descubra en abril
que no puede deducir la colegiatura del año va a llamar a la escuela, no a
WispHub. Y la única salida será re-facturar a mano.

En Azahar el CCT y el RVOE se capturan **desde el Sprint 0** y la CURP del alumno
desde el Sprint 1, aunque la facturación llegue después — precisamente para que
ninguna escuela tenga que recapturar cuando active el módulo fiscal (principio 4,
captura única).

### 3.4 · Datos de menores, no de suscriptores

La LFPDPPP en su versión 2025 eliminó la excepción de "fines compatibles": cada
finalidad de tratamiento necesita su propio consentimiento, y las voluntarias
deben poder rechazarse **sin perder el servicio educativo**. Un sistema escolar
maneja datos de **menores de edad** — nombre, fotografía, salud, conducta.

WispHub gestiona datos de adultos que contratan internet. Su modelo de
consentimiento es el de un contrato de servicios, no el de un aviso de
privacidad versionado con evidencia por finalidad.

Azahar tiene desde el Sprint 1 el aviso de privacidad **versionado** (para poder
demostrar qué texto exacto aceptó cada tutor y cuándo) y el consentimiento
**por finalidad separada**, con canal y fecha como evidencia probatoria.

---

## 4 · Lo que WispHub tiene y nosotros no (dicho sin maquillaje)

Un análisis que solo enumera debilidades del competidor no es análisis, es
publicidad. Estas son ventajas reales de WispHub, hoy:

1. **Precio.** 20 USD al mes por 200 clientes. Cualquier propuesta nuestra se
   compara contra ese número aunque no sea el mismo producto.
2. **Nivel gratuito permanente hasta 30 clientes.** Un canal de adquisición sin
   fricción y sin vendedor.
3. **Está en producción.** Nosotros llevamos cuatro sprints y **aún no tenemos
   staging**. Ellos tienen clientes pagando en varios países.
4. **Descuento por prepago** (hasta 25% al pagar por trimestre o más): palanca de
   flujo de efectivo que nosotros no hemos diseñado.
5. **El cliente sube su propio CSD** y la plataforma timbra. Modelo simple que
   evita ser intermediario fiscal.
6. **Enlace de estado de pago sin necesidad de entrar al portal.** Idea de UX
   directamente aplicable a la cobranza con familias.

**Recomendación del Analista de Mercado:** los puntos 2, 4, 5 y 6 deberían
entrar a la cartera como candidatos, cada uno por su propio gate. No son
funcionalidades escolares — son mecánicas de negocio ya validadas en el mismo
país y el mismo tipo de cliente (PyME que cobra mensualidades a cientos de
personas).

---

## 5 · ¿Es WispHub una amenaza competitiva real?

**Evaluación: baja como competidor directo, media como categoría.**

- Su foso técnico es el control de routers Mikrotik, que en una escuela **vale
  cero**.
- Su modelo de datos es suscriptor-céntrico. Entrar a educación les exigiría
  reescribir el núcleo — la misma limitación estructural que ya documentamos en
  los competidores escolares que nacieron como "sistema de calificaciones".
- **Inferencia propia:** el riesgo no es WispHub. Es la **categoría** — cualquier
  SaaS genérico de cobranza recurrente barato es nuestro sustituto más plausible
  para una escuela chica que solo quiere cobrar. Contra eso no se compite con
  precio; se compite demostrando que la escuela es más que su cobranza.

---

## 6 · El argumento de venta, en el orden en que hay que decirlo

Para uso del equipo comercial. No inventar cifras: todo lo de abajo es
verificable en las fuentes citadas.

1. **"WispHub es excelente… para un proveedor de internet."** Empezar
   reconociéndolo. Es cierto y desarma la objeción.
2. **"Pregúntele a su director académico si puede pasar lista ahí."** No puede.
   No existe el alumno.
3. **"Su contador va a tener un problema en abril."** Sin complemento IEDU las
   familias no deducen. Cinco campos que ese sistema no tiene.
4. **"Y su abogado, otro en septiembre."** Recargo automático desde el día 2
   contra el Artículo 4 del Acuerdo de PROFECO; corte automático contra el
   Artículo 7.
5. **"Nosotros le cobramos, y además le avisamos a la mamá que su hija faltó
   tres veces."** Con evidencia: −27% de reprobación y +12% de asistencia
   (Bergman & Chan 2021), −10% o más de ausentismo crónico (Rogers & Feller
   2018).
6. **Cierre:** "Con WispHub va a necesitar además un sistema escolar. Con
   nosotros no va a necesitar además un sistema de cobranza."

---

## 7 · Fuentes

**Del competidor (primarias):**

- Portada y propuesta de valor — <https://wisphub.net/>
- Precios y límites por plan — <https://wisphub.net/precios/>
- Características completas — <https://wisphub.io/caracteristicas/>
- Facturación electrónica y timbrado con CSD propio — <https://wisphub.net/documentacion/facturacion-electronica-41/>
- Ajustes de facturación, mora automática y corte — <https://wisphub.net/documentacion/articulo/ajustes-facturacion-42/>
- Perfil corporativo (país y tamaño) — <https://mx.linkedin.com/company/wisphub>

**Normativa mexicana (primarias):**

- Acuerdo que establece las bases mínimas de información para la comercialización
  de los servicios educativos que prestan los particulares, DOF 10-mar-1992 —
  <https://www.profeco.gob.mx/juridico/Documentos/SSC/acuerdo10marzo92.pdf>
  y <https://dof.gob.mx/nota_detalle.php?codigo=4655028&fecha=10/03/1992>
- Complemento IEDU (requisitos de deducibilidad de colegiaturas) — documentación
  de proveedores autorizados de certificación, p. ej.
  <https://facturama.mx/blog/que-significa/complemento-educativo/>

**Evidencia académica citada:**

- Bergman, P. & Chan, E. W. (2021). _Journal of Human Resources_ 56(1):125-158.
  <https://doi.org/10.3368/jhr.56.1.1118-9837R1>
- Rogers, T. & Feller, A. (2018). _Nature Human Behaviour_ 2:335-342.
  <https://doi.org/10.1038/s41562-018-0328-1>

**Nota de método (ISO/IEC/IEEE 29148 y práctica de análisis competitivo):** las
funciones del competidor se tomaron de sus propias publicaciones, no de reseñas
de terceros. Lo que no se pudo verificar en fuente primaria —número de clientes,
año de fundación, nombres de fundadores— se declara **no encontrado** y no se
estima.
