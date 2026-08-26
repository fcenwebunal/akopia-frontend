/*
 * Las cantidades y pesos vienen de sumas en punto flotante (JS/SQLite),
 * que arrastran residuos como 50.900000000000006 sin que el dato en sí
 * esté mal — el backend ya redondea el saldo guardado a 3 decimales
 * después de cada movimiento (ver `round3` en utils/helpers.js), pero
 * esto redondea también aquí por si acaso llega algo que no pasó por
 * ahí (un total sumado en el propio frontend, por ejemplo).
 *
 * En la interfaz no tiene sentido mostrar fracciones de un paquete o
 * una unidad — nadie reparte 0.3 de un jabón — así que a partir de 1 se
 * muestra como entero. Por debajo de 1 (gramos, mililitros… cantidades
 * genuinamente fraccionarias) redondear a entero mostraría "0" para
 * algo que sí existe, así que ahí sí se muestran hasta 3 decimales —
 * `toString()` omite los ceros finales por su cuenta (0.10 → "0.1").
 */
export function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded) < 1) return rounded.toString();
  return Math.round(rounded).toString();
}

/*
 * Para un campo editable (`DecimalInput`), no para una lista o una
 * tarjeta: lo que se muestra tiene que ser exactamente lo que se va a
 * enviar si la persona no lo toca — redondear "202.99" a "203" en un
 * campo precargado con el disponible real (reubicar/rechazar el total)
 * mandaría de vuelta más de lo que en verdad hay. Solo recorta el
 * residuo de punto flotante (3 decimales), nunca la parte entera.
 */
export function formatQuantityPrecise(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return (Math.round(value * 1000) / 1000).toString();
}
