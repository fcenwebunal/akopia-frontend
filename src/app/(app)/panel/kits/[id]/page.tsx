"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Minus, Plus, Save } from "lucide-react";
import { currentUser, errorMessage, pb } from "@/lib/pb";
import { loadCatalog, unitLabel, type Catalog, type Product } from "@/lib/catalog";
import { loadKitItems, type Kit, type KitItem } from "@/lib/kits";
import { hasAnyRole } from "@/lib/roles";
import { useAsyncData } from "@/lib/use-async-data";
import { ProductPicker } from "@/components/app/product-picker";
import { DeleteRecordButton } from "@/components/app/record-actions";
import { LoadingLine, Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

const KIT_ROLES = ["admin", "coordinacion", "salida"] as const;

/*
 * A diferencia de "Nuevo kit" (borrador local, se envía completo al
 * final), aquí cada cambio se guarda al momento — agregar/editar/quitar
 * un renglón son llamadas directas a `kit_items`. Editar un kit ya
 * usado no afecta las solicitudes que ya generó (`request_items` copió
 * sus cantidades al crearse, ver PROPUESTA-KITS-SOLICITUDES.md) — es
 * seguro ajustarlo libremente.
 */
export default function KitDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const operator = currentUser();
  const canManage = hasAnyRole(operator?.role, KIT_ROLES);
  const canDeactivate = hasAnyRole(operator?.role, ["admin", "coordinacion"]);

  const [name, setName] = useState<string | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [savingHeader, setSavingHeader] = useState(false);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [deriving, setDeriving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [kit, items, catalog] = await Promise.all([
      pb.collection("kits").getOne<Kit>(id),
      loadKitItems(id),
      loadCatalog(),
    ]);
    return { kit, items, catalog };
  }, [id]);

  const { data, error: loadError, reload } = useAsyncData(fetchData);

  const catalog = data?.catalog;
  const productById = new Map((catalog?.products ?? []).map((p) => [p.id, p]));

  function startEditingHeader() {
    if (!data) return;
    setName(data.kit.name);
    setDescription(data.kit.description);
  }

  async function saveHeader() {
    if (name === null) return;
    if (!name.trim()) {
      setError("El nombre no puede quedar vacío.");
      return;
    }
    setSavingHeader(true);
    setError(null);
    try {
      await pb.collection("kits").update(id, { name, description: description ?? "" });
      setName(null);
      setDescription(null);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSavingHeader(false);
    }
  }

  async function addOrUpdateItem(product: Product, quantity: number) {
    setBusyItemId(product.id);
    setError(null);
    try {
      const existing = data?.items.find((item) => item.product_id === product.id);
      if (existing) {
        await pb.collection("kit_items").update(existing.id, { quantity });
      } else {
        await pb.collection("kit_items").create({
          kit_id: id,
          product_id: product.id,
          unit_id: product.default_unit_id,
          quantity,
        });
      }
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyItemId(null);
    }
  }

  async function removeItem(item: KitItem) {
    setBusyItemId(item.id);
    setError(null);
    try {
      await pb.collection("kit_items").delete(item.id);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyItemId(null);
    }
  }

  async function deriveAsNewKit() {
    if (!data || !operator) return;
    const newName = window.prompt("Nombre del nuevo kit", `${data.kit.name} (copia)`);
    if (!newName || !newName.trim()) return;

    setDeriving(true);
    setError(null);
    try {
      const newKit = await pb.collection("kits").create({
        name: newName,
        description: data.kit.description,
        created_by: operator.id,
        active: true,
        use_count: 0,
      });
      for (const item of data.items) {
        await pb.collection("kit_items").create({
          kit_id: newKit.id,
          product_id: item.product_id,
          unit_id: item.unit_id,
          quantity: item.quantity,
        });
      }
      router.push(`/panel/kits/${newKit.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setDeriving(false);
    }
  }

  if (!canManage) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es para quienes pueden crear solicitudes: administración, coordinación o salida.
      </p>
    );
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {loadError}
      </p>
    );
  }

  if (!data || !catalog) {
    return <LoadingLine />;
  }

  const { kit, items } = data;
  const editingHeader = name !== null;
  const recent = items
    .map((item) => productById.get(item.product_id))
    .filter((p): p is Product => Boolean(p))
    .slice(0, 8);

  return (
    <div>
      <Link href="/panel/kits" className="text-sm font-bold text-unal-green-dark">
        ← Kits
      </Link>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editingHeader ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                value={name ?? ""}
                onChange={(event) => setName(event.target.value)}
                className="rounded border border-(--rule) bg-(--surface) px-3 py-2 text-lg font-bold"
              />
              <input
                value={description ?? ""}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Descripción (opcional)"
                className="rounded border border-(--rule) bg-(--surface) px-3 py-2"
              />
            </div>
          ) : (
            <button type="button" onClick={startEditingHeader} className="text-left">
              <h1 className="text-2xl font-black tracking-tight">{kit.name}</h1>
              <p className="mt-1 text-(--muted)">{kit.description || "Sin descripción — toca para editar"}</p>
            </button>
          )}
        </div>

        <div className="flex shrink-0 gap-2">
          {editingHeader ? (
            <Button size="sm" onClick={saveHeader} disabled={savingHeader} loading={savingHeader} icon={Save}>
              Guardar
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={deriveAsNewKit} disabled={deriving} loading={deriving} icon={Copy}>
            Guardar como nuevo kit
          </Button>
          {canDeactivate && kit.active !== false ? (
            <DeleteRecordButton
              collection="kits"
              id={kit.id}
              label="Eliminar kit"
              itemDescription={kit.name}
              onDeleted={() => router.push("/panel/kits")}
            />
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-sm text-(--muted)">
        Usado {kit.use_count || 0} {kit.use_count === 1 ? "vez" : "veces"}
        {!kit.active ? " · desactivado" : ""}
      </p>

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
        <h2 className="mb-3 text-sm font-bold">Qué incluye</h2>
        <p className="mb-3 text-xs text-(--muted)">
          Las cantidades son «por unidad de kit» — al usarlo en una solicitud se multiplican
          por cuántos se necesiten. Los cambios aquí se guardan de inmediato y no afectan
          solicitudes que ya se generaron con este kit.
        </p>
        <ProductPicker catalog={catalog} recent={recent} onSelect={(p) => setPendingProduct(p)} />
      </section>

      {items.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-bold">
            Renglones{" "}
            <span className="ml-1 rounded bg-unal-green-soft px-2 py-0.5 text-unal-green-dark">
              {items.length}
            </span>
          </h2>
          <ul className="divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
            {items.map((item) => {
              const product = productById.get(item.product_id);
              return (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{product?.name ?? "Producto ya no disponible"}</p>
                    <p className="text-sm text-(--muted)">
                      {item.quantity} {product ? unitLabel(catalog, product.default_unit_id) : ""}
                    </p>
                  </div>
                  {product ? (
                    <button
                      type="button"
                      disabled={busyItemId === item.id}
                      onClick={() => setPendingProduct(product)}
                      className="rounded border border-(--rule) px-3 py-1.5 text-sm font-bold"
                    >
                      Editar
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyItemId === item.id}
                    onClick={() => removeItem(item)}
                    aria-label={`Quitar ${product?.name ?? "renglón"}`}
                    className="flex items-center gap-1 rounded border border-(--rule) px-3 py-1.5 text-sm font-bold text-unal-red disabled:opacity-50"
                  >
                    {busyItemId === item.id ? <Spinner /> : "✕"}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="mt-4 text-sm text-(--muted)">Este kit todavía no tiene productos.</p>
      )}

      {pendingProduct ? (
        <QuantityPrompt
          catalog={catalog}
          product={pendingProduct}
          initial={items.find((item) => item.product_id === pendingProduct.id)?.quantity ?? 1}
          onCancel={() => setPendingProduct(null)}
          onConfirm={(quantity) => {
            addOrUpdateItem(pendingProduct, quantity);
            setPendingProduct(null);
          }}
        />
      ) : null}
    </div>
  );
}

function QuantityPrompt({
  catalog,
  product,
  initial,
  onCancel,
  onConfirm,
}: {
  catalog: Catalog;
  product: Product;
  initial: number;
  onCancel: () => void;
  onConfirm: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(initial);

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-lg bg-(--surface) p-5 sm:max-w-sm sm:rounded-lg">
        <h2 className="text-lg font-bold">{product.name}</h2>
        <p className="text-sm text-(--muted)">
          Cantidad por unidad de kit, en {unitLabel(catalog, product.default_unit_id)}
        </p>

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(0.01, q - 1))}
            aria-label="Restar uno"
            className="flex h-12 w-12 items-center justify-center rounded border border-(--rule) hover:bg-(--surface-2)"
          >
            <Minus size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <input
            type="number"
            inputMode="decimal"
            min={0.01}
            step="any"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            className="h-12 flex-1 rounded border border-(--rule) bg-(--surface) px-3 text-center text-lg font-bold"
          />
          <button
            type="button"
            onClick={() => setQuantity((q) => q + 1)}
            aria-label="Sumar uno"
            className="flex h-12 w-12 items-center justify-center rounded border border-(--rule) hover:bg-(--surface-2)"
          >
            <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} className="rounded border border-(--rule) px-4 py-3 font-bold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={quantity <= 0}
            onClick={() => onConfirm(quantity)}
            className="flex-1 rounded bg-unal-green-dark px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
