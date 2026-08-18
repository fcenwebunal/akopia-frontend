"use client";

import { use, useCallback, useState } from "react";
import Link from "next/link";
import { callRoute, errorMessage, pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine, Spinner } from "@/components/ui/spinner";

interface Dispatch {
  id: string;
  code: string;
  destination: string;
  driver_name: string;
  driver_phone: string;
  vehicle_plate: string;
  brigade: string;
  dispatch_date: string;
  notes: string;
  expand?: { request_id?: { id: string; code?: string; status?: string; requester_name?: string } };
}

interface Delivery {
  id: string;
  receiver_name: string;
  receiver_phone: string;
  receiver_id_type: string;
  receiver_id_number: string;
  delivery_date: string;
  status: "entregado" | "parcial" | "no_entregado";
  notes: string;
}

// Los valores del esquema vienen de una plantilla mexicana (INE, INVIMA…);
// esto solo cambia la etiqueta visible, no lo que se guarda. La corrección
// del esquema es un pendiente aparte, ya documentado.
const ID_TYPE_LABELS: Record<string, string> = {
  ine: "Documento de identidad",
  pasaporte: "Pasaporte",
  credencial: "Carné institucional",
  otro: "Otro",
};

const DELIVERY_STATUS_LABELS: Record<Delivery["status"], string> = {
  entregado: "Entregado completo",
  parcial: "Entrega parcial",
  no_entregado: "No se pudo entregar",
};

/*
 * Confirmar la entrega llama a /api/dispatches/{id}/confirm-delivery, que
 * en una sola transacción crea el registro de entrega, cierra las
 * reservas activas (consumida si se entregó, liberada si no) y actualiza
 * la solicitud. Esta pantalla nunca toca inventario ni reservations
 * directamente.
 */
