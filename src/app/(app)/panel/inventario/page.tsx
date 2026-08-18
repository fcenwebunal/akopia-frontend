"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { callRoute, errorMessage, pb } from "@/lib/pb";
import { loadCatalog, normalize } from "@/lib/catalog";
import { loadLocations, locationLabel, type Location } from "@/lib/locations";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine, Spinner } from "@/components/ui/spinner";
import { LocationPicker } from "@/components/app/location-picker";

interface InventoryRow {
  id: string;
  product_id: string;
  location_id: string;
  available_qty: number;
  reserved_qty: number;
  quarantine_qty: number;
  total_qty: number;
  expand?: {
    product_id?: { name?: string; category_id?: string };
    unit_id?: { code?: string; name?: string };
  };
}

/*
 * El inventario se organiza por ubicación, no en una tabla plana: es la
 * pregunta que se hace de pie en la bodega ("¿qué hay aquí?"), no
 * "¿dónde está el arroz?" — para eso ya está el buscador. La "mesa de
 * pendientes" (renglones con `location_id` vacío) va primero porque es
 * lo que necesita una decisión hoy; el resto ya está resuelto.
 */
export default function InventarioPage() {
  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [relocating, setRelocating] = useState<InventoryRow | null>(null);
  const [detail, setDetail] = useState<{ row: InventoryRow; location?: Location } | null>(null);

  const fetchData = useCallback(async () => {
    const [catalog, locations, allLocations, page] = await Promise.all([
      loadCatalog(),
      // Solo las activas — son las únicas que tiene sentido ofrecer como
      // destino al reubicar.
      loadLocations(),
      // Sin filtrar: si algo quedó guardado en una ubicación que después
      // se desactivó, su saldo debe poder seguir viéndose con su
      // nombre real, no confundirse con "sin ubicar" (que es otra cosa:
      // nunca tuvo ubicación).
      pb.collection("locations").getFullList<Location>({ sort: "zone" }),
      pb.collection("inventory").getFullList<InventoryRow>({
        filter: "total_qty > 0",
        sort: "-total_qty",
        expand: "product_id,unit_id",
      }),
    ]);
    return { catalog, locations, allLocations, rows: page, version };
  }, [version]);

  const { data, error, reload } = useAsyncData(fetchData);

  const categories = useMemo(() => {
    if (!data || !groupId) return [];
    return data.catalog.categories.filter((c) => c.group_id === groupId);
  }, [data, groupId]);

  const filteredRows = useMemo(() => {
    if (!data) return [];
    const needle = normalize(query.trim());
    const categoryById = new Map(data.catalog.categories.map((c) => [c.id, c]));

    return data.rows.filter((row) => {
      const catId = row.expand?.product_id?.category_id;
      const category = catId ? categoryById.get(catId) : undefined;
      if (groupId && category?.group_id !== groupId) return false;
      if (categoryId && catId !== categoryId) return false;
      if (needle) {
        const name = normalize(row.expand?.product_id?.name ?? "");
        if (!name.includes(needle)) return false;
      }
      return true;
    });
  }, [data, groupId, categoryId, query]);

  const staging = useMemo(
    () => filteredRows.filter((row) => !row.location_id && row.available_qty > 0),
    [filteredRows]
  );

  const byLocation = useMemo(() => {
    if (!data) return [];
    const groups = new Map<string, InventoryRow[]>();
    for (const row of filteredRows) {
      if (!row.location_id) continue;
      if (!groups.has(row.location_id)) groups.set(row.location_id, []);
      groups.get(row.location_id)!.push(row);
    }
    const locationById = new Map(data.allLocations.map((l) => [l.id, l]));
    return Array.from(groups.entries())
      .map(([locationId, rows]) => ({ location: locationById.get(locationId), locationId, rows }))
      .sort((a, b) => locationLabel(a.location).localeCompare(locationLabel(b.location)));
  }, [data, filteredRows]);

  const hasFilters = Boolean(query || groupId || categoryId);

  if (error) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {error}
      </p>
    );
  }

  if (!data) {
    return <LoadingLine />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Inventario</h1>
          <p className="mt-1 text-(--muted)">
            Saldos por producto y ubicación. Se actualizan solos con cada movimiento: no se editan a mano.
          </p>
        </div>
        <Link
          href="/panel/ubicaciones"
          className="flex shrink-0 items-center gap-1.5 rounded border border-(--rule) px-4 py-2.5 font-bold hover:bg-(--surface-2)"
        >
          <MapPin size={16} strokeWidth={2.5} aria-hidden="true" />
          Ubicaciones
        </Link>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        <label className="sr-only" htmlFor="buscar-inv">Buscar producto</label>
        <input
          id="buscar-inv"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar producto…"
          autoComplete="off"
          className="rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
        />
        <label className="sr-only" htmlFor="filtro-grupo">Grupo</label>
        <select
          id="filtro-grupo"
          value={groupId}
          onChange={(e) => { setGroupId(e.target.value); setCategoryId(""); }}
          className="rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
        >
          <option value="">Todos los grupos</option>
          {data.catalog.groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <label className="sr-only" htmlFor="filtro-categoria">Categoría</label>
        <select
          id="filtro-categoria"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          disabled={!groupId}
          className="rounded border border-(--rule) bg-(--surface) px-3 py-2.5 disabled:opacity-50"
        >
          <option value="">Todas las categorías</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {hasFilters ? (
        <div className="mt-2 flex items-center justify-between text-sm text-(--muted)">
          <span>{filteredRows.length} de {data.rows.length} renglones</span>
          <button
            type="button"
            onClick={() => { setQuery(""); setGroupId(""); setCategoryId(""); }}
            className="font-bold text-unal-green-dark hover:underline"
          >
            Quitar filtros
          </button>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">
            {data.rows.length === 0 ? "Todavía no hay nada en bodega." : "Ningún producto coincide con el filtro."}
          </p>
        </div>
      ) : (
        <>
          {staging.length > 0 ? (
            <section className="mt-6 rounded border border-unal-yellow bg-(--surface) p-4">
              <h2 className="text-sm font-bold text-unal-orange">
                Mesa de pendientes — {staging.length} sin ubicación final
              </h2>
              <p className="mt-0.5 text-xs text-(--muted)">
                Ya son aptos para entregar, solo falta decidir dónde se guardan.
              </p>
              <ul className="mt-3 divide-y divide-(--rule)">
                {staging.map((row) => (
                  <ProductRow
                    key={row.id}
                    row={row}
                    onOpen={() => setDetail({ row, location: undefined })}
                    onRelocate={() => setRelocating(row)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-6 space-y-4">
            {byLocation.map(({ location, locationId, rows }) => (
              <section key={locationId} className="rounded border border-(--rule) bg-(--surface) p-4">
                <div className="flex items-center gap-3">
                  {location?.photo_url ? (
                    <Image
                      src={location.photo_url}
                      alt=""
                      width={40}
                      height={40}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded bg-(--surface-2) text-(--muted)">
                      <MapPin size={18} aria-hidden="true" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-sm font-bold">
                      {locationLabel(location)}
                      {location?.active === false ? (
                        <span className="ml-2 rounded bg-(--surface-2) px-1.5 py-0.5 text-xs font-normal text-unal-red">
                          desactivada
                        </span>
                      ) : null}
                    </h2>
                    {location?.description ? (
                      <p className="text-xs text-(--muted)">{location.description}</p>
                    ) : null}
                  </div>
                  <span className="ml-auto text-xs text-(--muted)">{rows.length} productos</span>
                </div>
                <ul className="mt-3 divide-y divide-(--rule)">
                  {rows.map((row) => (
                    <ProductRow
                      key={row.id}
                      row={row}
                      onOpen={() => setDetail({ row, location })}
                      onRelocate={() => setRelocating(row)}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {relocating ? (
        <RelocateDialog
          row={relocating}
          locations={data.locations}
          onCancel={() => setRelocating(null)}
          onDone={() => {
            setRelocating(null);
            setVersion((v) => v + 1);
          }}
        />
      ) : null}

      {detail ? (
        <ProductLocationDetail
          row={detail.row}
          location={detail.location}
          onClose={() => setDetail(null)}
          onChanged={reload}
        />
      ) : null}
    </div>
  );
}

function ProductRow({
  row,
  onOpen,
  onRelocate,
}: {
  row: InventoryRow;
  onOpen: () => void;
  onRelocate: () => void;
}) {
  const unit = row.expand?.unit_id?.code ?? row.expand?.unit_id?.name ?? "";

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-unal-green-dark"
      >
        <span className="min-w-0 truncate font-medium">
          {row.expand?.product_id?.name ?? "—"}
        </span>
        <ArrowRight size={14} className="shrink-0 opacity-50" aria-hidden="true" />
      </button>

      <span className="text-sm tabular-nums font-bold text-unal-green-dark">
        {row.available_qty} <span className="font-normal text-(--muted)">{unit} disp.</span>
      </span>
      {row.reserved_qty > 0 ? (
        <span className="text-sm tabular-nums text-(--muted)">{row.reserved_qty} reserv.</span>
      ) : null}
      {row.quarantine_qty > 0 ? (
        <span className="text-sm tabular-nums text-unal-red">{row.quarantine_qty} cuarent.</span>
      ) : null}

      {row.available_qty > 0 ? (
        <button
          type="button"
          onClick={onRelocate}
          className="rounded border border-(--rule) px-2.5 py-1 text-xs font-bold hover:bg-(--surface-2)"
        >
          Reubicar
        </button>
      ) : null}
    </li>
  );
}

function RelocateDialog({
  row,
  locations,
  onCancel,
  onDone,
}: {
  row: InventoryRow;
  locations: Location[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const [locationId, setLocationId] = useState("");
  const [quantity, setQuantity] = useState(row.available_qty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function relocate() {
    setError(null);

    if (!(quantity > 0) || quantity > row.available_qty) {
      setError(`La cantidad debe estar entre 1 y ${row.available_qty}.`);
      return;
    }
    if (locationId === row.location_id) {
      setError("Elige una ubicación distinta de la actual.");
      return;
    }

    setSaving(true);
    try {
      await callRoute(`/api/inventory/${row.id}/relocate`, {
        method: "POST",
        body: { location_id: locationId, quantity },
      });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-lg bg-(--surface) p-5 sm:max-w-md sm:rounded-lg">
        <h2 className="text-lg font-bold">Reubicar {row.expand?.product_id?.name}</h2>
        <p className="text-sm text-(--muted)">
          Actualmente en {row.location_id ? "una ubicación" : "la mesa de pendientes"} · {row.available_qty} disponible
        </p>

        <div className="mt-4">
          <label htmlFor="reloc-cant" className="mb-1 block text-sm font-bold">Cantidad</label>
          <input
            id="reloc-cant"
            type="number"
            min={0.01}
            max={row.available_qty}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-sm font-bold">Ubicación destino</span>
          <LocationPicker
            locations={locations}
            value={locationId}
            onChange={setLocationId}
            currentLocationId={row.location_id}
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface-2) px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} className="rounded border border-(--rule) px-4 py-3 font-bold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={relocate}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-unal-green-dark px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? <Spinner /> : null}
            {saving ? "Moviendo…" : "Reubicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface DonationItemRow {
  id: string;
  donation_id: string;
  quantity: number;
  classification_status: "pending" | "available" | "quarantine" | "rejected";
  expiry_date: string;
  batch_code: string;
  expand?: {
    donation_id?: { code?: string };
    unit_id?: { code?: string; name?: string };
  };
}

const STATUS_LABELS: Record<DonationItemRow["classification_status"], string> = {
  pending: "Por clasificar",
  available: "Apto",
  quarantine: "Cuarentena",
  rejected: "Rechazado",
};

/*
 * Un renglón de inventario (producto + ubicación) puede sumar varias
 * donaciones distintas, cada una con su propio vencimiento o lote — así
 * que en vez de redirigir a ciegas a "la" donación, este panel lista
 * las remesas que de verdad componen el saldo, cada una con su enlace y
 * sus propios botones de apto/cuarentena.
 */
function ProductLocationDetail({
  row,
  location,
  onClose,
  onChanged,
}: {
  row: InventoryRow;
  location?: Location;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    const locationFilter = row.location_id
      ? `location_id = "${row.location_id}"`
      : `location_id = ""`;
    const page = await pb.collection("donation_items").getList<DonationItemRow>(1, 100, {
      filter: `product_id = "${row.product_id}" && ${locationFilter} && (classification_status = "available" || classification_status = "quarantine")`,
      sort: "-created",
      expand: "donation_id,unit_id",
    });
    return page.items;
  }, [row.product_id, row.location_id, version]);

  const { data: items, error: loadError } = useAsyncData(fetchItems);

  async function toggle(item: DonationItemRow) {
    const newStatus = item.classification_status === "quarantine" ? "available" : "quarantine";
    setBusy(item.id);
    setError(null);
    try {
      await pb.collection("donation_items").update(item.id, { classification_status: newStatus });
      setVersion((v) => v + 1);
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-lg bg-(--surface) p-5 sm:max-w-lg sm:rounded-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">{row.expand?.product_id?.name}</h2>
            <p className="text-sm text-(--muted)">{locationLabel(location)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-sm font-bold text-(--muted) hover:text-(--ink)">
            Cerrar
          </button>
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface-2) px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}
        {loadError ? (
          <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface-2) px-4 py-3 text-sm">
            {loadError}
          </p>
        ) : null}

        {!items ? (
          <div className="mt-4"><LoadingLine /></div>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-(--muted)">
            No quedan remesas con saldo aquí — puede que ya se hayan movido o entregado.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {items.map((item) => (
              <li key={item.id} className="rounded border border-(--rule) p-3">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <Link
                    href={`/panel/donaciones/${item.donation_id}`}
                    className="font-bold text-unal-green-dark hover:underline"
                  >
                    {item.expand?.donation_id?.code ?? "Ver remesa"}
                  </Link>
                  <span className="text-(--muted)">
                    {item.quantity} {item.expand?.unit_id?.code ?? item.expand?.unit_id?.name ?? ""}
                  </span>
                  <span
                    className={`ml-auto rounded px-2 py-0.5 text-xs font-bold ${
                      item.classification_status === "quarantine"
                        ? "bg-(--surface-2) text-unal-orange"
                        : "bg-unal-green-soft text-unal-green-dark"
                    }`}
                  >
                    {STATUS_LABELS[item.classification_status]}
                  </span>
                </div>

                {item.expiry_date || item.batch_code ? (
                  <p className="mt-1 text-xs text-(--muted)">
                    {item.expiry_date ? `Vence ${new Date(item.expiry_date).toLocaleDateString("es-CO")}` : ""}
                    {item.expiry_date && item.batch_code ? " · " : ""}
                    {item.batch_code ? `Lote ${item.batch_code}` : ""}
                  </p>
                ) : null}

                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => toggle(item)}
                  className={
                    item.classification_status === "quarantine"
                      ? "mt-2 flex items-center gap-2 rounded bg-unal-green-dark px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      : "mt-2 flex items-center gap-2 rounded border border-unal-orange px-3 py-1.5 text-xs font-bold text-unal-orange disabled:opacity-50"
                  }
                >
                  {busy === item.id ? <Spinner /> : null}
                  {item.classification_status === "quarantine" ? "Liberar a disponible" : "Enviar a cuarentena"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
