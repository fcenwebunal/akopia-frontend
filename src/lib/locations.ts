"use client";

import { pb } from "./pb";

export interface Location {
  id: string;
  zone: string;
  shelf?: string;
  position?: string;
  description?: string;
  capacity_m3?: number;
  is_cold_chain?: boolean;
  active?: boolean;
  photo_url?: string;
}

export async function loadLocations(): Promise<Location[]> {
  const locations = await pb.collection("locations").getFullList<Location>({ sort: "zone" });
  return locations.filter((location) => location.active !== false);
}

// Igual que en el catálogo: no hay código armado, se compone de zona,
// estante y posición, como en el catálogo maestro (A-01-03).
export function locationLabel(location?: Pick<Location, "zone" | "shelf" | "position">): string {
  if (!location) return "Sin ubicar";
  const parts = [location.zone, location.shelf, location.position].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join("-") : "Sin ubicar";
}
