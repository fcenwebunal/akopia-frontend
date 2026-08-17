"use client";

import { useCallback, useMemo, useState } from "react";
import { pb } from "@/lib/pb";
import { loadCatalog, normalize } from "@/lib/catalog";
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
  product_id: string;
  expand?: {
    product_id?: { name?: string; category_id?: string };
    unit_id?: { code?: string; name?: string };
    location_id?: Location;
  };
}

const UNLOCATED = "__sin_ubicar__";

// Las ubicaciones no guardan un código armado: se compone de zona, estante
// y posición, como en el catálogo maestro (A-01-03).
function locationLabel(location: Location | undefined): string {
  const parts = [location?.zone, location?.shelf, location?.position].filter(
    (part): part is string => Boolean(part)
  );

  return parts.length > 0 ? parts.join("-") : "Sin ubicar";
}

export default function InventarioPage() {
  const fetchData = useCallback(async () => {
    const [catalog, page] = await Promise.all([
      loadCatalog(),
      pb.collection("inventory").getList<InventoryRow>(1, 200, {
        sort: "-total_qty",
        expand: "product_id,unit_id,location_id",
      }),
    ]);
    return { catalog, rows: page.items };
  }, []);

  const { data, error } = useAsyncData(fetchData);

  const [groupId, setGroupId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [query, setQuery] = useState("");

  // Las categorías dependen del grupo elegido, así el selector no ofrece
  // combinaciones que no existen.
  const categories = useMemo(() => {
    if (!data || !groupId) return [];
    return data.catalog.categories.filter((category) => category.group_id === groupId);
  }, [data, groupId]);

  // Las ubicaciones que ofrece el filtro son las que de verdad aparecen en
  // el inventario, no todo `locations`: si algo está sin ubicar en un solo
  // sitio, no tiene sentido listar zonas que nadie usó todavía.
  const locationOptions = useMemo(() => {
    if (!data) return [];
    const labels = new Map<string, string>();
    for (const row of data.rows) {
      const label = locationLabel(row.expand?.location_id);
      const key = label === "Sin ubicar" ? UNLOCATED : label;
      labels.set(key, label);
    }
    return Array.from(labels.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [data]);

  const filteredRows = useMemo(() => {
    if (!data) return [];

    const needle = normalize(query.trim());
    const categoryById = new Map(data.catalog.categories.map((c) => [c.id, c]));

    return data.rows.filter((row) => {
      const categoryId2 = row.expand?.product_id?.category_id;
      const category = categoryId2 ? categoryById.get(categoryId2) : undefined;

      if (groupId && category?.group_id !== groupId) return false;
      if (categoryId && categoryId2 !== categoryId) return false;

      if (locationFilter) {
        const label = locationLabel(row.expand?.location_id);
        const key = label === "Sin ubicar" ? UNLOCATED : label;
        if (key !== locationFilter) return false;
      }

      if (needle) {
        const name = normalize(row.expand?.product_id?.name ?? "");
        if (!name.includes(needle)) return false;
      }

      return true;
    });
  }, [data, groupId, categoryId, locationFilter, query]);

  const hasFilters = Boolean(groupId || categoryId || locationFilter || query);

  function clearFilters() {
    setGroupId("");
    setCategoryId("");
    setLocationFilter("");
    setQuery("");
  }

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

      {data === null && !error ? (
        <p className="mt-6 text-(--muted)">Cargando…</p>
      ) : null}

      {data !== null ? (
        <>
          <div className="mt-6 grid gap-2 sm:grid-cols-4">
            <label className="sr-only" htmlFor="buscar-inv">
              Buscar producto
            </label>
            <input
              id="buscar-inv"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar producto…"
              autoComplete="off"
              className="rounded border border-(--rule) bg-(--surface) px-3 py-2.5 sm:col-span-1"
            />

            <label className="sr-only" htmlFor="filtro-grupo">
              Grupo
            </label>
            <select
              id="filtro-grupo"
              value={groupId}
              onChange={(event) => {
                setGroupId(event.target.value);
                setCategoryId("");
              }}
              className="rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              <option value="">Todos los grupos</option>
              {data.catalog.groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="filtro-categoria">
              Categoría
            </label>
            <select
              id="filtro-categoria"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={!groupId}
              className="rounded border border-(--rule) bg-(--surface) px-3 py-2.5 disabled:opacity-50"
            >
              <option value="">Todas las categorías</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <label className="sr-only" htmlFor="filtro-ubicacion">
              Ubicación
            </label>
            <select
              id="filtro-ubicacion"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              className="rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              <option value="">Todas las ubicaciones</option>
              {locationOptions.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {hasFilters ? (
            <div className="mt-2 flex items-center justify-between text-sm text-(--muted)">
              <span>
                {filteredRows.length} de {data.rows.length} productos
              </span>
              <button
                type="button"
                onClick={clearFilters}
                className="font-bold text-unal-green-dark hover:underline"
              >
                Quitar filtros
              </button>
            </div>
          ) : null}

          {filteredRows.length === 0 ? (
            <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
              <p className="font-bold">
                {data.rows.length === 0
                  ? "Todavía no hay nada en bodega."
                  : "Ningún producto coincide con el filtro."}
              </p>
              {data.rows.length === 0 ? (
                <p className="mt-1 text-(--ink-2)">
                  El inventario aparece cuando clasificas un artículo de una
                  donación como disponible o en cuarentena.
                </p>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto rounded border border-(--rule) bg-(--surface)">
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
                  {filteredRows.map((row) => (
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
          )}
        </>
      ) : null}
    </div>
  );
}
