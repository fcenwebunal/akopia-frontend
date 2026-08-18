/*
 * Hojas de estilo de la plantilla UNAL, generadas por
 * scripts/scope-unal-template-css.mjs (cada selector va bajo
 * `.unal-chrome`, salvo las reglas de `html`/`body` del panel de
 * accesibilidad, que son globales a propósito). Mismo orden que traía
 * el <head> original de la plantilla.
 */
const STYLESHEETS = [
  "reset.css",
  "bootstrap.min.css",
  "bootstrap-theme.min.css",
  "unal.css",
  "base.css",
  "frontend.css",
  "fonts.css",
  "accesibilidad.css",
  "tablet.css",
  "phone.css",
  "small.css",
];

export function TemplateStyles() {
  return (
    <>
      {STYLESHEETS.map((file) => (
        <link
          key={file}
          rel="stylesheet"
          type="text/css"
          href={`/unal-template/css/${file}`}
        />
      ))}
      <link
        rel="stylesheet"
        type="text/css"
        href="/unal-template/css/printer.css"
        media="print"
      />
    </>
  );
}
