// Análisis estático de Azahar. DEUDA DEL SPRINT 1, PAGADA EN EL SPRINT 4.
//
// Por qué llegó tarde y por qué ya no podía esperar: durante tres sprints
// `pnpm lint` imprimió verde ejecutando únicamente el gate de tokens. Un check
// que no revisa nada es peor que no tenerlo, porque da una garantía falsa (§6).
//
// QUÉ BUSCA ESTE ARCHIVO — y qué no:
//   NO busca estilo. De eso se encarga Prettier, y discutir comillas en un PR
//   es tiempo que no se dedica a lo que rompe en producción.
//   SÍ busca defectos que el compilador no ve: promesas sin await (el modo de
//   fallo más caro de este código, donde un aviso se pierde en silencio),
//   promesas usadas como condición, y violaciones de las leyes del repositorio
//   que hasta hoy solo vivían escritas en decisiones.md.
//
// Config plana (ESLint 10) y UNA sola en la raíz, no una por paquete: seis
// configuraciones divergen en seis meses y nadie recuerda por qué la del móvil
// permite algo que la del API prohíbe.

import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    // Lo generado y lo compilado no se revisa: sus defectos se arreglan en la
    // fuente, y linterlo solo produce ruido que enseña a ignorar el linter.
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/.expo/**',
      '**/build/**',
      'packages/db/generated/**',
      'packages/tokens/dist/**',
    ],
  },

  js.configs.recommended,

  // --- TypeScript CON información de tipos ---------------------------------
  // recommendedTypeChecked y no `recommended` a secas: sin tipos, ESLint no
  // puede saber que una llamada devuelve una promesa, y no-floating-promises
  // —la regla que más nos importa— quedaría desactivada de hecho.
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: ['**/*.ts', '**/*.tsx'],
  })),

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        // projectService resuelve el tsconfig de cada archivo solo. La
        // alternativa (listar seis proyectos a mano) se desincroniza el día
        // que alguien agrega un paquete.
        projectService: {
          // Pruebas y archivos de configuración: quedan fuera del tsconfig de
          // su paquete a propósito (compilarlos metería las pruebas dentro de
          // dist). Sin este respaldo, ESLint no resolvería sus tipos y las
          // reglas con información de tipos quedarían apagadas justo ahí.
          allowDefaultProject: [
            'apps/api/test/*.ts',
            'apps/api/vitest.config.ts',
            'packages/db/test/*.ts',
            'packages/db/vitest.config.ts',
            'packages/db/prisma.config.ts',
          ],
          defaultProject: 'tsconfig.eslint.json',
          // El tope por omisión es 8 y aquí caen 9 archivos —los enumerados
          // arriba, ni uno más—. Se sube a 12 a sabiendas: el nombre de la
          // opción avisa que el proyecto por omisión es lento, y lo es cuando
          // barre un repositorio entero. Con una lista cerrada y explícita el
          // costo es de milisegundos, y la alternativa (mover las pruebas al
          // tsconfig de compilación) las metería dentro de dist.
          maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 12,
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // LA REGLA POR LA QUE VALE LA PENA EL LINTER CON TIPOS.
      // El motor de avisos despacha después del commit; una promesa sin await
      // ahí significa un aviso que nunca sale y un proceso que ya respondió 200.
      // Ese fallo no deja rastro: no hay excepción, no hay log, no hay nada.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',

      // `any` degrada el resto del sistema de tipos en silencio. Se avisa, no
      // se bloquea: hay fronteras (cuerpos HTTP sin validar todavía) donde es
      // legítimo y Zod lo estrecha una línea después.
      '@typescript-eslint/no-explicit-any': 'warn',

      // Variables sin usar: error, salvo el prefijo _ para lo deliberado.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],

      // Ruido puro en este repositorio: plantillas con datos ya tipados.
      '@typescript-eslint/restrict-template-expressions': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',

      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': 'warn',
    },
  },

  // --- Las leyes del repositorio, ahora ejecutables -------------------------
  // Hasta hoy §28 vivía en un documento. Un documento no detiene un merge.
  {
    files: ['apps/**/*.ts', 'apps/**/*.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'NewExpression[callee.name="PrismaClient"]',
          message:
            '§28: nadie fuera de packages/db construye clientes de base de datos. Usa conTenant() o sinTenant(), que garantizan el contexto de aislamiento.',
        },
        {
          selector: 'NewExpression[callee.property.name="PrismaClient"]',
          message: '§28: nadie fuera de packages/db construye clientes de base de datos.',
        },
      ],
    },
  },

  // --- React (web y móvil) --------------------------------------------------
  {
    files: ['apps/web/**/*.tsx', 'apps/mobile/**/*.tsx'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // El navegador y React Native tienen su propio console; en la interfaz
      // sí estorba dejarlo.
      'no-console': 'error',
    },
  },

  // --- Pruebas ---------------------------------------------------------------
  {
    files: ['**/test/**/*.ts', '**/*.test.ts', '**/*.test.mjs'],
    rules: {
      // Las pruebas afirman sobre estructuras que llegan como JSON sin tipar;
      // exigirles el mismo rigor de tipos solo produce castings decorativos.
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },

  // --- Scripts de operación (.mjs) ------------------------------------------
  // Sin información de tipos: no están en ningún tsconfig y forzarlos a estarlo
  // sería doblar la herramienta para satisfacer al linter.
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      // Estos scripts hablan con la persona que los ejecuta: console ES su
      // interfaz de usuario, no un olvido de depuración.
      'no-console': 'off',
    },
  },
);
