import type { NextConfig } from 'next';

const config: NextConfig = {
  // Los paquetes del monorepo se publican como fuentes TypeScript, no como
  // build: asi el cambio en un componente se ve al instante en dev, sin un
  // paso de compilacion intermedio que nadie recuerda correr.
  transpilePackages: ['@azahar/ui', '@azahar/tokens'],
  reactStrictMode: true,
};

export default config;
