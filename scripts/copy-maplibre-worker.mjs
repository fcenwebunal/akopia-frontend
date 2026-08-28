// MapLibre GL calcula la URL de su worker interno a partir de dónde el
// navegador cargó su propio chunk (`import.meta.url` + "maplibre-gl-worker.mjs"
// como archivo hermano) — funciona cuando el paquete se sirve tal cual desde
// un CDN, pero Turbopack lo empaqueta en un chunk con nombre hasheado, así
// que esa URL adivinada nunca existe. Se sirve el worker real como archivo
// estático propio (`public/maplibre-gl-worker.mjs`) y se le dice a MapLibre
// dónde está con `setWorkerUrl()` (ver `maplibre-basemap.tsx`).
//
// Se copia aquí, en `postinstall`, en vez de commitear el archivo: así queda
// siempre sincronizado con la versión de `maplibre-gl` que de verdad está
// instalada, sin depender de que alguien recuerde actualizarlo a mano.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const source = join(root, "node_modules", "maplibre-gl", "dist", "maplibre-gl-worker.mjs");
const destDir = join(root, "public");
const dest = join(destDir, "maplibre-gl-worker.mjs");

if (!existsSync(source)) {
  console.warn(`[copy-maplibre-worker] No se encontró ${source} — ¿falló la instalación de maplibre-gl?`);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(source, dest);
console.log(`[copy-maplibre-worker] Copiado a ${dest}`);
