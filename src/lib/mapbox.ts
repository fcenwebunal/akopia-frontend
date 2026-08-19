// Geocoding directo e inverso contra la API REST de Mapbox — sin el SDK
// (`@mapbox/mapbox-sdk`), que solo se necesitaría para más de lo que se
// usa aquí. `mapbox-gl` (el mapa en sí) es la única dependencia nueva
// además de esto.

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "";

export const MAPBOX_ENABLED = MAPBOX_TOKEN.length > 0;

// lng,lat — Mapbox siempre en ese orden, al revés de como se maneja el
// resto de este proyecto (lat,lng, ver src/lib/coordinates.ts).
const MANIZALES_PROXIMITY = "-75.517717,5.070275";
// Caja amplia alrededor de Manizales, no sus límites exactos — mismo
// criterio que ya usa el rango de validación del backend (migraciones
// 039/040).
const MANIZALES_BBOX = "-75.65,4.95,-75.35,5.20";

export interface GeocodeSuggestion {
  id: string;
  placeName: string;
  lat: number;
  lng: number;
}

async function geocodingRequest(path: string, params: Record<string, string>): Promise<GeocodeSuggestion[]> {
  if (!MAPBOX_ENABLED) return [];

  const url = new URL(`https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json`);
  url.searchParams.set("access_token", MAPBOX_TOKEN);
  url.searchParams.set("language", "es");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("No se pudo consultar el mapa. Intenta de nuevo.");

  const data = await response.json();
  const features: unknown[] = Array.isArray(data.features) ? data.features : [];

  return features
    .map((feature) => {
      const f = feature as { id?: string; place_name?: string; center?: [number, number] };
      if (!f.center) return null;
      return {
        id: f.id ?? f.place_name ?? "",
        placeName: f.place_name ?? "",
        lat: f.center[1],
        lng: f.center[0],
      };
    })
    .filter((s): s is GeocodeSuggestion => s !== null);
}

// Autocompletado — restringido a Colombia y sesgado hacia Manizales, no
// limitado estrictamente a la ciudad (una donación puede venir de un
// municipio vecino).
export async function forwardGeocode(query: string): Promise<GeocodeSuggestion[]> {
  if (!query.trim()) return [];
  return geocodingRequest(encodeURIComponent(query), {
    country: "co",
    proximity: MANIZALES_PROXIMITY,
    bbox: MANIZALES_BBOX,
    autocomplete: "true",
    limit: "5",
  });
}

// Geocoding inverso — al arrastrar el pin, qué dirección hay ahí.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const results = await geocodingRequest(`${lng},${lat}`, { types: "address,poi" });
  return results[0]?.placeName ?? null;
}
