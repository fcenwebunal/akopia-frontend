// OpenFreeMap (tiles.openfreemap.org) — teselas vectoriales sobre datos de
// OpenStreetMap/OpenMapTiles. Reemplaza las de CARTO (basemaps.cartocdn.com,
// usadas hasta el 28 de agosto de 2026): CARTO empezó a exigir API key y
// anunció el retiro de ese servicio raster incluso con llave, así que no era
// una solución duradera. OpenFreeMap es gratis sin límite, sin cuenta ni
// key — mismo criterio que ya alejó a AKOPIA de Mapbox hacia Nominatim el 19
// de agosto: nada que dependa de una cuenta de nadie.
//
// Se sirve como teselas vectoriales (MapLibre GL), no ráster — se integran a
// los mapas de Leaflet ya existentes con `@maplibre/maplibre-gl-leaflet`
// (ver `maplibre-basemap.tsx`), sin tocar el resto del comportamiento de
// Leaflet (arrastrar el pin, clic para mover, `CircleMarker`, etc.).
import { useEffect, useState } from "react";
import type { StyleSpecification } from "maplibre-gl";

export const OPENFREEMAP_POSITRON_STYLE = "https://tiles.openfreemap.org/styles/positron";

// Exigida por OpenFreeMap (openfreemap.org/quick_start) junto con la propia
// atribución de OpenStreetMap.
export const OPENFREEMAP_ATTRIBUTION =
  'OpenFreeMap &copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
  'Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

// A diferencia de CARTO (que ofrecía `light_nolabels` como tesela ráster ya
// horneada sin nombres), OpenFreeMap solo publica el estilo completo — quitar
// las etiquetas es cosa nuestra, filtrando las capas `symbol` (texto/íconos
// de lugar) del propio estilo vectorial antes de dibujarlo. Cacheado a nivel
// de módulo: el estilo no cambia entre sesiones, así que un mismo mapa que se
// desmonta y se vuelve a montar (navegar fuera y volver al panel) no repite
// la petición.
let cachedLabellessStyle: Promise<StyleSpecification> | null = null;

function fetchLabellessStyle(): Promise<StyleSpecification> {
  if (!cachedLabellessStyle) {
    cachedLabellessStyle = fetch(OPENFREEMAP_POSITRON_STYLE)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el estilo del mapa.");
        return response.json();
      })
      .then((style: StyleSpecification) => ({
        ...style,
        layers: style.layers.filter((layer) => layer.type !== "symbol"),
      }))
      .catch((error: unknown) => {
        // Se limpia la caché para que un próximo montaje pueda reintentar en
        // vez de quedar con el fallo pegado para el resto de la sesión.
        cachedLabellessStyle = null;
        throw error;
      });
  }
  return cachedLabellessStyle;
}

// Es la variante "sin nombres de lugar" que usa `HelpMap` — mismo criterio ya
// documentado para `light_nolabels` de CARTO: la diferencia entre un mapa de
// referencia y un mapa de vigilancia. Devuelve `null` mientras carga.
export function useLabellessMapStyle(): StyleSpecification | null {
  const [style, setStyle] = useState<StyleSpecification | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLabellessStyle()
      .then((result) => {
        if (!cancelled) setStyle(result);
      })
      .catch(() => {
        // El mapa queda sin fondo hasta recargar — el mismo dominio ya sirve
        // las teselas normales, así que un fallo aislado aquí sería señal de
        // un problema de red más amplio, no de este componente.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return style;
}
