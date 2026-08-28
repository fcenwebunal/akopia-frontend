"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl, type StyleSpecification } from "maplibre-gl";
import { OPENFREEMAP_ATTRIBUTION } from "@/lib/openfreemap";

/*
 * Capa base con teselas vectoriales de OpenFreeMap, integrada al `MapContainer`
 * de Leaflet vía `@maplibre/maplibre-gl-leaflet` — react-leaflet no trae un
 * componente propio para esto, así que se agrega imperativamente sobre la
 * instancia real de Leaflet (mismo patrón que `ClickToMove`/`RecenterOnFocus`
 * en `map-picker.tsx`: un componente sin salida visual que solo usa `useMap()`).
 *
 * Toca `window` al importar `maplibre-gl` — mismo cuidado que ya exige
 * Leaflet: quien use un mapa con esta capa debe cargarse con
 * `next/dynamic(..., { ssr: false })`.
 *
 * MapLibre adivina la URL de su worker interno a partir de `import.meta.url`
 * del chunk donde quedó empaquetado — funciona si el paquete se sirve tal
 * cual (un CDN), pero Turbopack lo mete en un chunk con nombre hasheado, así
 * que esa URL nunca existe: el navegador pide un archivo que no está ahí,
 * Next.js responde con la página HTML normal (nunca un 404 real) y el
 * navegador rechaza ejecutarla como worker por el tipo MIME — el mapa se
 * queda en blanco sin ningún error de red obvio (encontrado así en
 * producción real, no en desarrollo). Se sirve el worker real como archivo
 * estático propio (`public/maplibre-gl-worker.mjs`, copiado en cada
 * instalación por `scripts/copy-maplibre-worker.mjs`) y se le dice a
 * MapLibre dónde está, antes de crear cualquier mapa.
 */
setWorkerUrl("/maplibre-gl-worker.mjs");

export function MaplibreBasemap({ style }: { style: string | StyleSpecification }) {
  const map = useMap();

  useEffect(() => {
    const layer = maplibreGL({
      style,
      attributionControl: { customAttribution: OPENFREEMAP_ATTRIBUTION },
      // Necesario para poder leer el canvas con `toDataURL()`/`readPixels()`
      // en diagnóstico — sin esto el búfer se limpia apenas termina de
      // componer el cuadro y una lectura posterior siempre da vacío, aunque
      // sí se haya dibujado algo.
      canvasContextAttributes: { preserveDrawingBuffer: true },
    }).addTo(map);

    const glMap = layer.getMaplibreMap();

    // Los errores de estilo/fuente/tesela de MapLibre no siempre truenan —
    // muchos solo se enteran por este evento. Sin este listener, un fallo
    // real (un layer del estilo mal formado, una tesela que nunca llega)
    // se queda completamente silencioso, como ya pasó una vez.
    const logError = (event: { error?: unknown }) => {
      console.error("[MaplibreBasemap] error:", event.error ?? event);
    };
    glMap.on("error", logError);

    // Gancho temporal de diagnóstico — se retira una vez confirmado por qué
    // el mapa quedaba en blanco pese a que estilo/sprite/manifiesto cargaban
    // bien (ver bitácora, 2026-08-28).
    (window as typeof window & { __akopiaMaplibreDebug?: unknown }).__akopiaMaplibreDebug = glMap;

    return () => {
      glMap.off("error", logError);
      map.removeLayer(layer);
    };
  }, [map, style]);

  return null;
}
