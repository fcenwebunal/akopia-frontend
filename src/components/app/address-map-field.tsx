"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Search } from "lucide-react";
import {
  STREET_TYPES,
  composeAddress,
  parseAddress,
  EMPTY_STRUCTURED_ADDRESS,
  type StructuredAddress,
} from "@/lib/address";
import { forwardGeocode, reverseGeocode, type GeocodeSuggestion } from "@/lib/geocoding";
import { MANIZALES_CENTER, formatCoordinates } from "@/lib/coordinates";

// Leaflet toca `window` al cargarse — nunca se importa directo desde una
// página, ver map-picker.tsx.
const MapPicker = dynamic(() => import("./map-picker").then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded border border-(--rule) bg-(--surface-2)" />,
});

const addressFieldsSchema = z
  .object({
    streetType: z.string(),
    streetNumber: z.string().max(20, "Máximo 20 caracteres."),
    streetPlate: z.string().max(20, "Máximo 20 caracteres."),
    complement: z.string().max(200, "Máximo 200 caracteres."),
  })
  .refine((data) => !data.streetType || data.streetNumber.trim().length > 0, {
    message: "Ingresa el número de la vía.",
    path: ["streetNumber"],
  });

export interface AddressValue extends StructuredAddress {
  destination: string;
  lat: number;
  lng: number;
}

export const EMPTY_ADDRESS_VALUE: AddressValue = {
  ...EMPTY_STRUCTURED_ADDRESS,
  destination: "",
  lat: MANIZALES_CENTER[0],
  lng: MANIZALES_CENTER[1],
};

const GEOCODE_QUERY_SUFFIX = ", Manizales, Caldas, Colombia";

/*
 * Combina, para una sola dirección: los cuatro campos de nomenclatura
 * colombiana (react-hook-form + zod), un buscador con autocompletado de
 * Nominatim/OSM restringido a Colombia/Manizales, y el mapa con pin
 * arrastrable (geocoding inverso al soltarlo). Las tres vías escriben el mismo
 * `AddressValue` hacia el padre — nunca hay dos fuentes de verdad a la
 * vez.
 *
 * Ningún geocodificador devuelve tipo de vía/número/placa por separado
 * para una dirección colombiana: lo que llega de una sugerencia o de
 * arrastrar el pin se descompone con `parseAddress` (best-effort, ver
 * src/lib/address.ts) y queda como valor de partida editable, nunca
 * como el dato final sin que el operador lo confirme.
 */
