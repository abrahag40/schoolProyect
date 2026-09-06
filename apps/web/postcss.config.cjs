// Tailwind 4 se conecta por PostCSS y nada mas: no hay `tailwind.config.js`.
// La configuracion del tema vive en CSS, en `app/tailwind.css` (§67).
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};
