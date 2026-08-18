"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L, { type LeafletMouseEvent } from "leaflet";
import { MANIZALES_CENTER } from "@/lib/coordinates";

/*
 * Este archivo importa Leaflet, que toca `window` al cargarse — nunca
 * se importa directo desde una página, siempre con
 * `next/dynamic(..., { ssr: false })`, o el render en servidor truena.
 *
 * Un `divIcon` propio en vez del marcador por defecto de Leaflet:
 * su ícono de fábrica depende de rutas de imagen relativas que el
 * empaquetado de Next.js rompe (problema conocido y documentado de
 * Leaflet + Webpack). Un círculo verde de CSS no tiene ese problema y
 * de paso combina con la identidad de AKOPIA en vez del pin azul de
 * genérico de Leaflet.
 */
const markerIcon = L.divIcon({
  className: "",
  html:
    '<span style="display:block;width:18px;height:18px;border-radius:9999px;' +
    'background:#6f8a24;border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5)"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickToMove({ onMove }: { onMove: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(event: LeafletMouseEvent) {
      onMove(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function MapPicker({
  lat,
  lng,
  onChange,
  heightClassName = "h-64",
}: {
  lat: number | null;
  lng: number | null;
  onChange: (lat: number, lng: number) => void;
  heightClassName?: string;
}) {
  const position = useMemo<[number, number]>(
    () => (lat !== null && lng !== null ? [lat, lng] : MANIZALES_CENTER),
    [lat, lng]
  );

  return (
    <div className={`${heightClassName} w-full overflow-hidden rounded border border-(--rule)`}>
      <MapContainer
        center={position}
        zoom={lat !== null ? 16 : 13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          // CARTO Positron: calles, manzanas y verde, sin nombres de
          // lugar — justo el nivel de detalle que hace falta para
          // ubicar un punto, sin ruido de etiquetas.
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <ClickToMove onMove={onChange} />
        <Marker
          position={position}
          draggable
          icon={markerIcon}
          eventHandlers={{
            dragend: (event) => {
              const marker = event.target as L.Marker;
              const point = marker.getLatLng();
              onChange(point.lat, point.lng);
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
