"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { MANIZALES_CENTER } from "@/lib/coordinates";
import { MAPBOX_ENABLED } from "@/lib/mapbox";

/*
 * Igual regla que Leaflet (ver map-picker.tsx): mapbox-gl toca `window`
 * al cargarse, así que este archivo siempre se importa con
 * `next/dynamic(..., { ssr: false })`, nunca directo desde una página.
 */
if (MAPBOX_ENABLED) {
  mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";
}

function buildMarkerElement(): HTMLDivElement {
  const el = document.createElement("div");
  el.style.cssText =
    "width:18px;height:18px;border-radius:9999px;background:#6f8a24;" +
    "border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:grab";
  return el;
}

export function MapboxPicker({
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!MAPBOX_ENABLED || !containerRef.current || mapRef.current) return;

    const startLat = lat ?? MANIZALES_CENTER[0];
    const startLng = lng ?? MANIZALES_CENTER[1];

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [startLng, startLat],
      zoom: lat !== null ? 16 : 13,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");

    const marker = new mapboxgl.Marker({ element: buildMarkerElement(), draggable: true })
      .setLngLat([startLng, startLat])
      .addTo(map);

    marker.on("dragend", () => {
      const pos = marker.getLngLat();
      onChangeRef.current(pos.lat, pos.lng);
    });
    map.on("click", (event) => {
      marker.setLngLat(event.lngLat);
      onChangeRef.current(event.lngLat.lat, event.lngLat.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- el mapa se crea una sola vez; lat/lng después se sincronizan aparte.
  }, []);

  // Sincroniza el pin cuando lat/lng cambian desde afuera (geocoding de
  // texto, autocompletado, o el destino heredado de una solicitud) —
  // sin esto, escribir una dirección nunca movería el mapa.
  useEffect(() => {
    if (!markerRef.current || !mapRef.current || lat === null || lng === null) return;
    const current = markerRef.current.getLngLat();
    if (Math.abs(current.lat - lat) < 1e-7 && Math.abs(current.lng - lng) < 1e-7) return;

    markerRef.current.setLngLat([lng, lat]);
    mapRef.current.easeTo({ center: [lng, lat], zoom: Math.max(mapRef.current.getZoom(), 15) });
  }, [lat, lng]);

  if (!MAPBOX_ENABLED) {
    return (
      <div
        className={`${heightClassName} flex w-full items-center justify-center rounded border border-dashed border-unal-yellow bg-(--surface-2) p-4 text-center text-sm text-(--muted)`}
      >
        Falta configurar <span className="mx-1 font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</span> para mostrar el mapa.
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`${heightClassName} w-full overflow-hidden rounded border border-(--rule)`}
    />
  );
}
