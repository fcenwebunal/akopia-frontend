/*
 * Las cantidades y pesos vienen de sumas en punto flotante (JS/SQLite),
 * que arrastran residuos como 50.900000000000006 sin que el dato en sí
 * esté mal. Redondear a 3 decimales antes de convertir a texto evita
 * mostrar ese residuo — `toString()` ya omite los ceros finales por su
 * cuenta (8.10 → "8.1", 8.00 → "8"), así que no hace falta recortarlos
 * a mano.
 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return (Math.round(value * 1000) / 1000).toString();
}
