"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Ban, CheckCircle, Lock, Minus, Plus, RotateCcw } from "lucide-react";
import { currentUser, errorMessage, pb } from "@/lib/pb";
import { loadCatalog, unitLabel, type Catalog, type Product } from "@/lib/catalog";
import { hasAnyRole } from "@/lib/roles";
import { useAsyncData } from "@/lib/use-async-data";
import { formatQuantity } from "@/lib/format";
import { ProductPicker } from "@/components/app/product-picker";
import {
  isGarmentUnit,
  isPackagedUnit,
  PackageCountField,
  SizeField,
} from "@/components/app/donation-item-attributes";
import { DeleteRecordButton, EditRecordButton } from "@/components/app/record-actions";
import { LoadingLine, Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { DecimalInput } from "@/components/ui/decimal-input";

interface Item {
  id: string;
  product_id: string;
  quantity: number;
  classification_status: "pending" | "available" | "quarantine" | "rejected";
  expiry_date: string;
  batch_code: string;
  rejection_reason: string;
  size: string;
  units_per_package: number;
  expand?: {
    product_id?: { name?: string };
    unit_id?: { code?: string; name?: string };
  };
}

interface Donation {
  id: string;
  code: string;
  donor_name: string;
  donor_type: string;
  donor_phone: string;
  donor_email: string;
  donor_id_type: string;
  donor_id_number: string;
  receipt_date: string;
  notes: string;
  status: "recepcion" | "clasificada";
  total_weight_kg: number;
  classified_weight_kg: number;
  carrier_name: string;
  operator_id: string;
}

const DONOR_TYPE_OPTIONS = [
  { value: "individual", label: "Persona" },
  { value: "empresa", label: "Empresa" },
  { value: "institucion", label: "Institución" },
  { value: "anonimo", label: "Anónimo" },
];

const DONOR_ID_TYPE_OPTIONS = [
  { value: "", label: "Sin especificar" },
  { value: "cedula_ciudadania", label: "Cédula de ciudadanía" },
  { value: "cedula_extranjeria", label: "Cédula de extranjería" },
  { value: "nit", label: "NIT" },
  { value: "pasaporte", label: "Pasaporte" },
  { value: "otro", label: "Otro" },
];

const DONOR_ID_TYPE_LABELS: Record<string, string> = {
  cedula_ciudadania: "C.C.",
  cedula_extranjeria: "C.E.",
  nit: "NIT",
  pasaporte: "Pasaporte",
  otro: "Doc.",
};

const STATUS_LABELS: Record<Item["classification_status"], string> = {
  pending: "Por clasificar",
  available: "Apto",
  quarantine: "En Revisión",
  rejected: "Rechazado",
};

const STATUS_STYLES: Record<Item["classification_status"], string> = {
  pending: "bg-(--surface-2) text-(--ink-2)",
  available: "bg-unal-green-soft text-unal-green-dark",
  quarantine: "bg-(--surface-2) text-unal-orange",
  rejected: "bg-(--surface-2) text-unal-red",
};

const CAN_ADD_ITEMS = ["admin", "voluntariado"] as const;

/*
 * Clasificar es lo que mueve el inventario: al pasar un artículo a apto o
 * a revisión, los hooks del backend generan el movimiento y ajustan el
 * saldo. Desde aquí solo se cambia el estado — nunca se toca `inventory`.
 *
 * Desde la recepción rápida (ver PROPUESTA-RECEPCION-REMESAS.md), una
 * remesa puede llegar aquí sin ningún artículo todavía — esta pantalla
 * es donde se abre y se da de alta cada uno, no solo donde se cambia
 * el estado de los que ya existen.
 */
export default function DonacionDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const operator = currentUser();
  const canAddItems = hasAnyRole(operator?.role, CAN_ADD_ITEMS);
  // Editar/eliminar con motivo es más estricto que el resto de esta
  // pantalla: solo admin/coordinación, nunca "el dueño" — así lo exige
  // 11_edit_delete_with_reason.pb.js en el backend.
  const canManageRecords = hasAnyRole(operator?.role, ["admin", "coordinacion"]);

  const [busy, setBusy] = useState<string | null>(null);
  const [busyStatus, setBusyStatus] = useState<Item["classification_status"] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [closing, setClosing] = useState(false);

  const fetchData = useCallback(async () => {
    const [donation, items, catalog] = await Promise.all([
      pb.collection("donations").getOne<Donation>(id),
      pb.collection("donation_items").getList<Item>(1, 200, {
        filter: `donation_id = "${id}"`,
        sort: "created",
        expand: "product_id,unit_id",
      }),
      loadCatalog(),
    ]);
    return { donation, items: items.items, catalog };
  }, [id]);

  const { data, error: loadError, reload } = useAsyncData(fetchData);

  async function classify(item: Item, status: Item["classification_status"]) {
    setBusy(item.id);
    setBusyStatus(status);
    setError(null);

    try {
      await pb
        .collection("donation_items")
        .update(item.id, { classification_status: status });
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
      setBusyStatus(null);
    }
  }

  async function addItem(
    product: Product,
    values: {
      quantity: number;
      expiry: string;
      batch: string;
      status: Item["classification_status"];
      size: string;
      unitsPerPackage: number;
    }
  ) {
    if (!data) return;
    setBusy("new");
    setError(null);
    try {
      await pb.collection("donation_items").create({
        donation_id: data.donation.id,
        product_id: product.id,
        unit_id: product.default_unit_id,
        quantity: values.quantity,
        classification_status: values.status,
        expiry_date: values.expiry || null,
        batch_code: values.batch,
        size: values.size,
        units_per_package: values.unitsPerPackage,
      });
      // Si la remesa ya se había dado por clasificada y se le agrega
      // algo más, deja de estarlo — no tiene sentido que quede
      // marcada "clasificada" con un artículo recién llegado sin
      // resolver.
      if (data.donation.status === "clasificada") {
        await pb.collection("donations").update(data.donation.id, {
          status: "recepcion",
          classification_closed_at: null,
          classification_closed_by: null,
        });
      }
      setPendingProduct(null);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function closeClassification(classifiedWeight: number) {
    if (!data || !operator) return;
    setBusy("close");
    setError(null);
    try {
      await pb.collection("donations").update(data.donation.id, {
        status: "clasificada",
        classified_weight_kg: classifiedWeight,
        classification_closed_at: new Date().toISOString(),
        classification_closed_by: operator.id,
      });
      setClosing(false);
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function reopenClassification() {
    if (!data) return;
    setBusy("reopen");
    setError(null);
    try {
      await pb.collection("donations").update(data.donation.id, {
        status: "recepcion",
        classification_closed_at: null,
        classification_closed_by: null,
      });
      reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {loadError}
      </p>
    );
  }

  if (!data) {
    return <LoadingLine />;
  }

  const { donation, items, catalog } = data;
  const pending = items.filter((item) => item.classification_status === "pending").length;
  const canManageHeader =
    operator?.id === donation.operator_id || hasAnyRole(operator?.role, ["admin", "coordinacion"]);
  const recent = items
    .map((item) => catalog.products.find((p) => p.id === item.product_id))
    .filter((p): p is Product => Boolean(p));

  return (
    <div>
      <Link href="/panel/donaciones" className="text-sm font-bold text-unal-green-dark">
        ← Donaciones
      </Link>

      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-2xl font-black tracking-tight text-unal-green-dark">
          {donation.code}
        </h1>
        <span
          className={
            donation.status === "clasificada"
              ? "rounded bg-unal-green-soft px-2 py-0.5 text-xs font-bold text-unal-green-dark"
              : "rounded bg-(--surface-2) px-2 py-0.5 text-xs font-bold text-unal-orange"
          }
        >
          {donation.status === "clasificada" ? "Clasificada" : "En recepción"}
        </span>
      </div>

      <p className="mt-1 text-(--muted)">
        {donation.donor_name} ·{" "}
        {new Date(donation.receipt_date).toLocaleDateString("es-CO", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}
        {donation.carrier_name ? ` · ${donation.carrier_name}` : ""}
      </p>

      {donation.donor_email || donation.donor_id_number ? (
        <p className="mt-0.5 text-sm text-(--muted)">
          {[
            donation.donor_email,
            donation.donor_id_number
              ? `${DONOR_ID_TYPE_LABELS[donation.donor_id_type] ?? "Documento"} ${donation.donor_id_number}`
              : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      {donation.total_weight_kg ? (
        <p className="mt-1 text-sm text-(--ink-2)">
          Peso declarado: <strong>{formatQuantity(donation.total_weight_kg)} kg</strong>
          {donation.status === "clasificada" && donation.classified_weight_kg ? (
            <>
              {" · "}
              Peso clasificado: <strong>{formatQuantity(donation.classified_weight_kg)} kg</strong>
              {donation.classified_weight_kg < donation.total_weight_kg ? (
                <span className="text-(--muted)">
                  {" "}
                  (merma {formatQuantity(donation.total_weight_kg - donation.classified_weight_kg)} kg)
                </span>
              ) : null}
            </>
          ) : null}
        </p>
      ) : null}

      {donation.notes ? (
        <p className="mt-2 text-sm text-(--ink-2)">{donation.notes}</p>
      ) : null}

      {canManageRecords ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <EditRecordButton
            collection="donations"
            id={donation.id}
            onSaved={reload}
            fields={[
              { name: "donor_type", label: "Tipo de donante", type: "select", options: DONOR_TYPE_OPTIONS },
              { name: "donor_name", label: "Nombre del donante" },
              { name: "donor_phone", label: "Teléfono", type: "tel" },
              { name: "donor_email", label: "Correo", type: "email" },
              { name: "donor_id_type", label: "Tipo de documento", type: "select", options: DONOR_ID_TYPE_OPTIONS },
              { name: "donor_id_number", label: "Número de documento" },
              { name: "carrier_name", label: "Transportista" },
              { name: "total_weight_kg", label: "Peso declarado (kg)", type: "number" },
              { name: "notes", label: "Notas", type: "textarea" },
            ]}
            values={{
              donor_type: donation.donor_type,
              donor_name: donation.donor_name,
              donor_phone: donation.donor_phone,
              donor_email: donation.donor_email,
              donor_id_type: donation.donor_id_type,
              donor_id_number: donation.donor_id_number,
              carrier_name: donation.carrier_name,
              total_weight_kg: donation.total_weight_kg,
              notes: donation.notes,
            }}
          />
          <DeleteRecordButton
            collection="donations"
            id={donation.id}
            label="Eliminar donación"
            itemDescription={donation.code}
            onDeleted={() => router.push("/panel/donaciones")}
          />
        </div>
      ) : null}

      {pending > 0 ? (
        <p className="mt-4 rounded border-l-4 border-unal-yellow bg-(--surface) px-4 py-3 text-sm">
          <strong>{pending}</strong> artículo(s) sin clasificar. Hasta que no se
          clasifiquen no entran al inventario, ni se puede cerrar la clasificación.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      {items.length === 0 ? (
        <p className="mt-5 rounded border border-(--rule) bg-(--surface) p-4 text-sm text-(--muted)">
          Esta remesa se recibió sin artículos — agrégalos a medida que se abre y se
          clasifica.
        </p>
      ) : (
        <ul className="mt-5 space-y-3">
          {items.map((item) => {
            const status = item.classification_status;
            const locked = status === "available" || status === "quarantine";

            return (
              <li key={item.id} className="rounded border border-(--rule) bg-(--surface) p-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-bold">{item.expand?.product_id?.name ?? "—"}</span>
                  <span className="text-(--muted)">
                    {formatQuantity(item.quantity)} {item.expand?.unit_id?.code ?? item.expand?.unit_id?.name ?? ""}
                  </span>
                  <span className={`ml-auto rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[status]}`}>
                    {STATUS_LABELS[status]}
                  </span>
                </div>

                {item.size || (item.units_per_package > 1) || item.expiry_date || item.batch_code ? (
                  <p className="mt-1 text-sm text-(--muted)">
                    {[
                      item.size ? `Talla ${item.size}` : "",
                      item.units_per_package > 1 ? `${item.units_per_package} un./paquete` : "",
                      item.expiry_date
                        ? `Vence ${new Date(item.expiry_date).toLocaleDateString("es-CO")}`
                        : "",
                      item.batch_code ? `Lote ${item.batch_code}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  {status !== "available" ? (
                    <Button
                      size="sm"
                      disabled={busy === item.id}
                      loading={busy === item.id && busyStatus === "available"}
                      onClick={() => classify(item, "available")}
                      icon={CheckCircle}
                    >
                      {status === "quarantine" ? "Liberar a disponible" : "Marcar apto"}
                    </Button>
                  ) : null}

                  {status !== "quarantine" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy === item.id}
                      loading={busy === item.id && busyStatus === "quarantine"}
                      onClick={() => classify(item, "quarantine")}
                      icon={AlertTriangle}
                    >
                      A revisión
                    </Button>
                  ) : null}

                  {!locked && status !== "rejected" ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={busy === item.id}
                      loading={busy === item.id && busyStatus === "rejected"}
                      onClick={() => classify(item, "rejected")}
                      icon={Ban}
                    >
                      Rechazar
                    </Button>
                  ) : null}

                  {canManageRecords && !locked ? (
                    <>
                      <EditRecordButton
                        collection="donation_items"
                        id={item.id}
                        onSaved={reload}
                        fields={[
                          { name: "quantity", label: "Cantidad", type: "number" },
                          { name: "expiry_date", label: "Vencimiento", type: "date" },
                          { name: "batch_code", label: "Lote" },
                          { name: "size", label: "Talla" },
                          { name: "units_per_package", label: "Unidades por paquete", type: "number" },
                        ]}
                        values={{
                          quantity: item.quantity,
                          expiry_date: item.expiry_date,
                          batch_code: item.batch_code,
                          size: item.size,
                          units_per_package: item.units_per_package,
                        }}
                      />
                      <DeleteRecordButton
                        collection="donation_items"
                        id={item.id}
                        itemDescription={item.expand?.product_id?.name}
                        onDeleted={reload}
                      />
                    </>
                  ) : null}
                </div>

                {locked ? (
                  <p className="mt-2 text-xs text-(--muted)">
                    Ya afectó inventario: para rechazarlo hay que hacer un ajuste.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {canAddItems ? (
        <section className="mt-5 rounded border border-(--rule) bg-(--surface) p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold">Agregar artículo</h2>
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="text-sm font-bold text-unal-green-dark"
            >
              {adding ? "Ocultar" : "Abrir"}
            </button>
          </div>
          {adding ? (
            <ProductPicker
              catalog={catalog}
              recent={recent}
              onSelect={(product) => setPendingProduct(product)}
            />
          ) : null}
        </section>
      ) : null}

      {donation.status === "recepcion" && canManageHeader ? (
        <div className="mt-4">
          <Button
            disabled={pending > 0 || busy === "close"}
            loading={busy === "close"}
            onClick={() => setClosing(true)}
            icon={Lock}
          >
            Cerrar clasificación
          </Button>
          {pending > 0 ? (
            <p className="mt-1.5 text-xs text-(--muted)">
              Clasifica lo que falta antes de cerrar.
            </p>
          ) : null}
        </div>
      ) : null}

      {donation.status === "clasificada" && canManageHeader ? (
        <div className="mt-4">
          <Button
            variant="outline"
            disabled={busy === "reopen"}
            loading={busy === "reopen"}
            onClick={reopenClassification}
            icon={RotateCcw}
          >
            Reabrir clasificación
          </Button>
        </div>
      ) : null}

      {pendingProduct ? (
        <ItemEditor
          catalog={catalog}
          product={pendingProduct}
          saving={busy === "new"}
          onCancel={() => setPendingProduct(null)}
          onSave={(values) => addItem(pendingProduct, values)}
        />
      ) : null}

      {closing ? (
        <CloseDialog
          declaredWeight={donation.total_weight_kg}
          hasZeroItems={items.length === 0}
          saving={busy === "close"}
          onCancel={() => setClosing(false)}
          onConfirm={closeClassification}
        />
      ) : null}
    </div>
  );
}

function ItemEditor({
  catalog,
  product,
  saving,
  onCancel,
  onSave,
}: {
  catalog: Catalog;
  product: Product;
  saving: boolean;
  onCancel: () => void;
  onSave: (values: {
    quantity: number;
    expiry: string;
    batch: string;
    status: Item["classification_status"];
    size: string;
    unitsPerPackage: number;
  }) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const [expiry, setExpiry] = useState("");
  const [batch, setBatch] = useState("");
  const [size, setSize] = useState("");
  const [unitsPerPackage, setUnitsPerPackage] = useState(1);
  const [status, setStatus] = useState<Item["classification_status"]>(
    product.requires_quarantine ? "quarantine" : "available"
  );

  const requiresExpiry = product.requires_expiry;
  const requiresBatch = product.requires_batch;
  const unit = catalog.units[product.default_unit_id];
  const isGarment = isGarmentUnit(unit);
  const isPackaged = isPackagedUnit(unit);
  const missingExpiry = requiresExpiry && !expiry;
  const missingBatch = requiresBatch && !batch;

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-lg bg-(--surface) p-5 sm:max-w-md sm:rounded-lg">
        <h2 className="text-lg font-bold">{product.name}</h2>
        <p className="text-sm text-(--muted)">Se mide en {unitLabel(catalog, product.default_unit_id)}</p>

        <div className="mt-4">
          <label htmlFor="di-cant" className="mb-1 block text-sm font-bold">
            Cantidad
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Restar uno"
              className="flex h-12 w-12 items-center justify-center rounded border border-(--rule) hover:bg-(--surface-2)"
            >
              <Minus size={20} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <DecimalInput
              id="di-cant"
              value={quantity}
              onChange={setQuantity}
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
        </div>

        {isGarment ? <SizeField id="di-talla" value={size} onChange={setSize} /> : null}

        {isPackaged ? (
          <PackageCountField id="di-und-paquete" value={unitsPerPackage} onChange={setUnitsPerPackage} />
        ) : null}

        {requiresExpiry ? (
          <div className="mt-4">
            <label htmlFor="di-vence" className="mb-1 block text-sm font-bold">
              Vencimiento
            </label>
            <input
              id="di-vence"
              type="date"
              value={expiry}
              onChange={(event) => setExpiry(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
        ) : null}

        {requiresBatch ? (
          <div className="mt-4">
            <label htmlFor="di-lote" className="mb-1 block text-sm font-bold">
              Lote
            </label>
            <input
              id="di-lote"
              value={batch}
              onChange={(event) => setBatch(event.target.value)}
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
                aria-pressed={status === option.value}
                onClick={() => setStatus(option.value as Item["classification_status"])}
                className={
                  status === option.value
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
          <button type="button" onClick={onCancel} className="rounded border border-(--rule) px-4 py-3 font-bold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={quantity <= 0 || missingExpiry || missingBatch || saving}
            onClick={() => onSave({ quantity, expiry, batch, status, size, unitsPerPackage })}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-unal-green-dark px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? <Spinner /> : null}
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
}

/*
 * El peso clasificado arranca igual al declarado (opción B de
 * PROPUESTA-RECEPCION-REMESAS.md — decisión de Juan Manuel): casi
 * siempre no hay tiempo de volver a pesar, y lo que se descarta suele
 * ser insignificante en peso. Queda editable por si de verdad hace
 * falta corregirlo.
 */
function CloseDialog({
  declaredWeight,
  hasZeroItems,
  saving,
  onCancel,
  onConfirm,
}: {
  declaredWeight: number;
  hasZeroItems: boolean;
  saving: boolean;
  onCancel: () => void;
  onConfirm: (weight: number) => void;
}) {
  const [weight, setWeight] = useState(declaredWeight || 0);
  const [confirmedEmpty, setConfirmedEmpty] = useState(false);

  return (
    <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="w-full rounded-t-lg bg-(--surface) p-5 sm:max-w-sm sm:rounded-lg">
        <h2 className="text-lg font-bold">Cerrar clasificación</h2>

        {hasZeroItems ? (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              checked={confirmedEmpty}
              onChange={(event) => setConfirmedEmpty(event.target.checked)}
              className="mt-0.5"
            />
            Confirmo que esta remesa no tiene ningún artículo aprovechable para registrar.
          </label>
        ) : (
          <>
            <div className="mt-4">
              <label htmlFor="peso-clasif" className="mb-1 block text-sm font-bold">
                Peso clasificado (kg)
              </label>
              <DecimalInput
                id="peso-clasif"
                value={weight}
                onChange={setWeight}
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              />
              <p className="mt-1.5 text-xs text-(--muted)">
                Arranca igual al peso declarado ({declaredWeight} kg) — cámbialo solo si
                de verdad se volvió a pesar.
              </p>
            </div>
          </>
        )}

        <div className="mt-5 flex gap-3">
          <button type="button" onClick={onCancel} className="rounded border border-(--rule) px-4 py-3 font-bold">
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || (hasZeroItems && !confirmedEmpty)}
            onClick={() => onConfirm(weight)}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-unal-green-dark px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? <Spinner /> : null}
            Confirmar cierre
          </button>
        </div>
      </div>
    </div>
  );
}
