# ADR-006 — Sistema de diseno propio a partir de tokens, sin licenciar la plantilla

| Estado   | Aceptado (D12 del CEO, 23-ago-2026) |
| -------- | ----------------------------------- |
| Decide   | Arquitecto + UX/UI                  |
| Vigencia | Vivo                                |

## Contexto

El CEO eligio la plantilla **Light Able** (Phoenixcoded) como referencia visual
del producto y pidio que los elementos —hasta los inputs y la iconografia—
esten modularizados como componentes reutilizables.

## Investigacion previa

- La version "gratuita" publicada en GitHub **no incluye licencia**; sin
  licencia explicita rige el copyright por defecto y su codigo no se puede
  reutilizar.
- La version de pago se distribuye bajo licencia de Envato. Como Azahar cobra
  suscripcion, correspondería la licencia **Extended** (399 USD), con la duda
  abierta de si web y movil contarian como dos productos.
- El codigo no resolveria el problema aunque se comprara: es **Bootstrap 5 +
  react-bootstrap + SCSS**, y Bootstrap no existe en React Native. La app de
  familias —mobile-first por principio de producto— no podria usar nada de el.
- La linea React/Next de la plantilla no registra cambios desde mediados de
  2024 y quedo en Next.js 14 con dependencias en modo mantenimiento. Comprarla
  seria comprar deuda tecnica.
- Los ingredientes del estilo, en cambio, son libres: **Public Sans** (SIL OFL
  1.1 + CC0) y **Phosphor Icons** (MIT, con paquetes oficiales para React y para
  React Native).

## Decision

No se licencia ni se copia el codigo. Se extraen los **tokens de diseno** —
valores computados medidos directamente del DOM de la demo publica: paleta,
escala tipografica, radios, sombra, geometria — y se reimplementan componentes
propios.

- `packages/tokens`: tokens en formato del **W3C Design Tokens Community
  Group**, compilados con **Style Dictionary** a variables CSS (web) y objetos
  TypeScript (React Native). Una sola fuente para las dos plataformas: la app y
  la web pintan el mismo azul porque leen el mismo archivo, no porque alguien
  recordo copiar el valor.
- `packages/ui`: componentes propios construidos sobre esos tokens.
- Gate de lint que prohibe colores literales fuera del sistema.

## Correcciones deliberadas sobre la referencia

Se adopta la identidad visual, no sus defectos:

1. **Contraste.** El azul de marca alcanza 2.63:1 contra blanco: insuficiente
   para texto (4.5:1) e incluso para componentes no textuales (3:1). Se anadio
   `primary-strong` (#0777B6, 4.86:1) para texto, links y botones; en tema
   oscuro el boton usa el azul de marca con texto oscuro (6.74:1). **Lo detecto
   un test automatizado, no el ojo** — y ese test corre en CI.
2. **Foco visible.** La demo no altera el aspecto del campo enfocado, lo que
   incumple WCAG 2.2 SC 2.4.7. El tema define un anillo de foco global.
3. **Iconografia unica.** La plantilla carga cinco sets de iconos; Azahar
   estandariza en Phosphor, disponible para web y para React Native.

## Consecuencias

**A favor.** Cero costo de licencia y cero riesgo legal sobre el codigo; un solo
sistema visual para tres superficies; accesibilidad verificada en CI; libertad
para evolucionar sin heredar el stack de un tercero.

**En contra.** Construir los componentes cuesta mas que instalarlos. Se acepta
porque el codigo comprado no serviria para el movil, que es justamente la
superficie donde el producto se diferencia.

## Pendiente

La afirmacion de que el estilo visual (paleta, tipografia, geometria) no es
protegible como si lo es el codigo fuente es una **inferencia juridica de este
equipo**, no un dictamen. Debe validarse con abogado antes de usar publicamente
la semejanza. Si objetara, la paleta se sustituye editando un archivo de tokens
— por eso vive centralizada.

## Escape hatch

Si en el futuro conviniera acelerar el back-office con codigo de terceros, se
podria licenciar y usar **solo en la web**, manteniendo el movil sobre los
tokens. Se documentaria como ADR nuevo, con la bifurcacion del sistema visual
declarada como costo.
