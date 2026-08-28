// MapLibre GL calcula la URL de su worker interno a partir de dónde el
// navegador cargó su propio chunk (`import.meta.url` + "maplibre-gl-worker.mjs"
// como archivo hermano) — funciona cuando el paquete se sirve tal cual desde
// un CDN, pero Turbopack lo empaqueta en un chunk con nombre hasheado, así
// que esa URL adivinada nunca existe. Se sirve el worker real como archivo
// estático propio (`public/maplibre-gl-worker.mjs`) y se le dice a MapLibre
// dónde está con `setWorkerUrl()` (ver `maplibre-basemap.tsx`).
//
// El worker, a su vez, importa `./maplibre-gl-shared.mjs` por ruta relativa
// — el código que comparte con el hilo principal (parsers, utilidades). Si
// solo se copia el worker, esa segunda importación resuelve contra
// `/maplibre-gl-shared.mjs`, que sin este segundo archivo tampoco existe: el
// worker "carga" (el navegador no avisa con un error obvio) pero nunca
// termina de evaluar su propio módulo, así que nunca procesa una sola
// tesela — encontrado en producción real, sin ningún error de consola que
// lo delatara, solo silencio total en los eventos del mapa.
//
// Se copian aquí, en `postinstall`, en vez de commitear los archivos: así
// quedan siempre sincronizados con la versión de `maplibre-gl` que de
// verdad está instalada, sin depender de que alguien recuerde actualizarlos
// a mano.
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const distDir = join(root, "node_modules", "maplibre-gl", "dist");
const destDir = join(root, "public");

const files = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

mkdirSync(destDir, { recursive: true });

for (const file of files) {
  const source = join(distDir, file);
  if (!existsSync(source)) {
    console.warn(`[copy-maplibre-worker] No se encontró ${source} — ¿falló la instalación de maplibre-gl?`);
    continue;
  }
  copyFileSync(source, join(destDir, file));
  console.log(`[copy-maplibre-worker] Copiado ${file}`);
}
