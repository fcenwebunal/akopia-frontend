"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { normalize } from "@/lib/catalog";
import { locationLabel, type Location } from "@/lib/locations";
import { PhotoTile } from "./photo-tile";

/*
 * Grilla con foto en vez de un <select> de texto: en bodega es más
 * rápido reconocer un estante por su foto que leer "Bodega A-E1-P3"
 * entre otras diez opciones iguales. El buscador filtra en memoria por
 * zona, estante, posición o descripción a la vez — cualquiera de los
 * cuatro que coincida basta, porque no siempre se recuerda cuál de los
 * campos es el que tiene el dato que se busca.
 *
 * `currentLocationId` deshabilita esa casilla (no tiene sentido
 * "trasladar" a donde ya está) en vez de ocultarla — verla ahí, apagada,
 * confirma dónde está antes de elegir hacia dónde se mueve.
 */
export function LocationPicker({
  locations,
  value,
  onChange,
  currentLocationId,
  allowUnlocated = true,
}: {
  locations: Location[];
  value: string;
  onChange: (locationId: string) => void;
  currentLocationId?: string;
  allowUnlocated?: boolean;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return locations;
    return locations.filter((location) =>
      [location.zone, location.shelf, location.position, location.description].some(
        (field) => field && normalize(field).includes(needle)
      )
    );
  }, [locations, query]);

  const showUnlocated =
    allowUnlocated && (!query.trim() || normalize("mesa de pendientes sin ubicar").includes(normalize(query.trim())));

  return (
    <div>
      <label htmlFor="loc-buscar" className="sr-only">
        Buscar ubicación
      </label>
      <input
        id="loc-buscar"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por zona, estante, posición o descripción…"
        autoComplete="off"
        className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5 text-sm"
      />

      <div className="mt-3 grid max-h-64 grid-cols-3 gap-3 overflow-y-auto pr-1">
        {showUnlocated ? (
          <UnlocatedTile
            selected={value === ""}
            disabled={currentLocationId === ""}
            onSelect={() => onChange("")}
          />
        ) : null}

        {filtered.map((location) => (
          <PhotoTile
            key={location.id}
            label={locationLabel(location)}
            sublabel={location.description}
            photoUrl={location.photo_url}
            recordId={location.id}
            kind="locations"
            selected={value === location.id}
            disabled={currentLocationId === location.id}
            onSelect={() => onChange(location.id)}
          />
        ))}
      </div>

      {!showUnlocated && filtered.length === 0 ? (
        <p className="mt-3 text-sm text-(--muted)">Ninguna ubicación coincide con "{query}".</p>
      ) : null}
    </div>
  );
}

function UnlocatedTile({
  selected,
  disabled,
  onSelect,
}: {
  selected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={disabled ? undefined : 0}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onSelect();
        }
      }}
      className={`text-left ${disabled ? "cursor-default opacity-40" : "cursor-pointer"}`}
    >
      <div
        className={`relative flex aspect-square w-full items-center justify-center rounded-lg border-2 border-dashed bg-(--surface-2) text-(--muted) ${
          selected ? "border-unal-green-dark ring-2 ring-unal-green-dark" : "border-(--rule)"
        }`}
      >
        <MapPin size={22} aria-hidden="true" />
      </div>
      <p className="mt-1.5 text-sm font-bold leading-tight">Mesa de pendientes</p>
      <p className="text-xs leading-tight text-(--muted)">Sin ubicar</p>
    </div>
  );
}
