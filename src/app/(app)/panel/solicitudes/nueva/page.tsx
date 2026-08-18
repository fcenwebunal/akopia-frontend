"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { callRoute, currentUser, errorMessage, pb } from "@/lib/pb";
import { loadCatalog, unitLabel, type Catalog, type Product } from "@/lib/catalog";
import { useAsyncData } from "@/lib/use-async-data";
import { ProductPicker } from "@/components/app/product-picker";
import { LoadingLine, Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { MANIZALES_CENTER, formatCoordinates } from "@/lib/coordinates";
import { Minus, Plus } from "lucide-react";

// Leaflet toca `window` al cargarse: sin `ssr: false` el render en
// servidor de esta página truena.
const MapPicker = dynamic(
  () => import("@/components/app/map-picker").then((m) => m.MapPicker),
  { ssr: false, loading: () => <div className="h-64 w-full rounded border border-(--rule) bg-(--surface-2)" /> }
);

interface InventorySummaryRow {
  product_id: string;
  available_qty: number;
}

const PRIORITIES = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

interface DraftLine {
  key: string;
  product: Product;
  quantity: number;
}

/*
 * Igual patrón que la recepción de donaciones: borrador local, se envía
 * entero al final. Aquí el renglón es más simple — solo producto y
 * cantidad, sin vencimiento ni lote — porque request_items no lleva esos
 * campos.
 */
export default function NuevaSolicitudPage() {
  const router = useRouter();
  const operator = currentUser();

  const fetchCatalog = useCallback(async () => {
    const [catalog, summary] = await Promise.all([
      loadCatalog(),
      // Disponible ya excluye lo reservado y lo retenido en revisión —
      // son cubetas separadas de `available_qty`, ver inventory/summary
      // en el backend. No hace falta recalcular nada aquí.
      callRoute<{ summary: InventorySummaryRow[] }>("/api/inventory/summary"),
    ]);
    const stockByProduct: Record<string, number> = {};
    for (const row of summary.summary) {
      stockByProduct[row.product_id] = row.available_qty;
    }
    return { catalog, stockByProduct };
  }, []);
  const { data, error: catalogError } = useAsyncData(fetchCatalog);
  const catalog = data?.catalog ?? null;
  const stockByProduct = data?.stockByProduct ?? {};

  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requesterInstitution, setRequesterInstitution] = useState("");
  const [destination, setDestination] = useState("");
  const [beneficiaryCount, setBeneficiaryCount] = useState("");
  const [priority, setPriority] = useState("media");
  const [notes, setNotes] = useState("");
  const [lat, setLat] = useState(MANIZALES_CENTER[0]);
  const [lng, setLng] = useState(MANIZALES_CENTER[1]);

  const [onlyAvailable, setOnlyAvailable] = useState(true);
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Con el switch activado, solo se puede elegir (y pedir) lo que de
  // verdad hay en bodega — filtrar el catálogo aquí es más simple que
  // enseñarle a ProductPicker (compartido con Donaciones, donde este
  // filtro no aplica) a saber de existencias.
  //
  // No basta con filtrar `products`: ProductPicker explora por
  // grupo → categoría → producto, y sus grillas de grupo/categoría se
  // arman a partir de `catalog.categories`/`catalog.groups`, no de
  // `products`. Dejar esas dos listas completas mostraba grupos y
  // categorías enteras cuyo único contenido ya estaba agotado — el
  // clic no fallaba, pero prometía algo que el filtro ya había
  // descartado. Podar categorías y grupos en cascada, junto con los
  // productos, es lo que evita esa promesa vacía.
  const pickerCatalog = useMemo<Catalog | null>(() => {
    if (!catalog) return null;
    if (!onlyAvailable) return catalog;

    const products = catalog.products.filter((product) => (stockByProduct[product.id] ?? 0) > 0);
    const categoryIdsWithStock = new Set(products.map((product) => product.category_id));
    const categories = catalog.categories.filter((category) => categoryIdsWithStock.has(category.id));
    const groupIdsWithStock = new Set(categories.map((category) => category.group_id));
    const groups = catalog.groups.filter((group) => groupIdsWithStock.has(group.id));

    return { ...catalog, groups, categories, products };
  }, [catalog, onlyAvailable, stockByProduct]);

  function maxFor(productId: string): number | undefined {
    return onlyAvailable ? stockByProduct[productId] ?? 0 : undefined;
  }

  const recent = lines
    .map((line) => line.product)
    .filter(
      (product, index, all) =>
        all.findIndex((other) => other.id === product.id) === index
    )
    .slice(0, 8);

  function addProduct(product: Product) {
    const existing = lines.find((line) => line.product.id === product.id);
    if (existing) {
      const max = maxFor(product.id);
      if (max !== undefined && existing.quantity >= max) {
        // Ya está en el tope de lo disponible: un toque más no suma
        // nada, en vez de pedir más de lo que hay en bodega.
        return;
      }
      setLines((current) =>
        current.map((line) =>
          line.key === existing.key
            ? { ...line, quantity: max !== undefined ? Math.min(max, line.quantity + 1) : line.quantity + 1 }
            : line
        )
      );
      return;
    }
    setPendingProduct(product);
  }

  function confirmQuantity(quantity: number) {
    if (!pendingProduct || quantity <= 0) {
      setPendingProduct(null);
      return;
    }
    setLines((current) => [
      ...current,
      { key: crypto.randomUUID(), product: pendingProduct, quantity },
    ]);
    setPendingProduct(null);
  }

  async function save() {
    if (!operator) {
      setError("Tu sesión expiró. Vuelve a entrar.");
      return;
    }
    if (!requesterName.trim() || !destination.trim()) {
      setError("Nombre del solicitante y destino son obligatorios.");
      return;
    }
    if (lines.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const request = await pb.collection("requests").create({
        requester_name: requesterName,
        requester_phone: requesterPhone,
        requester_institution: requesterInstitution,
        destination,
        destination_lat: lat,
        destination_lng: lng,
        beneficiary_count: beneficiaryCount ? Number(beneficiaryCount) : null,
        priority,
        status: "pendiente",
        operator_id: operator.id,
        notes,
      });

      for (const line of lines) {
        await pb.collection("request_items").create({
          request_id: request.id,
          product_id: line.product.id,
          unit_id: line.product.default_unit_id,
          quantity_requested: line.quantity,
          status: "pendiente",
        });
      }

      router.push(`/panel/solicitudes/${request.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (catalogError) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {catalogError}
      </p>
    );
  }

  if (!catalog) {
    return <LoadingLine label="Cargando catálogo…" />;
  }

  return (
    <div className="pb-28">
      <Link href="/panel/solicitudes" className="text-sm font-bold text-unal-green-dark">
        ← Solicitudes
      </Link>

      <h1 className="mt-2 text-2xl font-black tracking-tight">Registrar solicitud</h1>

      <section className="mt-5 rounded border border-(--rule) bg-(--surface) p-4">
        <h2 className="mb-3 text-sm font-bold">Quién solicita</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="nombre" className="mb-1 block text-sm font-bold">
              Nombre <span className="text-unal-red">*</span>
            </label>
            <input
              id="nombre"
              value={requesterName}
              onChange={(event) => setRequesterName(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="tel" className="mb-1 block text-sm font-bold">
              Teléfono
            </label>
            <input
              id="tel"
              type="tel"
              inputMode="tel"
              value={requesterPhone}
              onChange={(event) => setRequesterPhone(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="inst" className="mb-1 block text-sm font-bold">
              Institución <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="inst"
              value={requesterInstitution}
              onChange={(event) => setRequesterInstitution(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="benef" className="mb-1 block text-sm font-bold">
              Personas beneficiadas <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="benef"
              type="number"
              inputMode="numeric"
              min={1}
              value={beneficiaryCount}
              onChange={(event) => setBeneficiaryCount(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="destino" className="mb-1 block text-sm font-bold">
              Destino <span className="text-unal-red">*</span>
            </label>
            <input
              id="destino"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Barrio, vereda o dirección"
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div className="sm:col-span-2">
            <span className="mb-1 block text-sm font-bold">Ubicación en el mapa</span>
            <p className="mb-2 text-xs text-(--muted)">
              Arrastra el punto verde (o toca el mapa) hasta la dirección exacta. El
              despacho parte de aquí — se puede ajustar después si hace falta.
            </p>
            <MapPicker lat={lat} lng={lng} onChange={(newLat, newLng) => { setLat(newLat); setLng(newLng); }} />
            <p className="mt-1.5 font-mono text-xs text-(--muted)">
              {formatCoordinates(lat, lng)}
            </p>
          </div>

          <div>
            <label htmlFor="prioridad" className="mb-1 block text-sm font-bold">
              Prioridad
            </label>
            <select
              id="prioridad"
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              {PRIORITIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="notas" className="mb-1 block text-sm font-bold">
              Notas <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="notas"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
        <h2 className="mb-3 text-sm font-bold">Qué se pide</h2>
        <div className="mb-3">
          <Toggle
            label="Mostrar solo productos disponibles"
            checked={onlyAvailable}
            onChange={setOnlyAvailable}
          />
          {!onlyAvailable ? (
            <p className="mt-1.5 text-xs text-(--muted)">
              También se muestra lo que está en cero — útil para dejar registrada
              una demanda que hoy no se puede cubrir.
            </p>
          ) : null}
        </div>
        <ProductPicker catalog={pickerCatalog ?? catalog} recent={recent} onSelect={addProduct} />
      </section>

      {lines.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-bold">
            Renglones{" "}
            <span className="ml-1 rounded bg-unal-green-soft px-2 py-0.5 text-unal-green-dark">
              {lines.length}
            </span>
          </h2>
          <ul className="divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
            {lines.map((line) => (
              <li key={line.key} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{line.product.name}</p>
                  <p className="text-sm text-(--muted)">
                    {line.quantity} {unitLabel(catalog, line.product.default_unit_id)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingProduct(line.product)}
                  className="rounded border border-(--rule) px-3 py-1.5 text-sm font-bold"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLines((current) =>
                      current.filter((item) => item.key !== line.key)
                    )
                  }
                  aria-label={`Quitar ${line.product.name}`}
                  className="rounded border border-(--rule) px-3 py-1.5 text-sm font-bold text-unal-red"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 border-t border-(--rule) bg-(--surface) p-4">
        <div className="mx-auto flex max-w-5xl gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded border border-(--rule) px-4 py-3 font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || lines.length === 0}
            className="flex-1 rounded bg-unal-green-dark px-6 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? (
              <>
                <Spinner className="mr-2" />
                Guardando…
              </>
            ) : (
              `Guardar solicitud (${lines.length})`
            )}
          </button>
        </div>
      </div>

      {pendingProduct ? (
        <QuantityPrompt
          catalog={catalog}
          product={pendingProduct}
          max={maxFor(pendingProduct.id)}
          available={stockByProduct[pendingProduct.id] ?? 0}
          initial={(() => {
            const current = lines.find((line) => line.product.id === pendingProduct.id)?.quantity ?? 1;
            const max = maxFor(pendingProduct.id);
            return max !== undefined ? Math.min(current, Math.max(max, 0.01)) : current;
          })()}
          onCancel={() => setPendingProduct(null)}
          onConfirm={confirmQuantity}
        />
      ) : null}
    </div>
  );
}

function QuantityPrompt({
  catalog,
  product,
  initial,
  max,
  available,
  onCancel,
  onConfirm,
}: {
  catalog: Catalog;
  product: Product;
  initial: number;
  max?: number;
  available: number;
  onCancel: () => void;
  onConfirm: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(initial);
  const exceedsMax = max !== undefined && quantity > max;
  // Con el switch apagado no hay tope (`max` viene vacío) — pedir de más
  // sigue siendo válido, pero se avisa antes de guardar: ese excedente
  // es justo lo que va a alimentar "Productos faltantes", no un error.
  const shortage = max === undefined && quantity > available ? quantity - available : 0;

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-lg bg-(--surface) p-5 sm:max-w-sm sm:rounded-lg">
        <h2 className="text-lg font-bold">{product.name}</h2>
        <p className="text-sm text-(--muted)">
          Se mide en {unitLabel(catalog, product.default_unit_id)}
          {max !== undefined ? ` · disponible: ${max}` : ` · disponible ahora: ${available}`}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="Restar uno"
            className="flex h-12 w-12 items-center justify-center rounded border border-(--rule) hover:bg-(--surface-2)"
          >
            <Minus size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            max={max}
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="h-12 flex-1 rounded border border-(--rule) bg-(--surface) px-3 text-center text-lg font-bold"
          />
          <button
            type="button"
            disabled={max !== undefined && quantity >= max}
            onClick={() => setQuantity((q) => (max !== undefined ? Math.min(max, q + 1) : q + 1))}
            aria-label="Sumar uno"
            className="flex h-12 w-12 items-center justify-center rounded border border-(--rule) hover:bg-(--surface-2) disabled:opacity-40"
          >
            <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        {exceedsMax ? (
          <p className="mt-2 text-sm text-unal-red">
            Solo hay {max} disponible{max === 1 ? "" : "s"}.
          </p>
        ) : null}

        {shortage > 0 ? (
          <p className="mt-2 text-sm text-unal-orange">
            Solo hay {available} disponible{available === 1 ? "" : "s"} ahora mismo. El
            faltante ({shortage}) quedará registrado como demanda insatisfecha en
            «Productos faltantes».
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-(--rule) px-4 py-3 font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={quantity <= 0 || exceedsMax}
            onClick={() => onConfirm(quantity)}
            className="flex-1 rounded bg-unal-green-dark px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
