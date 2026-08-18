"use client";

import { callRoute } from "./pb";

/*
 * Forma de dato compartida entre el panel y la landing pública: no
 * lleva nada del solicitante, solo qué falta y su foto. Ver el
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
  photo_url: string;
}

/*
 * Fetcher del panel: pasa por `callRoute`, que manda el token de sesión
 * de `pb.authStore`. La landing pública NO usa esto — la ruta ya está
 * abierta sin sesión, así que `(public)/page.tsx` la llama con un
 * `fetch()` liso, del lado del servidor. Ambos devuelven `MissingProduct[]`
 * y pueden alimentar el mismo `<MissingProductsList>` sin que ese
 * componente sepa ni le importe de dónde vinieron los datos.
 */
export async function fetchMissingProducts(): Promise<MissingProduct[]> {
  const { items } = await callRoute<{ items: MissingProduct[] }>(
    "/api/requests/missing-products"
  );
  return items;
}