export function AddressMapField({
  value,
  onChange,
  heightClassName = "h-64",
}: {
  value: AddressValue;
  onChange: (value: AddressValue) => void;
  heightClassName?: string;
}) {
  const {
    register,
    watch,
    reset,
    formState: { errors },
  } = useForm<StructuredAddress>({
    resolver: zodResolver(addressFieldsSchema),
    defaultValues: value,
    mode: "onChange",
  });
  const fields = watch();

  const [lat, setLat] = useState(value.lat);
  const [lng, setLng] = useState(value.lng);
  const [destination, setDestination] = useState(value.destination);
  const destinationRef = useRef(destination);
  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);

  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const lastEmitted = useRef(value);
  // En true justo antes de un `reset()` propio (sincronizar desde el
  // padre, elegir una sugerencia, soltar el pin) para que el efecto de
  // composición/geocoding de abajo no reaccione a ese cambio como si el
  // operador hubiera tecleado los campos — evita que el pin "salte" a un
  // resultado de geocoding ligeramente distinto del punto real elegido.
  const skipNextCompose = useRef(true);

  // Cambios empujados desde el padre (heredar el destino de una
  // solicitud al elegirla en despachos/nueva, por ejemplo) — nunca
  // cuando el cambio ya salió de aquí mismo.
  useEffect(() => {
    if (JSON.stringify(value) === JSON.stringify(lastEmitted.current)) return;
    lastEmitted.current = value;
    skipNextCompose.current = true;
    reset({
      streetType: value.streetType,
      streetNumber: value.streetNumber,
      streetPlate: value.streetPlate,
      complement: value.complement,
    });
    setLat(value.lat);
    setLng(value.lng);
    setDestination(value.destination);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona a `value`, el resto son setters estables.
  }, [value]);

  const emit = useCallback(
    (next: AddressValue) => {
      lastEmitted.current = next;
      onChange(next);
    },
    [onChange]
  );

  // Compone el texto de los cuatro campos y, un momento después de que
  // el operador deja de teclear, ubica el pin automáticamente.
  useEffect(() => {
    const composed = composeAddress(fields);
    // Sin tipo de vía o número no hay dirección estructurada que
    // componer (`composeAddress` devuelve "" o solo el complemento) —
    // se conserva el texto previo en vez de borrarlo, para no perder un
    // destino heredado o escrito a mano (veredas, sitios sin
    // nomenclatura formal).
    const nextDestination = composed || destinationRef.current;

    if (skipNextCompose.current) {
      skipNextCompose.current = false;
      setDestination(nextDestination);
      emit({ ...fields, destination: nextDestination, lat, lng });
      return;
    }

    setDestination(nextDestination);

    if (!fields.streetType || !fields.streetNumber.trim()) {
      emit({ ...fields, destination: nextDestination, lat, lng });
      return;
    }

    const handle = setTimeout(async () => {
      setLocating(true);
      setNotice(null);
      try {
        const [result] = await forwardGeocode(`${composed}${GEOCODE_QUERY_SUFFIX}`);
        if (result) {
          setLat(result.lat);
          setLng(result.lng);
          emit({ ...fields, destination: nextDestination, lat: result.lat, lng: result.lng });
        } else {
          setNotice("No se encontró esa dirección en el mapa — ajusta el pin a mano.");
          emit({ ...fields, destination: nextDestination, lat, lng });
        }
      } catch {
        setNotice("No se pudo ubicar automáticamente — ajusta el pin a mano.");
        emit({ ...fields, destination: nextDestination, lat, lng });
      } finally {
        setLocating(false);
      }
    }, 900);

    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lat/lng/emit se leen del cierre a propósito, no deben re-disparar este efecto.
  }, [fields.streetType, fields.streetNumber, fields.streetPlate, fields.complement]);

  // Autocompletado libre — camino rápido alterno a los cuatro campos.
  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        setSuggestions(await forwardGeocode(query));
      } catch {
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  function selectSuggestion(suggestion: GeocodeSuggestion) {
    const parsed = parseAddress(suggestion.placeName);
    const next: StructuredAddress = {
      streetType: parsed.streetType ?? "",
      streetNumber: parsed.streetNumber ?? "",
      streetPlate: parsed.streetPlate ?? "",
      complement: fields.complement,
    };

    skipNextCompose.current = true;
    reset(next);
    setLat(suggestion.lat);
    setLng(suggestion.lng);
    setDestination(suggestion.placeName);
    setNotice("Dirección detectada automáticamente — revisa los campos.");
    setQuery("");
    setSuggestions([]);
    emit({ ...next, destination: suggestion.placeName, lat: suggestion.lat, lng: suggestion.lng });
  }

  const handleMapChange = useCallback(
    (newLat: number, newLng: number) => {
      setLat(newLat);
      setLng(newLng);
      emit({ ...fields, destination: destinationRef.current, lat: newLat, lng: newLng });

      reverseGeocode(newLat, newLng)
        .then((placeName) => {
          if (!placeName) return;
          const parsed = parseAddress(placeName);
          const next: StructuredAddress = {
            streetType: parsed.streetType ?? fields.streetType,
            streetNumber: parsed.streetNumber ?? fields.streetNumber,
            streetPlate: parsed.streetPlate ?? fields.streetPlate,
            complement: fields.complement,
          };
          skipNextCompose.current = true;
          reset(next);
          setDestination(placeName);
          setNotice("Dirección detectada desde el mapa — revisa los campos.");
          emit({ ...next, destination: placeName, lat: newLat, lng: newLng });
        })
        .catch(() => {
          // El pin ya se movió y se emitió con las coordenadas nuevas;
          // sin descripción de texto, el operador la escribe a mano.
        });
    },
    [emit, fields, reset]
  );

  return (
    <div>
      <div className="relative">
        <label htmlFor="direccion-buscar" className="mb-1 block text-sm font-bold">
          Buscar dirección
        </label>
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-(--muted)"
            aria-hidden="true"
          />
          <input
            id="direccion-buscar"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej.: Cra 23 # 45-67, Manizales"
            autoComplete="off"
            className="w-full rounded border border-(--rule) bg-(--surface) py-2.5 pr-3 pl-9"
          />
          {searching ? (
            <Loader2
              size={16}
              className="absolute top-1/2 right-3 -translate-y-1/2 animate-spin text-(--muted)"
              aria-hidden="true"
            />
          ) : null}
        </div>
        {suggestions.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full rounded border border-(--rule) bg-(--surface) shadow-lg">
            {suggestions.map((suggestion) => (
              <li key={suggestion.id}>
                <button
                  type="button"
                  onClick={() => selectSuggestion(suggestion)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-(--surface-2)"
                >
                  {suggestion.placeName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div>
          <label htmlFor="tipo-via" className="mb-1 block text-sm font-bold">
            Tipo de vía
          </label>
          <select
            id="tipo-via"
            {...register("streetType")}
            className="w-full rounded border border-(--rule) bg-(--surface) px-2 py-2.5 text-sm"
          >
            <option value="">—</option>
            {STREET_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="numero-via" className="mb-1 block text-sm font-bold">
            Número
          </label>
          <input
            id="numero-via"
            {...register("streetNumber")}
            placeholder="23"
            className="w-full rounded border border-(--rule) bg-(--surface) px-2 py-2.5 text-sm"
          />
          {errors.streetNumber ? (
            <p className="mt-1 text-xs text-unal-red">{errors.streetNumber.message}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="placa-via" className="mb-1 block text-sm font-bold">
            Placa
          </label>
          <input
            id="placa-via"
            {...register("streetPlate")}
            placeholder="45-67"
            className="w-full rounded border border-(--rule) bg-(--surface) px-2 py-2.5 text-sm"
          />
        </div>
        <div>
          <label htmlFor="complemento" className="mb-1 block text-sm font-bold">
            Complemento
          </label>
          <input
            id="complemento"
            {...register("complement")}
            placeholder="Apto, barrio…"
            className="w-full rounded border border-(--rule) bg-(--surface) px-2 py-2.5 text-sm"
          />
        </div>
      </div>

      <p className="mt-2 text-sm text-(--ink-2)">
        {destination || "Sin dirección todavía."}
        {locating ? <span className="ml-2 text-xs text-(--muted)">Ubicando en el mapa…</span> : null}
      </p>
      {notice ? <p className="mt-1 text-xs text-unal-orange">{notice}</p> : null}

      <div className="mt-3">
        <p className="mb-2 text-xs text-(--muted)">
          Arrastra el punto verde (o toca el mapa) hasta la dirección exacta.
        </p>
        <MapPicker lat={lat} lng={lng} onChange={handleMapChange} heightClassName={heightClassName} />
        <p className="mt-1.5 font-mono text-xs text-(--muted)">{formatCoordinates(lat, lng)}</p>
      </div>
    </div>
  );
}
