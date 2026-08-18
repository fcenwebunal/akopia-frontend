"use client";

import { pb } from "./pb";

export interface DispatchLocation {
  id: string;
  lat: number;
  lng: number;
}

interface DispatchLocationRow {
  id: string;
  destination_lat: number;
  destination_lng: number;
}

/*
 * Un campo numérico sin definir en PocketBase queda en 0, no en null
 * (verificado contra el servidor real) — así que "0" es el valor
 * centinela de "sin coordenadas", no un punto real en el mapa. Filtrar
 * por `!= 0` en las dos direcciones es lo que separa un despacho
 * marcado de uno que nunca se tocó.
 */
export async function fetchDispatchLocations(): Promise<DispatchLocation[]> {
  const rows = await pb.collection("dispatches").getFullList<DispatchLocationRow>({
    filter: "destination_lat != 0 && destination_lng != 0",
    fields: "id,destination_lat,destination_lng",
  });

  return rows.map((row) => ({ id: row.id, lat: row.destination_lat, lng: row.destination_lng }));
}
