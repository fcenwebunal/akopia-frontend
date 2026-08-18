// Manizales, en la plaza de Bolívar — centro por defecto del mapa
// cuando todavía no hay un punto propio que mostrar.
export const MANIZALES_CENTER: [number, number] = [5.070275, -75.517717];

export function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function formatCoordinates(lat: number, lng: number, digits = 6): string {
  return `${lat.toFixed(digits)}, ${lng.toFixed(digits)}`;
}
