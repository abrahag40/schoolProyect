# Azahar

Plataforma de gestion escolar para escuelas de paga: cobranza recurrente,
comunicacion con las familias y expediente del alumno. Multi-tenant y
multi-vertical — el mismo producto sirve a un colegio K-12, a una academia
deportiva o a una escuela de idiomas.

Producto de **ZaharDev**. El plan de trabajo es la fuente de la verdad y vive
fuera de este repositorio (ver `CLAUDE.md`); aqui viven el codigo, las reglas y
el estado medido.

## Arrancar en local

Requisitos: Node 22+ (ver `.nvmrc`), pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up          # Postgres 16 en el puerto 5434
pnpm db:migrate     # crea el rol restringido, las tablas y las politicas RLS
pnpm db:seed        # dos escuelas demo de verticales distintas
pnpm tokens:build   # compila los tokens de diseno
```

Luego, en dos terminales:

```bash
pnpm --filter @azahar/api dev    # http://localhost:3333
pnpm --filter @azahar/web dev    # http://localhost:3010
```

Cuentas de prueba (contrasena `azahar-demo-2026`):

| Escuela           | Vertical           | Correo                     |
| ----------------- | ------------------ | -------------------------- |
| `colegio-azahar`  | Colegio K-12       | directora@colegioazahar.mx |
| `academia-azahar` | Academia deportiva | coach@academiaazahar.mx    |

Entra con una y con la otra: veras que cada cuenta solo alcanza los datos de su
escuela, y que la academia no muestra clave SEP ni RVOE porque no le aplican.

## Estructura

```
apps/
  api/       NestJS. Proceso de larga vida: aloja crons de cobranza y webhooks.
  web/       Next.js 16. Back-office de la escuela.
  mobile/    Expo / React Native. App de familias.
packages/
  tokens/    Tokens de diseno (W3C DTCG) -> CSS para web, objetos TS para movil.
  ui/        Componentes propios de la web.
  db/        Acceso a datos. Unico lugar que abre conexiones.
```

## Como se trabaja aqui

- **El aislamiento entre escuelas se prueba, no se promete.** `pnpm test` corre
  contra un Postgres real con el rol de aplicacion restringido. Si RLS se
  desactiva en cualquier tabla, el gate se pone rojo.
- **CI rojo/verde binario.** Nunca `continue-on-error`. Lo que se excluye se
  documenta con su porque y su fecha.
- **Las decisiones se numeran** en `docs/decisiones.md` (`§4`, `§26`…) y se citan
  desde el codigo. Las de arquitectura llevan ADR en `docs/adr/`.
- **El estado del proyecto se mide, no se escribe:** `pnpm estado`.
- **La configuracion lleva su porque en el propio archivo**, con el precedente
  que la origino. Antes de "limpiar" un valor raro, lee el comentario.

## Comandos

| Comando          | Que hace                                              |
| ---------------- | ----------------------------------------------------- |
| `pnpm test`      | Pruebas, incluido el gate de aislamiento multi-tenant |
| `pnpm lint`      | Lint + gate de colores fuera del sistema de tokens    |
| `pnpm typecheck` | Tipos en todo el monorepo                             |
| `pnpm build`     | Compila las tres superficies                          |
| `pnpm estado`    | Estado real medido del repositorio                    |
| `pnpm db:reset`  | Borra y reconstruye la base local                     |
