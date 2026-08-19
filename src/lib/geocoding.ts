// Geocoding directo e inverso contra Nominatim (OpenStreetMap) — gratis,
// sin llave ni cuenta. Reemplaza el primer intento con Mapbox: pedía
// tarjeta para crear la cuenta pese a que su nivel gratuito no debería
// exigirla, el mismo tropiezo que ya había obligado a abandonar Fly.io
// el 18 de agosto. Mismo criterio que ya usan los mapas de la app
// (Leaflet + teselas CARTO, ver map-picker.tsx): nada que dependa de una
// tarjeta de nadie.
//
// La política de uso de Nominatim (operations.osmfoundation.org/policies/nominatim)
// exige identificar la aplicación con un User-Agent o un Referer válido
// y no pasar de 1 petición/segundo. Un `fetch` de navegador no puede fijar
// un User-Agent propio (es un header prohibido para JS), pero sí manda el
// Referer real de la página — es la vía que la propia política contempla
// para aplicaciones de navegador, y el ritmo de tecleo con pausa de este
// componente ya se queda por debajo de 1/s para un solo operador.

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// Sesga la búsqueda hacia Manizales sin limitarla a la ciudad exacta —
// una donación puede venir de un municipio vecino. `viewbox` sin
// `bounded=1` es una preferencia, no un recorte duro.
const MANIZALES_VIEWBOX = "-75.65,5.20,-75.35,4.95"; // lon,lat: izq,arriba,der,abajo

export interface GeocodeSuggestion {
  id: string;
  placeName: string;
  lat: number;
  lng: number;
}

interface NominatimResult {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  address?: {
    road?: string;
    house_number?: string;
  };
}

async function nominatimFetch(path: string, params: Record<string, string>): Promise<NominatimResult[]> {
  const url = new URL(`${NOMINATIM_BASE}${path}`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "es");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("No se pudo consultar el mapa. Intenta de nuevo.");

  const data = await response.json();
  return Array.isArray(data) ? data : [data];
}

function toSuggestion(result: NominatimResult): GeocodeSuggestion | null {
  if (!result.lat || !result.lon) return null;
  return {
    id: String(result.place_id ?? result.display_name ?? ""),
    placeName: result.display_name ?? "",
    lat: Number(result.lat),
    lng: Number(result.lon),
  };
}

// Autocompletado — restringido a Colombia y sesgado hacia Manizales.
export async function forwardGeocode(query: string): Promise<GeocodeSuggestion[]> {
  if (!query.trim()) return [];
  const results = await nominatimFetch("/search", {
    q: query,
    countrycodes: "co",
    viewbox: MANIZALES_VIEWBOX,
    limit: "5",
  });
  return results.map(toSuggestion).filter((s): s is GeocodeSuggestion => s !== null);
}

// Geocoding inverso — al arrastrar el pin, qué dirección hay ahí. Cuando
// Nominatim trae la vía ya separada (`address.road`/`house_number`, lo
// más común en Colombia), se prefiere ese texto más limpio sobre el
// `display_name` completo, que arrastra barrio/ciudad/país como ruido.
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const [result] = await nominatimFetch("/reverse", { lat: String(lat), lon: String(lng) });
  if (!result) return null;

  const road = result.address?.road;
  if (road) {
    return result.address?.house_number ? `${road} ${result.address.house_number}` : road;
  }
  return result.display_name ?? null;
}
