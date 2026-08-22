"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRight, Ban, CheckCircle, MapPin, Warehouse } from "lucide-react";
import { callRoute, currentUser, errorMessage, pb } from "@/lib/pb";
import { hasAnyRole } from "@/lib/roles";
import { loadCatalog, normalize } from "@/lib/catalog";
import { loadLocations, locationLabel, type Location } from "@/lib/locations";
import { useAsyncData } from "@/lib/use-async-data";
import { formatQuantity } from "@/lib/format";
import { LoadingLine } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";
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
    product_id?: { name?: string; category_id?: string; photo_url?: string };
    unit_id?: { code?: string; name?: string };
  };
}

interface RejectionMovement {
  id: string;
  quantity: number;
  notes: string;
  created: string;
  expand?: {
    product_id?: { name?: string; photo_url?: string };
    unit_id?: { code?: string; name?: string };
  };
}

// Mismo patrón que ya usa la foto de ubicación en esta pantalla: miniatura
// si hay `photo_url`, si no una inicial de color determinística por
// nombre — nunca un ícono genérico, para que la lista se reconozca de un
// vistazo igual que el explorador de catálogo (`PhotoTile`).
const THUMB_PALETTE = [
  "bg-unal-green-soft text-unal-green-dark",
  "bg-unal-aqua/15 text-unal-aqua",
  "bg-unal-orange/15 text-unal-orange",
  "bg-unal-yellow/20 text-[#8a6d00]",
  "bg-unal-red/10 text-unal-red",
];

function thumbColorFor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return THUMB_PALETTE[hash % THUMB_PALETTE.length];
}

