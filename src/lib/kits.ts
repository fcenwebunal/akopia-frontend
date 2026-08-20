"use client";

import { pb } from "./pb";

export interface Kit {
  id: string;
  name: string;
  description: string;
  created_by: string;
  active: boolean;
  use_count: number;
  created: string;
}

export interface KitItem {
  id: string;
  kit_id: string;
  product_id: string;
  unit_id: string;
  quantity: number;
}

// Solo los activos — un kit desactivado desaparece del selector pero
// las solicitudes que ya generó no se tocan (no dependen en vivo de
// él, ver `requests.source_kit_id`).
export async function loadKits(): Promise<Kit[]> {
  const kits = await pb.collection("kits").getFullList<Kit>({ sort: "name" });
  return kits.filter((kit) => kit.active !== false);
}

export async function loadKitItems(kitId: string): Promise<KitItem[]> {
  return pb.collection("kit_items").getFullList<KitItem>({
    filter: `kit_id = "${kitId}"`,
    sort: "created",
  });
}
