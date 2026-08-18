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

// Un segmento de selector "genérico puro" es solo un nombre de etiqueta
// (con, como mucho, una pseudo-clase simple): "h1", ".unal-chrome p",
// "a:hover". Nada de clases/ids/atributos propios de la plantilla.
const GENERIC_SEGMENT = /^(\.unal-chrome\s+)?[a-zA-Z][a-zA-Z0-9]*(::?[a-zA-Z-]+(\([^)]*\))?)?$/;

// Divide un selector compuesto ("a b > c") en sus segmentos simples,
// para juzgar cada uno por separado.
function splitCompound(part) {
  return part
    .replaceAll(".unal-chrome", "")
    .split(/(?:>|\+|~|\s)+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Una regla va a la capa de BAJA precedencia (pierde contra Tailwind)
// solo si TODAS sus partes (separadas por coma) son, en TODOS sus
// segmentos, selectores de etiqueta genéricos sin calificar — el reset
// universal (reset.css) y los `h1..h6`/`p`/`a` sueltos de unal.css caen
// aquí, porque esos SÍ compiten con el contenido real de la app.
//
// Todo lo demás (cualquier cosa con una clase o id de la plantilla en
// la cadena, como "#unalTop .logo svg") va a la capa ALTA: layout
// propio del cabezote que tiene que ganar siempre, y que nunca podría
// coincidir por accidente con el contenido de React de todas formas.
function isGenericRule(selector) {
  return selector
    .split(",")
    .every((part) => splitCompound(part).every((seg) => GENERIC_SEGMENT.test(seg)));
}

async function scopeCss(fileName) {
  const src = path.join(TEMPLATE_DIR, "css", fileName);
  const css = await readFile(src, "utf8");

  const root = postcss.parse(css, { from: src });

  postcss([
    prefixSelector({
      prefix: ".unal-chrome",
      transform(prefix, selector, prefixedSelector) {
        return shouldSkip(selector) ? selector : prefixedSelector;
      },
    }),
  ]).process(root, { from: src, to: undefined }).sync();

  const low = postcss.root();
  const high = postcss.root();

  root.each((node) => {
    if (node.type === "rule" && !shouldSkip(node.selector)) {
      (isGenericRule(node.selector) ? low : high).append(node.clone());
    } else {
      // @media, @font-face, y las reglas de body/html sin escopear
      // (accesibilidad) quedan tal cual, fuera de las dos capas.
      high.append(node.clone());
    }
  });

  // Tailwind v4 pone todo su CSS en cascade layers (theme/base/components/
  // utilities). En CSS, una regla SIN capa le gana a CUALQUIER regla CON
  // capa, sin importar especificidad — así que un simple
  // ".unal-chrome h1{font-family:...}" de la plantilla le ganaría a
  // cualquier clase de Tailwind puesta directamente en un <h1> real de
  // la app. Los selectores genéricos puros (arriba) van a una capa con
  // MENOR precedencia que las de Tailwind (ver globals.css), para que
  // el contenido real de la app siempre gane ahí. El layout propio del
  // cabezote (selectores calificados: `.logo`, `#unalTop`, `.mainMenu`…)
  // va SIN capa — necesita ganar siempre, y nunca coincide por
  // accidente con nada de React.
  const layered = `@layer unal-template {\n${low.toString()}\n}\n\n${high.toString()}\n`;
  await writeFile(path.join(OUT_DIR, "css", fileName), layered, "utf8");
  console.log(`scoped  ${fileName}`);
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
