"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, PackageSearch, X, XCircle } from "lucide-react";
import { callRoute, currentUser, errorMessage, pb, RouteError } from "@/lib/pb";
import { hasAnyRole } from "@/lib/roles";
import { useAsyncData } from "@/lib/use-async-data";
import { formatQuantity } from "@/lib/format";
import { LoadingLine } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { CoordinatesDisplay } from "@/components/app/coordinates-display";
import { DeleteRecordButton, EditRecordButton } from "@/components/app/record-actions";

const PRIORITY_OPTIONS = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

interface RequestItem {
  id: string;
  quantity_requested: number;
  status: string;
  expand?: {
    product_id?: { name?: string };
    unit_id?: { code?: string; name?: string };
  };
}

interface RequestRecord {
  id: string;
  code: string;
  requester_name: string;
  requester_phone: string;
  requester_institution: string;
  destination: string;
  destination_lat: number;
  destination_lng: number;
  beneficiary_count: number;
  priority: string;
  status: string;
  notes: string;
  rejection_reason: string;
}

interface AvailabilityRow {
  request_item_id: string;
  product_name: string;
  quantity_requested: number;
  available_qty: number;
  sufficient: boolean;
  shortage?: number;
}

/*
 * Aprobar y rechazar los ejecuta /api/requests/{id}/approve y /reject en
 * el backend: son transaccionales y aprobar reserva el inventario de
 * todos los renglones de una vez. Este panel nunca calcula ni reserva
 * nada por su cuenta.
 */
