# Sprint 8 — Adopción ordenada de Metronic

| Campo    | Valor                                                |
| -------- | ---------------------------------------------------- |
| Estado   | PROPUESTO — pendiente de gate del CEO                |
| Rama     | `sprint-8-metronic` (al arrancar)                    |
| Origen   | **Cambio C5.** No estaba en el Plan Maestro. Ver §0. |
| Vigencia | Vivo durante el sprint; se congela al cerrarlo       |

---

## 0 · Por qué existe y qué lo precedió

El CEO tiene licencia **Extended** de Metronic v9.5.0, sin usar en otro
proyecto, y pidió aprovecharla. ADR-006 ya había previsto este caso con su
escape hatch; **ADR-012** lo ejecuta.

**Deuda de proceso que este sprint corrige.** Tailwind 4 y el puente de tokens
se instalaron durante el Sprint 7, **fuera de su alcance** — segunda desviación
de §8 en la misma jornada. Se declaró en el cierre del S7 y no se revirtió
porque estaba probado y en verde; revertir código que funciona para salvar la
pureza del proceso habría sido teatro. **Lo que sí se corrige es el método:**
este sprint existe para que la adopción no siga ocurriendo a pedazos.

## 1 · Sprint Goal

> La pantalla de Cobranza usa una tabla de datos real —ordenable, filtrable,
> paginada— construida sobre componentes de Metronic que pintan con los colores
> de Azahar, sin editar un solo archivo de la plantilla. Y queda escrito cómo
> entra el siguiente componente, para que no haya que decidirlo cada vez.

## 2 · Alcance seleccionado (MoSCoW)

| ID        | Qué                                                                                                                              | MoSCoW   |
| --------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `AZ-D2.1` | **Probar el supuesto más riesgoso**: adoptar `Button` y verificar que el gate de contraste (§30) sigue verde con nuestros tokens | **Must** |
| `AZ-D2.2` | Regla escrita de adopción: dónde viven, cómo se nombran, qué se verifica                                                         | **Must** |
| `AZ-D2.3` | `DataGrid` sobre TanStack Table adoptado y adaptado                                                                              | **Must** |
| `AZ-D2.4` | **Cobranza reconstruida** sobre el `DataGrid`, con prueba de navegador                                                           | **Must** |
| `AZ-D2.5` | Inventario de lo adoptado, para saber qué mantenemos                                                                             | **Must** |
| `AZ-D2.6` | `Form` (react-hook-form + zod) y una pantalla de captura migrada                                                                 | Should   |
| `AZ-D2.7` | Sidebar plegable a riel de 80 px con expansión al pasar                                                                          | Should   |
| `AZ-D2.8` | Decidir qué pasa con nuestros primitivos (`Boton`, `CampoTexto`, `Insignia`)                                                     | Could    |

> **Sobre los identificadores.** Estos ítems nacieron como `AZ-M9.x`, que
> **colisionaba con la épica E9 «Plataforma ZaharDev»** (wizard Activate, panel
> de clientes, dashboard MRR) asignada en el cambio C1. El esquema es
> `AZ-M<épica>.<n>`, así que E9 ya estaba tomada. Se renombran a `AZ-D2.x`,
> continuando el espacio de diseño que abrió el S7 con `AZ-D1.x`.
> ISO/IEC/IEEE 29148:2018 exige identificadores únicos y trazables; la colisión
> era latente —los ítems de E9 aún no se numeran— y corregirla hoy cuesta ocho
> líneas. Aprobado por el CEO el 6-sep-2026.

## 3 · Cómo se hace — el orden importa

**El orden NO es «lo más valioso primero». Es «lo más riesgoso primero».**

Todo el plan descansa en un supuesto: _nuestros tokens mapean limpio sobre los
nombres de variable que esperan sus componentes_. Si es falso, no sirve nada de
lo demás. Se prueba con `Button` —el componente más barato— antes de tocar el
`DataGrid`, que son 1,200 líneas.

Es el método de la casa: probar primero el supuesto que, si es falso, tira el
trabajo.

### Las tres reglas de adopción (`AZ-D2.2`)

1. **Se copia a nuestro árbol, nunca se referencia.** Van a
   `apps/web/components/ui/`. Referenciar la carpeta de la plantilla la
   convertiría en dependencia de compilación de código que no podemos publicar.
2. **Web-only, y se nota.** Tailwind no llega a React Native. Vivir en
   `apps/web` dice la verdad sobre su alcance; ponerlos en un paquete
   compartido mentiría.
