"use client";

import { CircleMarker, MapContainer } from "react-leaflet";
import { MANIZALES_CENTER } from "@/lib/coordinates";
import type { DispatchLocation } from "@/lib/dispatch-locations";
import { useLabellessMapStyle } from "@/lib/openfreemap";
import { MaplibreBasemap } from "@/components/app/maplibre-basemap";

/*
 * Igual que `map-picker.tsx`: toca `window` al importarse, así que
 * quien lo consume debe cargarlo con `next/dynamic(..., { ssr: false })`.
 *
 * Puramente presentacional — recibe `points` ya resueltos, no sabe de
 * dónde vinieron. La misma razón de siempre: que se pueda mover a otra
 * parte (una landing pública, por ejemplo) sin arrastrar `pb` con él.
 *
 * Sin nombres de calles ni de barrios a propósito: `useLabellessMapStyle()`
 * toma el mismo estilo Positron de OpenFreeMap que usa `map-picker.tsx` y le
 * quita las capas de texto — mismas calles, manzanas y verde, sin una sola
 * palabra encima. Es la diferencia entre un mapa de referencia y un mapa de
 * vigilancia: se ve que se ayudó por toda la ciudad, no la dirección exacta
 * de nadie.
 *
 * Con zoom: controles +/-, rueda del mouse y pellizco en táctil. La
 * atribución se queda visible aunque sea un mapa "simplificado" — OpenFreeMap
 * la exige en sus términos de uso, no es decoración.
 */
export function HelpMap({ points }: { points: DispatchLocation[] }) {
  const style = useLabellessMapStyle();

  return (
    <div className="h-72 w-full overflow-hidden rounded border border-(--rule)">
      <MapContainer
        center={MANIZALES_CENTER}
        zoom={12}
        scrollWheelZoom
        dragging
        zoomControl
        attributionControl
        style={{ height: "100%", width: "100%" }}
      >
        {style ? <MaplibreBasemap style={style} /> : null}
        {points.map((point) => (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={6}
            pathOptions={{
              color: "#ffffff",
              weight: 2,
              fillColor: "#6f8a24",
              fillOpacity: 0.9,
            }}
          />
        ))}
      </MapContainer>
    </div>
  );
}
