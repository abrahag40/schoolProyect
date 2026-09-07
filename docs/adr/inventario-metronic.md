# Inventario de lo adoptado de Metronic (`AZ-D2.9`)

| Campo     | Valor                                                        |
| --------- | ------------------------------------------------------------ |
| Origen    | ADR-012 (adopción) · ADR-013 (armazón) · Sprint 8, cambio C6 |
| Licencia  | Metronic v9.5.0, **Extended** (KeenThemes)                   |
| Vigencia  | Vivo. Se actualiza al adoptar o retirar código               |
| Medido el | 6-sep-2026, sobre `sprint-8-metronic`                        |

---

## 0 · Para qué sirve este documento

Para responder tres preguntas el día que haya que actualizar a Metronic 9.6, o
el día que alguien pregunte qué código de este repositorio no escribimos:

1. **¿Qué mantenemos nosotros y qué hay que diffear contra ellos?**
2. **¿Qué archivos suyos hemos tocado**, y por qué?
3. **¿Qué NO se adoptó**, para no volver a evaluarlo desde cero?

## 1 · Cómo saber, sin leer esto, si un archivo es nuestro

Tres señales, en orden de fiabilidad:

```bash
# 1. Los archivos ajenos que no compilan bajo nuestras reglas van marcados.
grep -rl "@ts-nocheck" apps/web

# 2. Las carpetas ajenas estan excluidas en CINCO herramientas.
grep -n "components/ui" .prettierignore eslint.config.mjs scripts/check-tokens.mjs
```

3. **El idioma.** Lo adoptado conserva su nombre en inglés (`Button`,
   `DataGrid`, `use-mobile`); lo nuestro va en español (`Campo`, `MenuUsuario`,
   `TarjetasCobranza`). Al abrir un archivo se sabe de inmediato quién lo
   mantiene. Es la regla 3 de adopción y es la que más va a valer en dos años.

## 2 · Adoptado tal cual — 110 archivos, 14,470 líneas

Copiado a nuestro árbol y **no editado**. Se reemplaza entero al actualizar.

| Carpeta                       | Archivos | Líneas | Qué es                                                |
| ----------------------------- | -------- | ------ | ----------------------------------------------------- |
| `apps/web/components/ui/`     | 78       | 12,260 | Los componentes: `DataGrid`, `Form`, primitivos Radix |
| `apps/web/hooks/`             | 9        | 771    | `use-mobile`, `use-scroll-position`, `use-menu`…      |
| `apps/web/css/`               | 8        | 672    | Variables de Metronic y el armazón del demo1          |
| `apps/web/components/common/` | 8        | 446    | `Container` y utilidades de composición               |
| `apps/web/providers/`         | 3        | 163    | Ajustes, tema y tooltips                              |

**El más valioso, con diferencia:** la familia `data-grid*` — 1,664 líneas sobre
TanStack Table con orden, filtros, paginación y visibilidad de columnas. Es lo
que sostiene la pantalla de Cobranza.

## 3 · Suyo, pero editado — 9 archivos

**Estos son los que duelen al actualizar.** Cada uno lleva su marca en el propio
archivo para poder encontrarlo.

### 3.1 · Siete archivos con `@ts-nocheck`

`components/ui/`: `accordion-menu.tsx` · `data-grid-column-header.tsx` ·
`grid-background.tsx` · `kanban.tsx` · `sortable.tsx` · `text-reveal.tsx`
· `hooks/use-file-upload.ts`

**No son defectos suyos.** Fallan contra `noUncheckedIndexedAccess`, una regla
que Azahar activa y la plantilla no. La cabecera de cada archivo lo explica. Al
traer una versión nueva se reemplaza el archivo y se le vuelve a poner la
cabecera.

### 3.2 · Dos ediciones de contenido

| Archivo                                  | Qué se cambió                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `components/ui/data-grid-pagination.tsx` | Tres cadenas traducidas al español, marcadas con `// es:`. Las demás son props y van desde cada pantalla          |
| `css/config.reui.css`                    | `@import 'tw-animate-css'` pasa a ruta relativa: el resolvedor de Tailwind 4 no sube por `node_modules` desde ahí |

## 4 · Nuestro, aunque viva en carpetas suyas — 6 archivos

Dentro de `app/components/layouts/demo1/`, con nombre propio y **sí revisados**
por lint y typecheck. La frontera no es la carpeta: es la autoría.