export default function SolicitudDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const operator = currentUser();
  // Aprobar/rechazar/cancelar es de admin, coordinación y salida —
  // decisión de Juan Manuel (20 ago 2026): salida puede tanto crear
  // como decidir sobre solicitudes, igual que ya podía transporte y
  // distribución con despachos.
  const canDecideRequest = hasAnyRole(operator?.role, ["admin", "coordinacion", "salida"]);
  const canManageRecords = hasAnyRole(operator?.role, ["admin", "coordinacion"]);

  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [busyAction, setBusyAction] = useState<
    "availability" | "approve" | "reject" | "cancel" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [missing, setMissing] = useState<
    { product: string; requested: number; available: number; shortage: number }[]
  >([]);
  const [availability, setAvailability] = useState<AvailabilityRow[] | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showReject, setShowReject] = useState(false);

  const fetchData = useCallback(async () => {
    const request = await pb.collection("requests").getOne<RequestRecord>(id);
    const items = await pb.collection("request_items").getList<RequestItem>(1, 200, {
      filter: `request_id = "${id}"`,
      sort: "created",
      expand: "product_id,unit_id",
    });
    return { request, items: items.items, version };
  }, [id, version]);

  const { data, error: loadError } = useAsyncData(fetchData);

  async function checkAvailability() {
    setBusy(true);
    setBusyAction("availability");
    setError(null);
    try {
      const result = await callRoute<{ items: AvailabilityRow[] }>(
        `/api/requests/${id}/availability`
      );
      setAvailability(result.items);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  async function approve() {
    setBusy(true);
    setBusyAction("approve");
    setError(null);
    setMissing([]);
    try {
      await callRoute(`/api/requests/${id}/approve`, { method: "POST", body: {} });
      setVersion((v) => v + 1);
      setAvailability(null);
    } catch (err) {
      if (err instanceof RouteError && Array.isArray(err.response.missing)) {
        setMissing(err.response.missing as typeof missing);
        setError("Inventario insuficiente para aprobar la solicitud completa.");
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  async function reject() {
    if (!rejectReason.trim()) {
      setError("Escribe el motivo del rechazo.");
      return;
    }
    setBusy(true);
    setBusyAction("reject");
    setError(null);
    try {
      await callRoute(`/api/requests/${id}/reject`, {
        method: "POST",
        body: { reason: rejectReason },
      });
      setVersion((v) => v + 1);
      setShowReject(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setBusyAction(null);
    }
  }

  async function cancel() {
    setBusy(true);
    setBusyAction("cancel");
    setError(null);
    try {
      await callRoute(`/api/requests/${id}/cancel`, {
        method: "POST",
        body: { reason: "Cancelada desde el panel" },
      });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
      setBusyAction(null);
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

  const { request, items } = data;
  const canDecide = request.status === "pendiente";
  const canCancel = request.status !== "entregada" && request.status !== "cancelada";

  return (
    <div>
      <Link href="/panel/solicitudes" className="text-sm font-bold text-unal-green-dark">
        ← Solicitudes
      </Link>

      <div className="mt-2 flex flex-wrap items-baseline gap-3">
        <h1 className="font-mono text-2xl font-black tracking-tight text-unal-green-dark">
          {request.code}
        </h1>
        <span className="rounded bg-(--surface-2) px-2 py-0.5 text-xs font-bold text-(--ink-2)">
          {request.status}
        </span>
      </div>

      <div className="mt-3 grid gap-1 text-sm text-(--ink-2)">
        <p>
          <strong>{request.requester_name}</strong>
          {request.requester_phone ? ` · ${request.requester_phone}` : ""}
          {request.requester_institution ? ` · ${request.requester_institution}` : ""}
        </p>
        <p>{request.destination}</p>
        {request.destination_lat || request.destination_lng ? (
          <CoordinatesDisplay lat={request.destination_lat} lng={request.destination_lng} />
        ) : null}
        {request.beneficiary_count ? (
          <p>{request.beneficiary_count} personas beneficiadas</p>
        ) : null}
        {request.notes ? <p className="italic">{request.notes}</p> : null}
        {request.rejection_reason ? (
          <p className="text-unal-red">Rechazada: {request.rejection_reason}</p>
        ) : null}
      </div>

      {canManageRecords ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <EditRecordButton
            collection="requests"
            id={request.id}
            onSaved={() => setVersion((v) => v + 1)}
            fields={[
              { name: "requester_name", label: "Nombre de quien pide" },
              { name: "requester_phone", label: "Teléfono", type: "tel" },
              { name: "requester_institution", label: "Institución" },
              { name: "destination", label: "Destino" },
              { name: "priority", label: "Prioridad", type: "select", options: PRIORITY_OPTIONS },
              { name: "beneficiary_count", label: "Personas beneficiadas", type: "number" },
              { name: "notes", label: "Notas", type: "textarea" },
            ]}
            values={{
              requester_name: request.requester_name,
              requester_phone: request.requester_phone,
              requester_institution: request.requester_institution,
              destination: request.destination,
              priority: request.priority,
              beneficiary_count: request.beneficiary_count,
              notes: request.notes,
            }}
          />
          <DeleteRecordButton
            collection="requests"
            id={request.id}
            label="Eliminar solicitud"
            itemDescription={request.code}
            onDeleted={() => router.push("/panel/solicitudes")}
          />
        </div>
      ) : null}

      {error ? (
        <div role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          <p>{error}</p>
          {missing.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {missing.map((row) => (
                <li key={row.product}>
                  {row.product}: pide {formatQuantity(row.requested)}, hay {formatQuantity(row.available)} — faltan{" "}
                  {formatQuantity(row.shortage)}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <h2 className="mt-6 text-sm font-bold">Renglones</h2>
      <ul className="mt-2 divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
        {items.map((item) => {
          const availabilityRow = availability?.find(
            (row) => row.request_item_id === item.id
          );
          return (
            <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{item.expand?.product_id?.name ?? "—"}</p>
                <p className="text-sm text-(--muted)">
                  {formatQuantity(item.quantity_requested)}{" "}
                  {item.expand?.unit_id?.code ?? item.expand?.unit_id?.name ?? ""}
                  {" · "}
                  {item.status}
                </p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                {availabilityRow ? (
                  <span
                    className={
                      availabilityRow.sufficient
                        ? "rounded bg-unal-green-soft px-2 py-0.5 text-xs font-bold text-unal-green-dark"
                        : "rounded bg-(--surface-2) px-2 py-0.5 text-xs font-bold text-unal-red"
                    }
                  >
                    {availabilityRow.sufficient
                      ? "Disponible"
                      : `Faltan ${formatQuantity(availabilityRow.shortage ?? 0)}`}
                  </span>
                ) : null}
                {canManageRecords && item.status === "pendiente" ? (
                  <>
                    <EditRecordButton
                      collection="request_items"
                      id={item.id}
                      onSaved={() => setVersion((v) => v + 1)}
                      fields={[
                        { name: "quantity_requested", label: "Cantidad pedida", type: "number" },
                      ]}
                      values={{ quantity_requested: item.quantity_requested }}
                    />
                    <DeleteRecordButton
                      collection="request_items"
                      id={item.id}
                      itemDescription={item.expand?.product_id?.name}
                      onDeleted={() => setVersion((v) => v + 1)}
                    />
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap gap-3">
        {canDecide ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            loading={busyAction === "availability"}
            onClick={checkAvailability}
            icon={PackageSearch}
          >
            Comprobar disponibilidad
          </Button>
        ) : null}

        {canDecide && canDecideRequest ? (
          <Button size="sm" disabled={busy} loading={busyAction === "approve"} onClick={approve} icon={Check}>
            Aprobar
          </Button>
        ) : null}

        {canDecide && canDecideRequest ? (
          <Button
            variant="danger"
            size="sm"
            disabled={busy}
            onClick={() => setShowReject((v) => !v)}
            icon={X}
          >
            Rechazar
          </Button>
        ) : null}

        {canCancel && !canDecide && canDecideRequest ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            loading={busyAction === "cancel"}
            onClick={cancel}
            icon={XCircle}
          >
            Cancelar solicitud
          </Button>
        ) : null}

        {canDecide && !canDecideRequest ? (
          <p className="text-sm text-(--muted)">
            Aprobar o rechazar requiere administración, coordinación o salida.
          </p>
        ) : null}
      </div>

      {showReject ? (
        <div className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
          <label htmlFor="motivo" className="mb-1 block text-sm font-bold">
            Motivo del rechazo
          </label>
          <input
            id="motivo"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
          <Button
            variant="danger-solid"
            size="sm"
            disabled={busy}
            loading={busyAction === "reject"}
            onClick={reject}
            icon={X}
            className="mt-3"
          >
            Confirmar rechazo
          </Button>
        </div>
      ) : null}
    </div>
  );
}
