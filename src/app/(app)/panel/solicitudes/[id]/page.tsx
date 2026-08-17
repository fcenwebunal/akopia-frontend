"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { callRoute, currentUser, errorMessage, pb, RouteError } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";

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
  const operator = currentUser();
  const isAdmin = operator?.role === "admin";

  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
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
    }
  }

  async function approve() {
    setBusy(true);
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
    }
  }

  async function reject() {
    if (!rejectReason.trim()) {
      setError("Escribe el motivo del rechazo.");
      return;
    }
    setBusy(true);
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
    }
  }

  async function cancel() {
    setBusy(true);
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
    return <p className="text-(--muted)">Cargando…</p>;
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
        {request.beneficiary_count ? (
          <p>{request.beneficiary_count} personas beneficiadas</p>
        ) : null}
        {request.notes ? <p className="italic">{request.notes}</p> : null}
        {request.rejection_reason ? (
          <p className="text-unal-red">Rechazada: {request.rejection_reason}</p>
        ) : null}
      </div>

      {error ? (
        <div role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          <p>{error}</p>
          {missing.length > 0 ? (
            <ul className="mt-2 list-disc pl-5 text-sm">
              {missing.map((row) => (
                <li key={row.product}>
                  {row.product}: pide {row.requested}, hay {row.available} — faltan{" "}
                  {row.shortage}
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
            <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium">{item.expand?.product_id?.name ?? "—"}</p>
                <p className="text-sm text-(--muted)">
                  {item.quantity_requested}{" "}
                  {item.expand?.unit_id?.code ?? item.expand?.unit_id?.name ?? ""}
                  {" · "}
                  {item.status}
                </p>
              </div>
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
                    : `Faltan ${availabilityRow.shortage}`}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-5 flex flex-wrap gap-3">
        {canDecide ? (
          <button
            type="button"
            disabled={busy}
            onClick={checkAvailability}
            className="rounded border border-(--rule) px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            Comprobar disponibilidad
          </button>
        ) : null}

        {canDecide && isAdmin ? (
          <button
            type="button"
            disabled={busy}
            onClick={approve}
            className="rounded bg-unal-green-dark px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Aprobar
          </button>
        ) : null}

        {canDecide && isAdmin ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => setShowReject((v) => !v)}
            className="rounded border border-unal-red px-4 py-2.5 text-sm font-bold text-unal-red disabled:opacity-50"
          >
            Rechazar
          </button>
        ) : null}

        {canCancel && !canDecide ? (
          <button
            type="button"
            disabled={busy}
            onClick={cancel}
            className="rounded border border-(--rule) px-4 py-2.5 text-sm font-bold disabled:opacity-50"
          >
            Cancelar solicitud
          </button>
        ) : null}

        {canDecide && !isAdmin ? (
          <p className="text-sm text-(--muted)">
            Aprobar o rechazar requiere un administrador.
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
          <button
            type="button"
            disabled={busy}
            onClick={reject}
            className="mt-3 rounded bg-unal-red px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            Confirmar rechazo
          </button>
        </div>
      ) : null}
    </div>
  );
}