| Archivo                  | Por qué se reescribió                                                                                               |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `layout.tsx`             | Tres correcciones al armazón: `role="content"` inválido fuera, sidebar decidido por CSS, un frame en vez de 1000 ms |
| `header.tsx`             | Fuera mega-menú, buscador, chat, notificaciones y rejilla de apps — cinco botones que no llevaban a ningún lado     |
| `menu-usuario.tsx`       | El suyo dependía de `next-auth`; Azahar usa cookie httpOnly contra su propio API                                    |
| `footer.tsx`             | Sus cinco enlaces mandaban a comprar Metronic desde el pie de Azahar                                                |
| `sidebar-header.tsx`     | Su marca son cuatro `<img>` a arte de KeenThemes. Ver §6                                                            |
| `config/menu.config.tsx` | 1,564 líneas de su navegación de demos → las 6 secciones de Azahar                                                  |

## 5 · Lo que NO se adoptó, y por qué

Para no volver a evaluarlo:

| Qué                          | Motivo                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| `providers/auth-provider`    | Es `next-auth`. Azahar tiene cookie httpOnly propia; dos sistemas de sesión es un defecto |
| `providers/i18n-provider`    | El producto es en español por requisito del CEO                                           |
| `providers/query-provider`   | `react-query` no lo usa ningún componente adoptado, solo sus demos                        |
| `providers/modules-provider` | Depende de su tienda de ejemplo                                                           |
| 124 de sus 133 `partials`    | El demo1 solo usaba 9, y esos arrastraban 18 tarjetas de notificación de ejemplo          |
| `components/keenicons/`      | **Retirado tras commitearlo por error.** Ver §6                                           |

## 6 · Incidente de licencia — 6-sep-2026

Al copiar por lote entró `components/keenicons`: **40 archivos, 14 MB** de
fuentes de iconos (TTF, WOFF, SVG), más dos PNG suyos para el fondo de las
tarjetas. Todo commiteado y empujado a un repositorio **público**, que es
redistribuir.

Lo absurdo: **no usábamos ni un icono suyo** — Azahar usa `lucide`. La única
referencia era un `import` de CSS añadido al copiar su layout raíz.

**Retirado** en `511d8e5`. El árbol commiteado bajó de ~17.8 MB a 2.8 MB.
**Pendiente y NO resuelto:** los archivos siguen alcanzables en el historial de
git; sacarlos exige reescribir la historia y un push forzado — decisión del CEO.

**Regla que sale de esto, y del incidente gemelo de Vercel:** al adoptar código
ajeno hay que decírselo a **cinco** herramientas, porque ninguna lee la
configuración de las otras.

| Herramienta         | Decide                   |
| ------------------- | ------------------------ |
| `.gitignore`        | qué se publica           |
| `eslint.config.mjs` | qué se revisa            |
| `check-tokens.mjs`  | qué colores se permiten  |
| `.vercelignore`     | qué se sube al desplegar |
| `.prettierignore`   | qué se formatea          |

## 7 · Dependencias: 11 de 28 alineadas a su versión exacta

Instalar las últimas versiones costó **239 errores de tipos**. Alinear 13
paquetes a lo que la plantilla espera los bajó a 45.

Los que importan, porque divergían en versión mayor:

| Paquete                  | Suyo       | Se instaló                      |
| ------------------------ | ---------- | ------------------------------- |
| `@tanstack/react-table`  | `^8.21.3`  | v8 ✅ (v9 rompía el `DataGrid`) |
| `lucide-react`           | `^0.525.0` | 0.x ✅ (la 1.x cambió la API)   |
| `recharts`               | `2.15.1`   | 2.x ✅                          |
| `react-day-picker`       | `^9.7.0`   | 9.x ✅                          |
| `react-resizable-panels` | `^3.0.3`   | 3.x ✅                          |
| `motion`                 | `^12.19.2` | 12.x ✅                         |

**Next y React se quedan en los NUESTROS** (16.3.2 y 19.2.8), más nuevos que los
suyos y dentro de sus rangos con `^`.

## 8 · Lo que este inventario NO cubre

- **Cuánto costaría salir.** No se ha medido, y decir una cifra sin medirla
  sería inventarla.
- **Si conviene actualizar a 9.6.** Se decide cuando exista, con este documento
  en la mano: son 110 archivos a reemplazar y 9 a reaplicar.
