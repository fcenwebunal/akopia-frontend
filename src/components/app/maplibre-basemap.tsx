"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { maplibreGL } from "@maplibre/maplibre-gl-leaflet";
import type { StyleSpecification } from "maplibre-gl";
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
 */
export function MaplibreBasemap({ style }: { style: string | StyleSpecification }) {
  const map = useMap();

  useEffect(() => {
    const layer = maplibreGL({
      style,
      attributionControl: { customAttribution: OPENFREEMAP_ATTRIBUTION },
    }).addTo(map);

    return () => {
      map.removeLayer(layer);
    };
  }, [map, style]);

  return null;
}
