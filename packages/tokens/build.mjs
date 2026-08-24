/**
 * Compila los tokens DTCG a las salidas que consumen las tres superficies.
 *
 * Por que Style Dictionary (Amazon) y no un script propio: es la herramienta
 * estandar para tokens multiplataforma y lee el formato del W3C Design Tokens
 * Community Group. Una sola fuente -> CSS (web) + objetos TS (React Native).
 * El movil NO puede consumir CSS: por eso la salida JS/TS no es un extra, es
 * el requisito que hace posible el sistema unico (D12).
 */
import StyleDictionary from 'style-dictionary';

const sd = new StyleDictionary({
  source: ['tokens/**/*.json'],
  // Los archivos usan $value/$type (formato DTCG), no el formato legacy de SD.
  usesDtcg: true,
  log: { verbosity: 'default' },
  platforms: {
    css: {
      transformGroup: 'css',
      buildPath: 'dist/',
      files: [
        {
          destination: 'tokens.css',
          format: 'css/variables',
          options: { outputReferences: true },
        },
      ],
    },
    js: {
      transformGroup: 'js',
      buildPath: 'dist/',
      files: [
        { destination: 'tokens.js', format: 'javascript/esm' },
        { destination: 'tokens.d.ts', format: 'typescript/es6-declarations' },
      ],
    },
  },
});

await sd.buildAllPlatforms();
console.log('[tokens] build ok -> dist/tokens.css, dist/tokens.js, dist/tokens.d.ts');