export default function DespachoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [version, setVersion] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverIdType, setReceiverIdType] = useState("ine");
  const [receiverIdNumber, setReceiverIdNumber] = useState("");
  const [status, setStatus] = useState<Delivery["status"]>("entregado");
  const [notes, setNotes] = useState("");

  const fetchData = useCallback(async () => {
    const dispatch = await pb.collection("dispatches").getOne<Dispatch>(id, {
      expand: "request_id",
    });

    let delivery: Delivery | null = null;
    try {
      delivery = await pb
        .collection("deliveries")
        .getFirstListItem<Delivery>(`dispatch_id = "${id}"`);
    } catch {
      delivery = null;
    }

    return { dispatch, delivery, version };
  }, [id, version]);

  const { data, error: loadError } = useAsyncData(fetchData);

  async function confirmDelivery() {
    if (!receiverName.trim()) {
      setError("Escribe el nombre de quien recibe.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await callRoute(`/api/dispatches/${id}/confirm-delivery`, {
        method: "POST",
        body: {
          receiver_name: receiverName,
          receiver_phone: receiverPhone,
          receiver_id_type: receiverIdType,
          receiver_id_number: receiverIdNumber,
          status,
          notes,
        },
      });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
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

  const { dispatch, delivery } = data;

  return (
    <div>
      <Link href="/panel/despachos" className="text-sm font-bold text-unal-green-dark">
        ← Despachos
      </Link>

      <h1 className="mt-2 font-mono text-2xl font-black tracking-tight text-unal-green-dark">
        {dispatch.code}
      </h1>

      <div className="mt-3 grid gap-1 text-sm text-(--ink-2)">
        <p>
          {dispatch.expand?.request_id?.code ? (
            <Link
              href={`/panel/solicitudes/${dispatch.expand.request_id.id}`}
              className="font-bold text-unal-green-dark hover:underline"
            >
              {dispatch.expand.request_id.code}
            </Link>
          ) : null}
          {dispatch.expand?.request_id?.requester_name
            ? ` · ${dispatch.expand.request_id.requester_name}`
            : ""}
        </p>
        <p>{dispatch.destination}</p>
        <p>
          {dispatch.driver_name}
          {dispatch.driver_phone ? ` · ${dispatch.driver_phone}` : ""}
          {dispatch.vehicle_plate ? ` · placa ${dispatch.vehicle_plate}` : ""}
        </p>
        {dispatch.brigade ? <p>Brigada: {dispatch.brigade}</p> : null}
        {dispatch.notes ? <p className="italic">{dispatch.notes}</p> : null}
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      {delivery ? (
        <section className="mt-6 rounded border border-(--rule) bg-(--surface) p-4">
          <h2 className="text-sm font-bold">Entrega confirmada</h2>
          <p className="mt-2 text-sm">
            <strong>{delivery.receiver_name}</strong>
            {delivery.receiver_phone ? ` · ${delivery.receiver_phone}` : ""}
          </p>
          <p className="mt-1 text-sm text-(--muted)">
            {ID_TYPE_LABELS[delivery.receiver_id_type] ?? delivery.receiver_id_type}
            {delivery.receiver_id_number ? ` ${delivery.receiver_id_number}` : ""}
            {" · "}
            {DELIVERY_STATUS_LABELS[delivery.status]}
            {" · "}
            {new Date(delivery.delivery_date).toLocaleDateString("es-CO")}
          </p>
          {delivery.notes ? (
            <p className="mt-2 text-sm italic">{delivery.notes}</p>
          ) : null}
        </section>
      ) : (
        <section className="mt-6 rounded border border-(--rule) bg-(--surface) p-4">
          <h2 className="text-sm font-bold">Confirmar entrega</h2>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="receptor" className="mb-1 block text-sm font-bold">
                Nombre de quien recibe <span className="text-unal-red">*</span>
              </label>
              <input
                id="receptor"
                value={receiverName}
                onChange={(event) => setReceiverName(event.target.value)}
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              />
            </div>

            <div>
              <label htmlFor="telreceptor" className="mb-1 block text-sm font-bold">
                Teléfono
              </label>
              <input
                id="telreceptor"
                type="tel"
                inputMode="tel"
                value={receiverPhone}
                onChange={(event) => setReceiverPhone(event.target.value)}
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              />
            </div>

            <div>
              <label htmlFor="tipodoc" className="mb-1 block text-sm font-bold">
                Tipo de documento
              </label>
              <select
                id="tipodoc"
                value={receiverIdType}
                onChange={(event) => setReceiverIdType(event.target.value)}
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              >
                {Object.entries(ID_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="numdoc" className="mb-1 block text-sm font-bold">
                Número de documento
              </label>
              <input
                id="numdoc"
                value={receiverIdNumber}
                onChange={(event) => setReceiverIdNumber(event.target.value)}
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              />
            </div>

            <div className="sm:col-span-2">
              <fieldset>
                <legend className="mb-1 text-sm font-bold">Resultado</legend>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DELIVERY_STATUS_LABELS) as Delivery["status"][]).map(
                    (option) => (
                      <button
                        key={option}
                        type="button"
                        aria-pressed={status === option}
                        onClick={() => setStatus(option)}
                        className={
                          status === option
                            ? "rounded bg-unal-green-dark px-3 py-2 text-sm font-bold text-white"
                            : "rounded border border-(--rule) px-3 py-2 text-sm font-bold"
                        }
                      >
                        {DELIVERY_STATUS_LABELS[option]}
                      </button>
                    )
                  )}
                </div>
                {status === "no_entregado" ? (
                  <p className="mt-2 text-sm text-(--muted)">
                    Las reservas de esta solicitud se liberarán y el producto
                    vuelve a estar disponible.
                  </p>
                ) : null}
              </fieldset>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="notasentrega" className="mb-1 block text-sm font-bold">
                Notas <span className="font-normal text-(--muted)">(opcional)</span>
              </label>
              <input
                id="notasentrega"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={confirmDelivery}
            className="mt-4 rounded bg-unal-green-dark px-6 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? (
              <>
                <Spinner className="mr-2" />
                Guardando…
              </>
            ) : (
              "Confirmar entrega"
            )}
          </button>
        </section>
      )}
    </div>
  );
}