3. **Frontera por idioma.** Lo adoptado conserva su nombre en inglés
   (`Button`, `DataGrid`); lo nuestro sigue en español (`Boton`, `Tarjeta`,
   `ArmazonPanel`). Al abrir un archivo se sabe de inmediato si lo mantenemos
   nosotros o si algún día habrá que diffearlo contra una versión nueva.

### Qué NO se adopta

Su armazón de layout, con los defectos medidos en ADR-012: `role="content"` no
es un rol ARIA válido, el sidebar parpadea en móvil porque decide con
JavaScript antes de hidratar, y un `setTimeout` de 1000 ms fijo tapa
transiciones. El nuestro tiene 22 pruebas de navegador detrás.

## 4 · Justificación (dato duro · inferencia · estándar)

- **Dato duro:** 77 componentes, 12,109 líneas, licencia Extended pagada.
- **Dato duro:** el `DataGrid` son ~1,200 líneas sobre TanStack Table con orden,
  filtros, paginación y visibilidad de columnas.
- **Inferencia (marcada como tal):** construir eso a mano con calidad
  equivalente costaría del orden de un sprint completo. No hay medición propia
  que lo respalde; es criterio.
- **Estándar:** _Riskiest Assumption Test_ (Bland & Osterwalder, _Testing
  Business Ideas_) — probar primero el supuesto que, si es falso, invalida el
  plan. Y ADR-012 como decisión de arquitectura registrada (Nygard).

## 5 · Relación con otros sprints

- **Depende del S7**: el armazón y los tokens de layout ya existen; el
  `DataGrid` se monta dentro del área fluida que el S7 construyó.
- **Termina `AZ-D1.7`** (densidad en tablas) del S7, que quedó sin hacer
  precisamente porque el `DataGrid` lo resuelve mejor que hacerlo a mano.
- **Desplaza** al S9 Comunicación I y a todo lo posterior. **El MVP pasa del
  Sprint 15 al 16** — cuarto corrimiento (C2, C3, C4, C5).

## 6 · Definition of Ready

- [x] Licencia Extended confirmada y sin usar en otro proyecto (CEO, 5-sep-2026)
- [x] ADR-012 escrito y aceptado
- [x] Tailwind 4 y el puente de tokens instalados y en verde
- [x] La plantilla excluida de git, ESLint y Prettier
- [ ] Decidido qué columnas lleva la tabla de Cobranza

## 7 · Plan de QA (§13)

1. **El gate de contraste (§30) es el juez del puente.** Si un componente
   adoptado pinta con un color que no pasa, el puente está mal — y eso se sabe
   en `AZ-D2.1`, no al final.
2. **Prueba de navegador de Cobranza**: la tabla ordena, filtra y pagina contra
   datos reales, a 1440 px y a 360 px.
3. **El trinquete no sube.** Los componentes de Metronic usan clases de
   Tailwind, no estilos en línea: el número debería BAJAR al migrar.
4. Las 22 pruebas de navegador del S7 siguen verdes: el armazón no se toca.

## 8 · Riesgos y alternativas descartadas

| Riesgo / alternativa                  | Decisión                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------- |
| El puente de tokens no mapea limpio   | Es `AZ-D2.1` y va primero, a propósito                                                      |
| Adoptar los 77 componentes de golpe   | **Descartada.** Cada uno es código que hay que mantener. Entra el que una pantalla necesite |
| Sustituir nuestro armazón por el suyo | **Descartada** con defectos medidos (ADR-012)                                               |
| Divergencia web/móvil de color        | El puente lo impide; el gate de tokens lo vigila                                            |
| Quedarnos con dos sistemas de botones | Es `AZ-D2.8`, y se decide **después** de tener evidencia, no antes                          |

## 9 · Demo de cierre

Cobranza con la tabla real: ordenar por días de atraso, filtrar por familia,
paginar. Y la prueba de mordida del puente: cambiar un token de color y ver que
el componente de Metronic cambia con él.

## 10 · Definition of Done (3 capas)

1. **Código** — lint, typecheck y las pruebas en verde; el trinquete igual o
   más bajo; cero archivos de la plantilla commiteados.
2. **Producto** — Cobranza verificada en el staging real, escritorio y 360 px.
3. **Proceso** — CHANGELOG, decisiones § nuevas, inventario de lo adoptado,
   `pnpm ensayo:despliegue` en verde y ceremonia completa con el número de
   pruebas **medido al firmar** (§7).
