// Copies the UNAL institutional template CSS into public/unal-template/css,
// scoping every selector under `.unal-chrome` so it cannot leak into the
// rest of the Tailwind-based app. `html`/`body`-rooted selectors are left
// unprefixed on purpose: they belong to the accessibility panel (font-size
// zoom, contrast, color inversion), which is meant to affect the whole
// page, not just the chrome. Re-run this script if the template folder is
// ever updated.
import { readFile, writeFile, mkdir, copyFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import postcss from "postcss";
import prefixSelector from "postcss-prefix-selector";

const TEMPLATE_DIR = path.resolve(
  import.meta.dirname,
  "../../Plantilla-Pagina-Web_17-07-2026"
);
const OUT_DIR = path.resolve(import.meta.dirname, "../public/unal-template");

const SCOPED_STYLESHEETS = [
  "reset.css",
  "bootstrap.min.css",
  "bootstrap-theme.min.css",
  "unal.css",
  "base.css",
  "frontend.css",
  "accesibilidad.css",
  "tablet.css",
  "phone.css",
  "small.css",
  "printer.css",
];

// @font-face has no selector to scope; it registers fonts globally and
// harmlessly, so it is copied through as-is.
const PASSTHROUGH_STYLESHEETS = ["fonts.css"];

function shouldSkip(selector) {
  return /^(html|body)\b/.test(selector.trim());
}

// Cascade layers looked like the right tool at first (Tailwind v4 puts
// its own CSS in layers, and unlayered CSS always wins over layered CSS
// regardless of specificity) but turned into a game of whack-a-mole:
// Bootstrap utility classes share exact names with Tailwind ones
// (".overflow-hidden", ".text-white"), and Bootstrap's responsive
// utilities live inside @media blocks that, combined with !important,
// flipped the intended precedence entirely (".d-none" started beating
// ".d-md-block" at any screen width).
//
// The robust fix is a positive exclusion instead of a priority race:
// every template selector gets ":not(.akopia-content, .akopia-content
// *)" appended, so it can never match anything inside the real app
// content — regardless of specificity, layers, or !important. The
// template's own chrome (header/footer/accessibility panel) never
// carries that class, so its own styling is completely unaffected.
const EXCLUDE = ":not(.akopia-content, .akopia-content *)";

// A pseudo-element (::before, ::after, ::placeholder, ...) has to be the
// last component of a compound selector — CSS syntax forbids anything
// after it, including :not(). Appending EXCLUDE unconditionally at the
// end turned "#pestania-accesibilidad::before" into
// "#pestania-accesibilidad::before:not(...)", which is invalid and gets
// the whole rule silently dropped by the browser (no warning anywhere,
// it just never matches). Insert EXCLUDE *before* a trailing
// pseudo-element instead of after it.
const TRAILING_PSEUDO_ELEMENT = /(::[a-zA-Z-]+)$/;

function excludeAppContent(selector) {
  return selector
    .split(",")
    .map((part) => {
      const trimmed = part.trim();
      const match = trimmed.match(TRAILING_PSEUDO_ELEMENT);
      if (!match) return `${trimmed}${EXCLUDE}`;
      const base = trimmed.slice(0, -match[0].length);
      return `${base}${EXCLUDE}${match[0]}`;
    })
    .join(", ");
}

async function scopeCss(fileName) {
  const src = path.join(TEMPLATE_DIR, "css", fileName);
  const css = await readFile(src, "utf8");

  const result = await postcss([
    prefixSelector({
      prefix: ".unal-chrome",
      transform(prefix, selector, prefixedSelector) {
        if (shouldSkip(selector)) return selector;
        return excludeAppContent(prefixedSelector);
      },
    }),
  ]).process(css, { from: src, to: undefined });

  await writeFile(path.join(OUT_DIR, "css", fileName), result.css, "utf8");
  console.log(`scoped  ${fileName}`);
}

// El buscador se decidió puramente decorativo (pedido explícito del
// 2026-08-18): se reemplazó el widget real de Google Custom Search por
// un campo estático. Sin esto, unal.js seguiría cargando el script de
// Google (con su publicidad) y quedaría además en un bucle de
// setTimeout cada 100ms para siempre, buscando un elemento que ya no
// existe (`.gsc-search-button input`). Se quita solo ese bloque —el
// resto de unal.js (menú móvil, panel de servicios, dropdowns) sigue
// intacto.
async function patchUnalJs() {
  const src = path.join(TEMPLATE_DIR, "js", "unal.js");
  const original = await readFile(src, "utf8");

  const marker = "jQuery(document).ready(function($) {";
  const idx = original.indexOf(marker);
  if (idx === -1) {
    throw new Error("unal.js cambió de forma inesperada: no se encontró el punto de corte del buscador de Google.");
  }

  const patched =
    "// Buscador decorativo: la carga del widget de Google Custom Search\n" +
    "// se quitó a propósito en scripts/scope-unal-template-css.mjs.\n" +
    original.slice(idx);

  await writeFile(path.join(OUT_DIR, "js", "unal.js"), patched, "utf8");
  console.log("patched unal.js (buscador de Google removido)");
}

async function copyDir(relDir) {
  const src = path.join(TEMPLATE_DIR, relDir);
  const dest = path.join(OUT_DIR, relDir);
  await mkdir(dest, { recursive: true });

  for (const entry of await readdir(src, { withFileTypes: true })) {
    if (entry.isDirectory()) continue; // gsap-public etc: not needed, skipped on purpose
    await copyFile(path.join(src, entry.name), path.join(dest, entry.name));
  }
  console.log(`copied  ${relDir}/*`);
}

async function main() {
  if (!existsSync(TEMPLATE_DIR)) {
    throw new Error(`No se encontró la plantilla en ${TEMPLATE_DIR}`);
  }

  await mkdir(path.join(OUT_DIR, "css"), { recursive: true });

  for (const file of SCOPED_STYLESHEETS) {
    await scopeCss(file);
  }
  for (const file of PASSTHROUGH_STYLESHEETS) {
    await copyFile(
      path.join(TEMPLATE_DIR, "css", file),
      path.join(OUT_DIR, "css", file)
    );
    console.log(`copied  ${file}`);
  }

  await copyDir("images");
  await copyDir("Icons");
  await copyDir("fonts");

  await mkdir(path.join(OUT_DIR, "js"), { recursive: true });
  for (const file of [
    "jquery.js",
    "bootstrap.bundle.min.js",
    "unal.js",
    "accesibilidad.js",
  ]) {
    if (file === "unal.js") {
      await patchUnalJs();
      continue;
    }
    await copyFile(
      path.join(TEMPLATE_DIR, "js", file),
      path.join(OUT_DIR, "js", file)
    );
  }
  console.log("copied  js/*");

  console.log("\nListo. Activos de la plantilla en public/unal-template/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
