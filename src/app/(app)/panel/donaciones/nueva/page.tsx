"use client";

import { Gift, Minus, Plus } from "lucide-react";
import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { currentUser, errorMessage, pb } from "@/lib/pb";
import { loadCatalog, unitLabel, type Catalog, type Product } from "@/lib/catalog";
import { useAsyncData } from "@/lib/use-async-data";
import { formatQuantity } from "@/lib/format";
import { ProductPicker } from "@/components/app/product-picker";
import {
  isGarmentUnit,
  isPackagedUnit,
  PackageCountField,
  SizeField,
} from "@/components/app/donation-item-attributes";
import { LoadingLine } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";

const DONOR_TYPES = [
  { value: "individual", label: "Persona" },
  { value: "empresa", label: "Empresa" },
  { value: "institucion", label: "Institución" },
  { value: "anonimo", label: "Anónimo" },
];

const DONOR_ID_TYPES = [
  { value: "", label: "Selecciona…" },
  { value: "cedula_ciudadania", label: "Cédula de ciudadanía" },
  { value: "cedula_extranjeria", label: "Cédula de extranjería" },
  { value: "nit", label: "NIT" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "otro", label: "Otro" },
];

interface DraftLine {
  key: string;
  product: Product;
  quantity: number;
  expiry: string;
  batch: string;
  status: "available" | "quarantine" | "pending";
  size: string;
  unitsPerPackage: number;
}

/*
 * La remesa se arma como borrador en el dispositivo y se envía al final.
 * En bodega la señal es mala justo donde se descarga: cuarenta peticiones
 * sueltas significan que la número treinta falla y nadie sabe si entró.
 */