function ProductThumb({ name, photoUrl, size = 40 }: { name: string; photoUrl?: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="shrink-0 overflow-hidden rounded-lg border border-(--rule) bg-(--surface)"
    >
      {photoUrl ? (
        <Image
          src={photoUrl}
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center font-black ${thumbColorFor(name)}`}
          style={{ fontSize: size * 0.4 }}
          aria-hidden="true"
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

/*
 * El inventario se organiza por ubicación, no en una tabla plana: es la
 * pregunta que se hace de pie en la bodega ("¿qué hay aquí?"), no
 * "¿dónde está el arroz?" — para eso ya está el buscador. La "mesa de
 * pendientes" (renglones con `location_id` vacío) va primero porque es
 * lo que necesita una decisión hoy; el resto ya está resuelto.
 */
export default function InventarioPage() {
  const operator = currentUser();
  // Reubicar y rechazar van por rutas propias del backend, restringidas
  // a admin/coordinación (ver /api/inventory/{id}/relocate y /reject).
  // "Liberar a disponible" en cambio actualiza `donation_items`
  // directamente, cuya regla también deja pasar al voluntariado dueño
  // de la remesa — se ofrece el botón igual, y si la remesa no es suya
  // el backend lo rechaza con un mensaje claro.
  const canManageInventory = hasAnyRole(operator?.role, ["admin", "coordinacion"]);
  const canReleaseQuarantine = hasAnyRole(operator?.role, ["admin", "coordinacion", "voluntariado"]);

  const [version, setVersion] = useState(0);
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [relocating, setRelocating] = useState<InventoryRow | null>(null);
  const [rejecting, setRejecting] = useState<InventoryRow | null>(null);
  const [detail, setDetail] = useState<{ row: InventoryRow; location?: Location } | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);

  // Libera TODA la cuarentena del renglón de una vez, reutilizando la
  // misma actualización que ya usa el panel de detalle por remesa
  // (`donation_items.classification_status`) — solo que aquí se aplica
  // a todas las remesas retenidas de este producto+ubicación, no a una
  // por una. El destino sale solo: si la remesa no tenía ubicación,
  // "liberar" la deja en `available_qty` sin ubicar — es decir, en Por
  // Ubicar — que es justo lo que ya pasa hoy con estos renglones.
  async function releaseRow(row: InventoryRow) {
    setReleasingId(row.id);
    setRevisionError(null);
    try {
      const locationFilter = row.location_id
        ? `location_id = "${row.location_id}"`
        : `location_id = ""`;
      const items = await pb.collection("donation_items").getFullList<{ id: string; quantity: number }>({
        filter: `product_id = "${row.product_id}" && ${locationFilter} && classification_status = "quarantine"`,
      });

      // Rechazar es una salida a nivel de `inventory` que a propósito no
      // toca `donation_items` (ver utils/helpers.js#rejectQuarantine en
      // el backend) — así que un rechazo parcial puede dejar la suma de
      // las remesas por encima de lo que de verdad queda en revisión.
      // Sin saber cuál remesa cargó con el rechazo, liberarlas todas a
      // ciegas fallaría con un error de saldo que no explica qué hacer;
      // mejor remitir al panel que sí distingue remesa por remesa.
      const itemsTotal = items.reduce((sum, item) => sum + item.quantity, 0);
      if (itemsTotal > row.quarantine_qty) {
        setRevisionError(
          "Las remesas de este renglón suman más de lo que queda en revisión — probablemente porque ya se rechazó parte por separado. Abre el producto y libera remesa por remesa desde ahí."
        );
        return;
      }

      for (const item of items) {
        await pb.collection("donation_items").update(item.id, { classification_status: "available" });
      }
    } catch (err) {
      setRevisionError(errorMessage(err));
    } finally {
      setReleasingId(null);
      setVersion((v) => v + 1);
    }
  }

  const fetchData = useCallback(async () => {
    const [catalog, locations, allLocations, page, rejections] = await Promise.all([
      loadCatalog(),
      // Solo las activas — son las únicas que tiene sentido ofrecer como
      // destino al reubicar.
      loadLocations(),
      // Sin filtrar: si algo quedó guardado en una ubicación que después
      // se desactivó, su saldo debe poder seguir viéndose con su
      // nombre real, no confundirse con "Por Ubicar" (que es otra cosa:
      // nunca tuvo ubicación).
      pb.collection("locations").getFullList<Location>({ sort: "zone" }),
      pb.collection("inventory").getFullList<InventoryRow>({
        filter: "total_qty > 0",
        sort: "-total_qty",
        expand: "product_id,unit_id",
      }),
      // "Rechazados" no es una ubicación con saldo — es una salida
      // definitiva (decisión explícita de Juan Manuel), así que lo que
      // hay para ver aquí es el registro de qué se rechazó, no un
      // stock. Se lee directo del libro (`inventory_movements`), igual
      // que ya hace Historial con `audit_log`.
      pb.collection("inventory_movements").getList<RejectionMovement>(1, 50, {
        filter: 'movement_type = "rechazo"',
        sort: "-created",
        expand: "product_id,unit_id",
      }),
    ]);
    return { catalog, locations, allLocations, rows: page, rejections: rejections.items, version };
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

  // En Revisión no es una ubicación real — es un estado que puede coexistir
  // con cualquier renglón, tenga o no ubicación asignada. Por eso la lista
  // no se resta de `byLocation`: el mismo producto puede aparecer ahí (por
  // su parte disponible) y aquí (por su parte retenida) a la vez.
  const inRevision = useMemo(
    () => filteredRows.filter((row) => row.quarantine_qty > 0),
    [filteredRows]
  );

  const locationById = useMemo(
    () => new Map((data?.allLocations ?? []).map((l) => [l.id, l])),
    [data]
  );

  const byLocation = useMemo(() => {
    if (!data) return [];
    const groups = new Map<string, InventoryRow[]>();
    for (const row of filteredRows) {
      if (!row.location_id) continue;
      if (!groups.has(row.location_id)) groups.set(row.location_id, []);
      groups.get(row.location_id)!.push(row);
    }
    return Array.from(groups.entries())
      .map(([locationId, rows]) => ({ location: locationById.get(locationId), locationId, rows }))
      .sort((a, b) => locationLabel(a.location).localeCompare(locationLabel(b.location)));
  }, [data, filteredRows, locationById]);

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
          <Warehouse size={16} strokeWidth={2.5} aria-hidden="true" />
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
            <section id="por-ubicar" className="mt-6 rounded border border-unal-yellow bg-(--surface) p-4">
              <h2 className="text-sm font-bold text-unal-orange">
                Por Ubicar — {staging.length} sin ubicación final
              </h2>
              <p className="mt-0.5 text-xs text-(--muted)">
                Ya son aptos para entregar, solo falta decidir dónde se guardan.
              </p>
              <ul className="mt-3 divide-y divide-(--rule)">
                {staging.map((row) => (
                  <ProductRow
                    key={row.id}
                    row={row}
                    canRelocate={canManageInventory}
                    onOpen={() => setDetail({ row, location: undefined })}
                    onRelocate={() => setRelocating(row)}
                  />
                ))}
              </ul>
            </section>
          ) : null}

          {inRevision.length > 0 ? (
            <section id="en-revision" className="mt-6 rounded border border-unal-red bg-(--surface) p-4">
              <h2 className="text-sm font-bold text-unal-red">
                En Revisión — {inRevision.length} en espera
              </h2>
              <p className="mt-0.5 text-xs text-(--muted)">
                Retenidos hasta que se decida si pasan a disponible o se rechazan. No se pueden reservar mientras estén aquí.
              </p>
              {revisionError ? (
                <p role="alert" className="mt-2 text-sm text-unal-red">{revisionError}</p>
              ) : null}
              <ul className="mt-3 divide-y divide-(--rule)">
                {inRevision.map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                    <button
                      type="button"
                      onClick={() => setDetail({ row, location: locationById.get(row.location_id) })}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <ProductThumb
                        name={row.expand?.product_id?.name ?? "—"}
                        photoUrl={row.expand?.product_id?.photo_url}
                      />
                      <span className="min-w-0">
                        <span className="font-bold">{row.expand?.product_id?.name ?? "—"}</span>
                        <span className="ml-2 text-sm text-unal-red">
                          {formatQuantity(row.quarantine_qty)} {row.expand?.unit_id?.code ?? row.expand?.unit_id?.name ?? ""}
                        </span>
                        <span className="block text-xs text-(--muted)">
                          {locationLabel(locationById.get(row.location_id))}
                        </span>
                      </span>
                    </button>
                    {canReleaseQuarantine ? (
                      <Button
                        size="sm"
                        disabled={releasingId === row.id}
                        loading={releasingId === row.id}
                        onClick={() => releaseRow(row)}
                        icon={CheckCircle}
                      >
                        Liberar a disponible
                      </Button>
                    ) : null}
                    {canManageInventory ? (
                      <Button variant="danger" size="sm" onClick={() => setRejecting(row)} icon={Ban}>
                        Rechazar
                      </Button>
                    ) : null}
                  </li>
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
                      canRelocate={canManageInventory}
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

      {data.rejections.length > 0 ? (
        // Fuera del bloque que depende de `filteredRows`: los filtros de
        // arriba (grupo, categoría, búsqueda) son para el catálogo que
        // hay que ubicar, no para un libro de qué ya se descartó. Va al
        // final a propósito — es lo último que alguien necesita ver de
        // pie en la bodega.
        <section id="rechazados" className="mt-6 rounded border border-(--rule) bg-(--surface) p-4">
          <h2 className="text-sm font-bold text-(--ink-2)">Rechazados</h2>
          <p className="mt-0.5 text-xs text-(--muted)">
            Salió del inventario tras la revisión — no es un saldo, es el registro de qué se
            descartó y por qué.
          </p>
          <ul className="mt-3 divide-y divide-(--rule)">
            {data.rejections.map((movement) => (
              <li key={movement.id} className="flex items-start gap-3 py-2.5">
                <ProductThumb
                  name={movement.expand?.product_id?.name ?? "—"}
                  photoUrl={movement.expand?.product_id?.photo_url}
                  size={32}
                />
                <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{movement.expand?.product_id?.name ?? "—"}</span>
                  <span className="text-sm text-(--muted)">
                    {formatQuantity(movement.quantity)} {movement.expand?.unit_id?.code ?? movement.expand?.unit_id?.name ?? ""}
                  </span>
                  <span className="ml-auto text-xs text-(--muted)">
                    {new Date(movement.created).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {movement.notes ? (
                  <p className="mt-0.5 text-xs text-(--muted)">{movement.notes}</p>
                ) : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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

      {rejecting ? (
        <RejectDialog
          row={rejecting}
          onCancel={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            setVersion((v) => v + 1);
          }}
        />
      ) : null}

      {detail ? (
        <ProductLocationDetail
          row={detail.row}
          location={detail.location}
          canToggle={canReleaseQuarantine}
          canAdjust={canManageInventory}
          onClose={() => setDetail(null)}
          onChanged={reload}
        />
      ) : null}
    </div>
  );
}

function ProductRow({
  row,
  canRelocate,
  onOpen,
  onRelocate,
}: {
  row: InventoryRow;
  canRelocate: boolean;
  onOpen: () => void;
  onRelocate: () => void;
}) {
  const unit = row.expand?.unit_id?.code ?? row.expand?.unit_id?.name ?? "";
  const productName = row.expand?.product_id?.name ?? "—";

  return (
    <li className="flex flex-wrap items-center gap-3 py-2.5">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left hover:text-unal-green-dark"
      >
        <ProductThumb name={productName} photoUrl={row.expand?.product_id?.photo_url} />
        <span className="min-w-0 truncate font-medium">{productName}</span>
        <ArrowRight size={14} className="shrink-0 opacity-50" aria-hidden="true" />
      </button>

      <span className="text-sm tabular-nums font-bold text-unal-green-dark">
        {formatQuantity(row.available_qty)} <span className="font-normal text-(--muted)">{unit} disp.</span>
      </span>
      {row.reserved_qty > 0 ? (
        <span className="text-sm tabular-nums text-(--muted)">{formatQuantity(row.reserved_qty)} reserv.</span>
      ) : null}
      {row.quarantine_qty > 0 ? (
        <span className="text-sm tabular-nums text-unal-red">{formatQuantity(row.quarantine_qty)} cuarent.</span>
      ) : null}

      {row.available_qty > 0 && canRelocate ? (
        <Button variant="outline" size="sm" onClick={onRelocate} icon={MapPin}>
          Reubicar
        </Button>
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
      setError(`La cantidad debe estar entre 1 y ${formatQuantity(row.available_qty)}.`);
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
          Actualmente en {row.location_id ? "una ubicación" : "Por Ubicar"} · {formatQuantity(row.available_qty)} disponible
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
          <Button variant="outline" onClick={onCancel} className="justify-center">
            Cancelar
          </Button>
          <Button
            disabled={saving}
            loading={saving}
            onClick={relocate}
            icon={MapPin}
            className="flex-1 justify-center"
          >
            {saving ? "Moviendo…" : "Reubicar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Salida definitiva, sin donation_item de por medio (ver
// utils/helpers.js#rejectQuarantine en el backend) — por eso pide un
// motivo: es lo único que va a quedar para explicar después por qué
// bajó ese saldo, ya que no hay ningún "deshacer".
function RejectDialog({
  row,
  onCancel,
  onDone,
}: {
  row: InventoryRow;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [quantity, setQuantity] = useState(row.quarantine_qty);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reject() {
    setError(null);

    if (!(quantity > 0) || quantity > row.quarantine_qty) {
      setError(`La cantidad debe estar entre 1 y ${formatQuantity(row.quarantine_qty)}.`);
      return;
    }
    if (!reason.trim()) {
      setError("Escribe el motivo del rechazo.");
      return;
    }

    setSaving(true);
    try {
      await callRoute(`/api/inventory/${row.id}/reject`, {
        method: "POST",
        body: { quantity, notes: reason },
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
      <div className="w-full rounded-t-lg bg-(--surface) p-5 sm:max-w-sm sm:rounded-lg">
        <h2 className="text-lg font-bold">Rechazar {row.expand?.product_id?.name}</h2>
        <p className="text-sm text-(--muted)">
          {formatQuantity(row.quarantine_qty)} en revisión · esto da de baja el inventario, no tiene deshacer
        </p>

        <div className="mt-4">
          <label htmlFor="reject-cant" className="mb-1 block text-sm font-bold">Cantidad</label>
          <input
            id="reject-cant"
            type="number"
            min={0.01}
            max={row.quarantine_qty}
            step="any"
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
        </div>

        <div className="mt-4">
          <label htmlFor="reject-motivo" className="mb-1 block text-sm font-bold">
            Motivo <span className="text-unal-red">*</span>
          </label>
          <input
            id="reject-motivo"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej.: vencido, dañado, no apto para consumo"
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
        </div>

        {error ? (
          <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface-2) px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <Button variant="outline" onClick={onCancel} className="justify-center">
            Cancelar
          </Button>
          <Button
            variant="danger-solid"
            disabled={saving}
            loading={saving}
            onClick={reject}
            icon={Ban}
            className="flex-1 justify-center"
          >
            {saving ? "Rechazando…" : "Confirmar rechazo"}
          </Button>
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
  quarantine: "En Revisión",
  rejected: "Rechazado",
};

/*
 * Un renglón de inventario (producto + ubicación) puede sumar varias
 * donaciones distintas, cada una con su propio vencimiento o lote — así
 * que en vez de redirigir a ciegas a "la" donación, este panel lista
 * las remesas que de verdad componen el saldo, cada una con su enlace y
 * sus propios botones de apto/en revisión.
 */
function ProductLocationDetail({
  row,
  location,
  canToggle,
  canAdjust,
  onClose,
  onChanged,
}: {
  row: InventoryRow;
  location?: Location;
  canToggle: boolean;
  canAdjust: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const operator = currentUser();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [newQuantity, setNewQuantity] = useState(row.available_qty);
  const [adjustReason, setAdjustReason] = useState("");
  const [savingAdjust, setSavingAdjust] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  async function saveAdjustment() {
    if (!operator) return;
    if (adjustReason.trim().length < 5) {
      setAdjustError("Escribe un motivo (mínimo 5 caracteres).");
      return;
    }
    if (newQuantity === row.available_qty) {
      setAdjustError("La cantidad nueva es igual a la actual — no hay nada que ajustar.");
      return;
    }

    setSavingAdjust(true);
    setAdjustError(null);
    try {
      await pb.collection("adjustments").create({
        inventory_id: row.id,
        product_id: row.product_id,
        location_id: row.location_id || null,
        quantity_before: row.available_qty,
        quantity_after: newQuantity,
        reason: adjustReason,
        operator_id: operator.id,
      });
      setAdjusting(false);
      onChanged();
      onClose();
    } catch (err) {
      setAdjustError(errorMessage(err));
    } finally {
      setSavingAdjust(false);
    }
  }

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
          <div className="flex min-w-0 items-center gap-3">
            <ProductThumb
              name={row.expand?.product_id?.name ?? "—"}
              photoUrl={row.expand?.product_id?.photo_url}
              size={48}
            />
            <div className="min-w-0">
              <h2 className="text-lg font-bold">{row.expand?.product_id?.name}</h2>
              <p className="text-sm text-(--muted)">{locationLabel(location)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 text-sm font-bold text-(--muted) hover:text-(--ink)">
            Cerrar
          </button>
        </div>

        {canAdjust ? (
          <div className="mt-3">
            {!adjusting ? (
              <Button variant="outline" size="sm" onClick={() => setAdjusting(true)}>
                Ajustar cantidad disponible
              </Button>
            ) : (
              <div className="rounded border border-(--rule) p-3">
                <p className="text-sm">
                  Disponible ahora: <strong>{formatQuantity(row.available_qty)}</strong>
                </p>
                <label htmlFor="ajuste-cant" className="mb-1 mt-2 block text-sm font-bold">
                  Cantidad correcta
                </label>
                <DecimalInput
                  id="ajuste-cant"
                  value={newQuantity}
                  onChange={setNewQuantity}
                  className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                />
                <label htmlFor="ajuste-motivo" className="mb-1 mt-2 block text-sm font-bold">
                  Motivo <span className="text-unal-red">*</span>
                </label>
                <textarea
                  id="ajuste-motivo"
                  value={adjustReason}
                  onChange={(event) => setAdjustReason(event.target.value)}
                  rows={2}
                  placeholder="Ej.: conteo físico no coincidía"
                  className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                />
                {adjustError ? (
                  <p className="mt-2 text-sm text-unal-red">{adjustError}</p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjusting(false)}
                    className="rounded border border-(--rule) px-3 py-2 text-sm font-bold"
                  >
                    Cancelar
                  </button>
                  <Button
                    size="sm"
                    disabled={savingAdjust}
                    loading={savingAdjust}
                    onClick={saveAdjustment}
                    className="flex-1 justify-center"
                  >
                    Guardar ajuste
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}

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
                    {formatQuantity(item.quantity)} {item.expand?.unit_id?.code ?? item.expand?.unit_id?.name ?? ""}
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

                {canToggle ? (
                  <Button
                    size="sm"
                    variant={item.classification_status === "quarantine" ? "primary" : "outline"}
                    disabled={busy === item.id}
                    loading={busy === item.id}
                    onClick={() => toggle(item)}
                    icon={item.classification_status === "quarantine" ? CheckCircle : AlertTriangle}
                    className="mt-2"
                  >
                    {item.classification_status === "quarantine" ? "Liberar a disponible" : "Enviar a revisión"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
