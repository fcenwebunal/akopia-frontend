"use client";

import { callRoute } from "./pb";

/*
 * Forma de dato compartida entre el panel y —más adelante— la landing
 * pública: no lleva nada del solicitante, solo qué falta. Ver el
 * comentario de la ruta en el backend (`05_routes.pb.js`,
 * `/api/requests/missing-products`) para la razón completa.
 */
export interface MissingProduct {
  product_id: string;
  product_name: string;
  category_name: string;
  unit: string;
  requested_qty: number;
  available_qty: number;
  missing_qty: number;
}

/*
 * Fetcher del panel: pasa por `callRoute`, que manda el token de sesión
 * de `pb.authStore`. Esto es justo lo que NO debe usar una versión
 * pública del mismo dato — cuando esa vista exista, va a tener su propio
 * fetcher (probablemente un `fetch()` liso, sin auth, contra la misma
 * ruta ya abierta al público). Ambos fetchers devuelven `MissingProduct[]`
 * y pueden alimentar el mismo `<MissingProductsList>` sin que ese
 * componente sepa ni le importe de dónde vinieron los datos.
 */
export async function fetchMissingProducts(): Promise<MissingProduct[]> {
  const { items } = await callRoute<{ items: MissingProduct[] }>(
    "/api/requests/missing-products"
  );
  return items;
}