export default function NuevaDonacionPage() {
  const router = useRouter();
  const operator = currentUser();

  const fetchCatalog = useCallback(() => loadCatalog(), []);
  const { data: catalog, error: catalogError } = useAsyncData(fetchCatalog);

  const [donorType, setDonorType] = useState("individual");
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorIdType, setDonorIdType] = useState("");
  const [donorIdNumber, setDonorIdNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Recepción rápida: se captura el peso y el transportista y se
  // guarda la remesa sin artículos — quien la reciba no tiene que
  // saber todavía qué hay adentro. "Registrar todo ahora" es el
  // formulario de siempre, sin cambios. Ver PROPUESTA-RECEPCION-REMESAS.md.
  const [quickMode, setQuickMode] = useState(true);
  const [totalWeight, setTotalWeight] = useState(0);
  const [carrierName, setCarrierName] = useState("");

  const [lines, setLines] = useState<DraftLine[]>([]);
  const [editing, setEditing] = useState<DraftLine | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<string[]>([]);

  // Lo último capturado, sin repetidos: es el camino más rápido para la
  // segunda caja de lo mismo.
  const recent = lines
    .map((line) => line.product)
    .filter(
      (product, index, all) =>
        all.findIndex((other) => other.id === product.id) === index
    )
    .slice(0, 8);

  function addProduct(product: Product) {
    const existing = lines.find(
      (line) => line.product.id === product.id && !line.expiry && !line.batch
    );

    // Repetir el mismo producto suma cantidad en vez de abrir otra línea,
    // salvo que lleve vencimiento o lote, donde cada entrada es distinta.
    if (existing && !product.requires_expiry && !product.requires_batch) {
      setLines((current) =>
        current.map((line) =>
          line.key === existing.key
            ? { ...line, quantity: line.quantity + 1 }
            : line
        )
      );
      return;
    }

    setEditing({
      key: crypto.randomUUID(),
      product,
      quantity: 1,
      expiry: "",
      batch: "",
      status: product.requires_quarantine ? "quarantine" : "available",
      size: "",
      unitsPerPackage: 1,
    });
  }

  function commitLine(line: DraftLine) {
    setLines((current) => {
      const index = current.findIndex((item) => item.key === line.key);
      if (index === -1) {
        return [...current, line];
      }
      const copy = [...current];
      copy[index] = line;
      return copy;
    });
    setEditing(null);
  }

  async function save() {
    if (!operator) {
      setError("Tu sesión expiró. Vuelve a entrar.");
      return;
    }
    if (quickMode) {
      if (totalWeight <= 0) {
        setError("El peso total es obligatorio en la recepción rápida.");
        return;
      }
    } else if (lines.length === 0) {
      setError("Agrega al menos un artículo, o usa «Solo recepción rápida».");
      return;
    }

    setSaving(true);
    setError(null);
    setFailed([]);

    try {
      // El estado nunca se infiere después con un proceso en segundo
      // plano — se decide una sola vez, aquí, según cómo se guardó:
      // si quedó algo sin clasificar (o directamente sin artículos),
      // la remesa arranca en "recepción"; si todo lo capturado ya
      // tiene un estado final, arranca "clasificada" de una vez, sin
      // obligar a un clic extra para algo que ya se resolvió aquí mismo.
      const hasPending = lines.some((line) => line.status === "pending");
      const status = quickMode || lines.length === 0 || hasPending ? "recepcion" : "clasificada";

      const donation = await pb.collection("donations").create({
        donor_type: donorType,
        donor_name: donorName || "Donante anónimo",
        donor_phone: donorPhone,
        donor_email: donorEmail,
        donor_id_type: donorIdType || null,
        donor_id_number: donorIdNumber,
        receipt_date: new Date().toISOString().replace("T", " "),
        operator_id: operator.id,
        notes,
        status,
        total_weight_kg: totalWeight > 0 ? totalWeight : null,
        carrier_name: carrierName,
      });

      const rejected: string[] = [];

      for (const line of lines) {
        try {
          await pb.collection("donation_items").create({
            donation_id: donation.id,
            product_id: line.product.id,
            unit_id: line.product.default_unit_id,
            quantity: line.quantity,
            classification_status: line.status,
            expiry_date: line.expiry || null,
            batch_code: line.batch,
            size: line.size,
            units_per_package: line.unitsPerPackage,
          });
        } catch (err) {
          rejected.push(`${line.product.name}: ${errorMessage(err)}`);
        }
      }

      if (rejected.length > 0) {
        setFailed(rejected);
        setError(
          `La donación ${donation.code} se creó, pero ${rejected.length} artículo(s) no entraron. Puedes agregarlos desde el detalle.`
        );
        return;
      }

      router.push("/panel/donaciones");
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
    <div>
      <Link href="/panel/donaciones" className="text-sm font-bold text-unal-green-dark">
        ← Donaciones
      </Link>

      <h1 className="mt-2 text-2xl font-black tracking-tight">Registrar donación</h1>

      <section className="mt-5 rounded border border-(--rule) bg-(--surface) p-4">
        <Toggle
          label="Solo recepción rápida — clasificar los artículos después"
          checked={quickMode}
          onChange={setQuickMode}
        />
        {quickMode ? (
          <p className="mt-1.5 text-xs text-(--muted)">
            Se guarda la remesa con donante y peso; los artículos se agregan más
            adelante desde el detalle, al abrirla y clasificarla.
          </p>
        ) : null}
      </section>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
        <h2 className="mb-3 text-sm font-bold">Quién dona</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tipo" className="mb-1 block text-sm font-bold">
              Tipo
            </label>
            <select
              id="tipo"
              value={donorType}
              onChange={(event) => setDonorType(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              {DONOR_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="nombre" className="mb-1 block text-sm font-bold">
              Nombre
            </label>
            <input
              id="nombre"
              value={donorName}
              onChange={(event) => setDonorName(event.target.value)}
              placeholder="Donante anónimo"
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="tel" className="mb-1 block text-sm font-bold">
              Teléfono <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="tel"
              type="tel"
              inputMode="tel"
              value={donorPhone}
              onChange={(event) => setDonorPhone(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="correo" className="mb-1 block text-sm font-bold">
              Correo <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="correo"
              type="email"
              inputMode="email"
              value={donorEmail}
              onChange={(event) => setDonorEmail(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="tipo-doc" className="mb-1 block text-sm font-bold">
              Tipo de documento <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <select
              id="tipo-doc"
              value={donorIdType}
              onChange={(event) => setDonorIdType(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              {DONOR_ID_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="num-doc" className="mb-1 block text-sm font-bold">
              Número de documento <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="num-doc"
              value={donorIdNumber}
              onChange={(event) => setDonorIdNumber(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="peso" className="mb-1 block text-sm font-bold">
              Peso total (kg){quickMode ? <span className="text-unal-red"> *</span> : null}{" "}
              <span className="font-normal text-(--muted)">
                {quickMode ? "" : "(opcional)"}
              </span>
            </label>
            <DecimalInput
              id="peso"
              value={totalWeight}
              onChange={setTotalWeight}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
            <label htmlFor="transportista" className="mb-1 block text-sm font-bold">
              Transportista <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="transportista"
              value={carrierName}
              onChange={(event) => setCarrierName(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>

          <div>
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

      {!quickMode ? (
        <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
          <h2 className="mb-3 text-sm font-bold">Qué llegó</h2>
          <ProductPicker catalog={catalog} recent={recent} onSelect={addProduct} />
        </section>
      ) : null}

      {!quickMode && lines.length > 0 ? (
        <section className="mt-4">
          <h2 className="mb-2 text-sm font-bold">
            En esta remesa{" "}
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
                    {line.size ? ` · talla ${line.size}` : ""}
                    {line.unitsPerPackage > 1 ? ` · ${line.unitsPerPackage} un./paquete` : ""}
                    {line.expiry ? ` · vence ${line.expiry}` : ""}
                    {line.batch ? ` · lote ${line.batch}` : ""}
                    {line.status === "quarantine" ? " · en revisión" : ""}
                    {line.status === "pending" ? " · por clasificar" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(line)}
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
        <div role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          <p>{error}</p>
          {failed.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {failed.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="sticky bottom-0 mt-4 border-t border-(--rule) bg-(--surface) p-4">
        <div className="mx-auto flex max-w-5xl gap-3">
          <Button variant="outline" onClick={() => router.back()} className="justify-center">
            Cancelar
          </Button>
          <Button
            onClick={save}
            disabled={saving || (quickMode ? totalWeight <= 0 : lines.length === 0)}
            loading={saving}
            icon={Gift}
            className="flex-1 justify-center"
          >
            {saving
              ? "Guardando…"
              : quickMode
                ? "Guardar recepción"
                : `Guardar remesa (${lines.length})`}
          </Button>
        </div>
      </div>

      {editing ? (
        <LineEditor
          catalog={catalog}
          line={editing}
          onCancel={() => setEditing(null)}
          onSave={commitLine}
        />
      ) : null}
    </div>
  );
}

function LineEditor({
  catalog,
  line,
  onCancel,
  onSave,
}: {
  catalog: Catalog;
  line: DraftLine;
  onCancel: () => void;
  onSave: (line: DraftLine) => void;
}) {
  const [draft, setDraft] = useState(line);
  const requiresExpiry = draft.product.requires_expiry;
  const requiresBatch = draft.product.requires_batch;
  const unit = catalog.units[draft.product.default_unit_id];
  const isGarment = isGarmentUnit(unit);
  const isPackaged = isPackagedUnit(unit);

  const missingExpiry = requiresExpiry && !draft.expiry;
  const missingBatch = requiresBatch && !draft.batch;

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-lg bg-(--surface) p-5 sm:max-w-md sm:rounded-lg">
        <h2 className="text-lg font-bold">{draft.product.name}</h2>
        <p className="text-sm text-(--muted)">
          Se mide en {unitLabel(catalog, draft.product.default_unit_id)}
        </p>

        <div className="mt-4">
          <label htmlFor="cant" className="mb-1 block text-sm font-bold">
            Cantidad
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setDraft((d) => ({ ...d, quantity: Math.max(1, d.quantity - 1) }))
              }
              aria-label="Restar uno"
              className="flex h-12 w-12 items-center justify-center rounded border border-(--rule) hover:bg-(--surface-2)"
            >
              <Minus size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <DecimalInput
              id="cant"
              value={draft.quantity}
              onChange={(quantity) => setDraft((d) => ({ ...d, quantity }))}
              className="h-12 flex-1 rounded border border-(--rule) bg-(--surface) px-3 text-center text-lg font-bold"
            />
            <button
              type="button"
              onClick={() => setDraft((d) => ({ ...d, quantity: d.quantity + 1 }))}
              aria-label="Sumar uno"
              className="flex h-12 w-12 items-center justify-center rounded border border-(--rule) hover:bg-(--surface-2)"
            >
              <Plus size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>
        </div>

        {isGarment ? (
          <SizeField
            id="talla"
            value={draft.size}
            onChange={(size) => setDraft((d) => ({ ...d, size }))}
          />
        ) : null}

        {isPackaged ? (
          <PackageCountField
            id="und-paquete"
            value={draft.unitsPerPackage}
            onChange={(unitsPerPackage) => setDraft((d) => ({ ...d, unitsPerPackage }))}
          />
        ) : null}

        {requiresExpiry ? (
          <div className="mt-4">
            <label htmlFor="vence" className="mb-1 block text-sm font-bold">
              Vencimiento
            </label>
            <input
              id="vence"
              type="date"
              value={draft.expiry}
              onChange={(event) =>
                setDraft((d) => ({ ...d, expiry: event.target.value }))
              }
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
        ) : null}

        {requiresBatch ? (
          <div className="mt-4">
            <label htmlFor="lote" className="mb-1 block text-sm font-bold">
              Lote
            </label>
            <input
              id="lote"
              value={draft.batch}
              onChange={(event) =>
                setDraft((d) => ({ ...d, batch: event.target.value }))
              }
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
        ) : null}

        <fieldset className="mt-4">
          <legend className="mb-1 text-sm font-bold">Estado</legend>
          <div className="flex gap-2">
            {[
              { value: "available", label: "Apto" },
              { value: "quarantine", label: "En Revisión" },
              { value: "pending", label: "Sin clasificar" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={draft.status === option.value}
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    status: option.value as DraftLine["status"],
                  }))
                }
                className={
                  draft.status === option.value
                    ? "flex-1 rounded bg-unal-green-dark px-3 py-2.5 text-sm font-bold text-white"
                    : "flex-1 rounded border border-(--rule) px-3 py-2.5 text-sm font-bold"
                }
              >
                {option.label}
              </button>
            ))}
          </div>
        </fieldset>

        {missingExpiry || missingBatch ? (
          <p className="mt-3 text-sm text-unal-red">
            Este producto exige {missingExpiry ? "fecha de vencimiento" : ""}
            {missingExpiry && missingBatch ? " y " : ""}
            {missingBatch ? "código de lote" : ""}.
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
            disabled={draft.quantity <= 0 || missingExpiry || missingBatch}
            onClick={() => onSave(draft)}
            className="flex-1 rounded bg-unal-green-dark px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}
