"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { currentUser, errorMessage, pb } from "@/lib/pb";
import { loadCatalog, unitLabel, type Catalog, type Product } from "@/lib/catalog";
import { useAsyncData } from "@/lib/use-async-data";
import { ProductPicker } from "@/components/app/product-picker";
import { LoadingLine, Spinner } from "@/components/ui/spinner";
import { Minus, Plus } from "lucide-react";

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

  const fetchCatalog = useCallback(() => loadCatalog(), []);
  const { data: catalog, error: catalogError } = useAsyncData(fetchCatalog);

  const [requesterName, setRequesterName] = useState("");
  const [requesterPhone, setRequesterPhone] = useState("");
  const [requesterInstitution, setRequesterInstitution] = useState("");
  const [destination, setDestination] = useState("");
  const [beneficiaryCount, setBeneficiaryCount] = useState("");
  const [priority, setPriority] = useState("media");
  const [notes, setNotes] = useState("");

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setLines((current) =>
        current.map((line) =>
          line.key === existing.key
            ? { ...line, quantity: line.quantity + 1 }
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
          initial={
            lines.find((line) => line.product.id === pendingProduct.id)
              ?.quantity ?? 1
          }
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
          Se mide en {unitLabel(catalog, product.default_unit_id)}
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
