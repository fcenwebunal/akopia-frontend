"use client";

import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import { MANIZALES_CENTER } from "@/lib/coordinates";
import type { DispatchLocation } from "@/lib/dispatch-locations";

/*
 * Igual que `map-picker.tsx`: toca `window` al importarse, así que
 * quien lo consume debe cargarlo con `next/dynamic(..., { ssr: false })`.
 *
 * Puramente presentacional — recibe `points` ya resueltos, no sabe de
 * dónde vinieron. La misma razón de siempre: que se pueda mover a otra
 * parte (una landing pública, por ejemplo) sin arrastrar `pb` con él.
 *
 * Sin nombres de calles ni de barrios a propósito: `light_all` de CARTO
 * trae etiquetas, así que aquí se usa su variante `light_nolabels` —
 * mismas calles, manzanas y verde, sin una sola palabra encima. Es la
 * diferencia entre un mapa de referencia y un mapa de vigilancia: se ve
 * que se ayudó por toda la ciudad, no la dirección exacta de nadie.
 */
export function HelpMap({ points }: { points: DispatchLocation[] }) {
  return (
    <div className="h-72 w-full overflow-hidden rounded border border-(--rule)">
      <MapContainer
        center={MANIZALES_CENTER}
        zoom={12}
        scrollWheelZoom={false}
        dragging={points.length > 0}
        zoomControl={false}
        attributionControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
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
