"use client";

import { useCallback } from "react";
import { pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";

interface Location {
  zone?: string;
  shelf?: string;
  position?: string;
}

interface InventoryRow {
  id: string;
  available_qty: number;
  reserved_qty: number;
  quarantine_qty: number;
  total_qty: number;
  expand?: {
    product_id?: { name?: string };
    unit_id?: { code?: string; name?: string };
    location_id?: Location;
  };
}

// Las ubicaciones no guardan un código armado: se compone de zona, estante
// y posición, como en el catálogo maestro (A-01-03).
function locationLabel(location: Location | undefined): string {
  const parts = [location?.zone, location?.shelf, location?.position].filter(
    (part): part is string => Boolean(part)
  );

  return parts.length > 0 ? parts.join("-") : "Sin ubicar";
}

export default function InventarioPage() {
  const fetchInventory = useCallback(async () => {
    const page = await pb.collection("inventory").getList<InventoryRow>(1, 200, {
      sort: "-total_qty",
      expand: "product_id,unit_id,location_id",
    });
    return page.items;
  }, []);

  const { data: rows, error } = useAsyncData(fetchInventory);

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Inventario</h1>
      <p className="mt-1 text-(--muted)">
        Saldos por producto y ubicación. Se actualizan solos con cada
        movimiento: no se editan a mano.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      {rows === null && !error ? (
        <p className="mt-6 text-(--muted)">Cargando…</p>
      ) : null}

      {rows !== null && rows.length === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">Todavía no hay nada en bodega.</p>
          <p className="mt-1 text-(--ink-2)">
            El inventario aparece cuando clasificas un artículo de una donación
            como disponible o en cuarentena.
          </p>
        </div>
      ) : null}

      {rows !== null && rows.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded border border-(--rule) bg-(--surface)">
          <table className="w-full min-w-xl text-sm">
            <thead>
              <tr className="border-b border-(--rule) text-left text-xs uppercase tracking-wider text-(--muted)">
                <th className="px-4 py-3 font-bold">Producto</th>
                <th className="px-4 py-3 font-bold">Ubicación</th>
                <th className="px-4 py-3 text-right font-bold">Disponible</th>
                <th className="px-4 py-3 text-right font-bold">Reservado</th>
                <th className="px-4 py-3 text-right font-bold">Cuarentena</th>
                <th className="px-4 py-3 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-(--rule) last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {row.expand?.product_id?.name ?? "—"}
                    <span className="ml-2 text-xs text-(--muted)">
                      {row.expand?.unit_id?.code ?? row.expand?.unit_id?.name ?? ""}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-(--muted)">
                    {locationLabel(row.expand?.location_id)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-unal-green-dark">
                    {row.available_qty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.reserved_qty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-unal-red">
                    {row.quarantine_qty}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold">
                    {row.total_qty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
