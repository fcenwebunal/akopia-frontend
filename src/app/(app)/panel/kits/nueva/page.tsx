"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Layers, Minus, Plus } from "lucide-react";
import { currentUser, errorMessage, pb } from "@/lib/pb";
import { loadCatalog, unitLabel, type Catalog, type Product } from "@/lib/catalog";
import { hasAnyRole } from "@/lib/roles";
import { useAsyncData } from "@/lib/use-async-data";
import { formatQuantity } from "@/lib/format";
import { ProductPicker } from "@/components/app/product-picker";
import { LoadingLine } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

const KIT_ROLES = ["admin", "coordinacion", "salida"] as const;

interface DraftLine {
  key: string;
  product: Product;
  quantity: number;
}

/*
 * Mismo patrón de borrador local que solicitudes/nueva — un kit es,
 * en el fondo, la misma lista de renglones (producto + cantidad), sin
 * destino ni solicitante: eso lo pone cada solicitud que lo use, no
 * el kit. La cantidad aquí es "por unidad de kit": al usarlo se
 * multiplica por N.
 */
export default function NuevoKitPage() {
  const router = useRouter();
  const operator = currentUser();
  const canManage = hasAnyRole(operator?.role, KIT_ROLES);

  const fetchCatalog = useCallback(() => loadCatalog(), []);
  const { data: catalog, error: catalogError } = useAsyncData(fetchCatalog);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recent = lines
    .map((line) => line.product)
    .filter(
      (product, index, all) => all.findIndex((other) => other.id === product.id) === index
    )
    .slice(0, 8);

  function addProduct(product: Product) {
    const existing = lines.find((line) => line.product.id === product.id);
    if (existing) {
      setLines((current) =>
        current.map((line) =>
          line.key === existing.key ? { ...line, quantity: line.quantity + 1 } : line
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
    setLines((current) => [...current, { key: crypto.randomUUID(), product: pendingProduct, quantity }]);
    setPendingProduct(null);
  }

  async function save() {
    if (!operator) {
      setError("Tu sesión expiró. Vuelve a entrar.");
      return;
    }
    if (!name.trim()) {
      setError("Ponle un nombre al kit.");
      return;
    }
    if (lines.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const kit = await pb.collection("kits").create({
        name,
        description,
        created_by: operator.id,
        active: true,
        use_count: 0,
      });

      for (const line of lines) {
        await pb.collection("kit_items").create({
          kit_id: kit.id,
          product_id: line.product.id,
          unit_id: line.product.default_unit_id,
          quantity: line.quantity,
        });
      }

      router.push(`/panel/kits/${kit.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!canManage) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es para quienes pueden crear solicitudes: administración, coordinación o salida.
      </p>
    );
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
    <div>
      <Link href="/panel/kits" className="text-sm font-bold text-unal-green-dark">
        ← Kits
      </Link>

      <h1 className="mt-2 text-2xl font-black tracking-tight">Nuevo kit</h1>

      <section className="mt-5 rounded border border-(--rule) bg-(--surface) p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="kit-nombre" className="mb-1 block text-sm font-bold">
              Nombre <span className="text-unal-red">*</span>
            </label>
            <input
              id="kit-nombre"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej.: Kit escolar básico"
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
          <div>
            <label htmlFor="kit-desc" className="mb-1 block text-sm font-bold">
              Descripción <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="kit-desc"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
        </div>
      </section>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
        <h2 className="mb-3 text-sm font-bold">Qué incluye</h2>
        <p className="mb-3 text-xs text-(--muted)">
          Las cantidades son «por unidad de kit» — al usarlo en una solicitud se multiplican
          por cuántos se necesiten.
        </p>
        <ProductPicker catalog={catalog} recent={recent} onSelect={addProduct} />
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
                    {formatQuantity(line.quantity)} {unitLabel(catalog, line.product.default_unit_id)}
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
                    setLines((current) => current.filter((item) => item.key !== line.key))
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

      <div className="sticky bottom-0 mt-4 border-t border-(--rule) bg-(--surface) p-4">
        <div className="mx-auto flex max-w-5xl gap-3">
          <Button variant="outline" onClick={() => router.back()} className="justify-center">
            Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={saving || lines.length === 0}
            loading={saving}
            icon={Layers}
            className="flex-1 justify-center"
          >
            {saving ? "Guardando…" : `Guardar kit (${lines.length})`}
          </Button>
        </div>
      </div>

      {pendingProduct ? (
        <QuantityPrompt
          catalog={catalog}
          product={pendingProduct}
          initial={lines.find((line) => line.product.id === pendingProduct.id)?.quantity ?? 1}
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
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-(--rule) px-4 py-3 font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={quantity <= 0}
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
