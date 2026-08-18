"use client";

import Link from "next/link";
import { useCallback } from "react";
import { fetchMissingProducts } from "@/lib/missing-products";
import { useAsyncData } from "@/lib/use-async-data";
import { MissingProductsList } from "@/components/inventory/missing-products-list";

/*
 * Esta página es el "contenedor": trae los datos (con sesión, vía
 * `fetchMissingProducts`) y se los pasa a `MissingProductsList`, que no
 * sabe nada de PocketBase ni de autenticación. Esa separación es la que
 * permite reciclar el componente en la landing pública más adelante sin
 * arrastrar el panel completo — solo haría falta un contenedor nuevo con
 * un fetcher sin sesión, la vista se queda igual.
 */
export default function ProductosFaltantesPage() {
  const fetchData = useCallback(() => fetchMissingProducts(), []);
  const { data: items, error, reload } = useAsyncData(fetchData);

  return (
    <div>
      <Link href="/panel/solicitudes" className="text-sm font-bold text-unal-green-dark">
        ← Solicitudes
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Productos faltantes</h1>
          <p className="mt-1 text-(--muted)">
            Lo que la comunidad está pidiendo y todavía no hay suficiente en bodega para cubrir.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="text-xs font-bold text-(--muted) hover:text-unal-green-dark"
        >
          Actualizar
        </button>
      </div>

      <div className="mt-6">
        <MissingProductsList
          items={items ?? []}
          loading={items === null && !error}
          error={error}
          title=""
          emptyMessage="Ninguna solicitud pendiente se queda sin stock por ahora."
        />
      </div>
    </div>
  );
}
