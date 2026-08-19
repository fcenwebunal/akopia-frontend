"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import { currentUser, errorMessage, pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { AddressMapField, EMPTY_ADDRESS_VALUE, type AddressValue } from "@/components/app/address-map-field";
import { MANIZALES_CENTER } from "@/lib/coordinates";

interface ApprovedRequest {
  id: string;
  code: string;
  requester_name: string;
  requester_phone: string;
  destination: string;
  destination_lat: number;
  destination_lng: number;
  street_type: string;
  street_number: string;
  street_plate: string;
  address_complement: string;
}

/*
 * Crear el despacho es CRUD sencillo: no hay un movimiento de inventario
 * que dependa de él, porque el stock ya se reservó al aprobar la
 * solicitud. Lo único que hace esta pantalla además de guardar el
 * registro es pasar la solicitud a "despachada", para que deje de
 * aparecer como pendiente de despacho.
 */
export default function NuevoDespachoPage() {
  const router = useRouter();
  const operator = currentUser();

  const fetchApproved = useCallback(async () => {
    const page = await pb.collection("requests").getList<ApprovedRequest>(1, 100, {
      filter: 'status = "aprobada"',
      sort: "-created",
    });
    return page.items;
  }, []);

  const { data: requests, error: loadError } = useAsyncData(fetchApproved);

  const [requestId, setRequestId] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [brigade, setBrigade] = useState("");
  const [address, setAddress] = useState<AddressValue>(EMPTY_ADDRESS_VALUE);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selected = requests?.find((request) => request.id === requestId);

  function selectRequest(id: string) {
    setRequestId(id);
    const request = requests?.find((item) => item.id === id);
    if (!request) return;

    // Hereda el punto exacto de la solicitud si ya lo tiene — sigue
    // siendo editable aquí, por si el vehículo termina yendo a un punto
    // distinto del que se marcó al pedir. Las solicitudes de antes de
    // esta función nunca tuvieron coordenadas (quedan en 0/0): en ese
    // caso se arranca del centro de Manizales, como siempre.
    const hasCoords = request.destination_lat !== 0 || request.destination_lng !== 0;
    setAddress({
      destination: request.destination,
      lat: hasCoords ? request.destination_lat : MANIZALES_CENTER[0],
      lng: hasCoords ? request.destination_lng : MANIZALES_CENTER[1],
      streetType: request.street_type ?? "",
      streetNumber: request.street_number ?? "",
      streetPlate: request.street_plate ?? "",
      complement: request.address_complement ?? "",
    });
  }

  async function save() {
    if (!operator) {
      setError("Tu sesión expiró. Vuelve a entrar.");
      return;
    }
    if (!requestId || !driverName.trim() || !address.destination.trim()) {
      setError("Solicitud, conductor y destino son obligatorios.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const dispatch = await pb.collection("dispatches").create({
        request_id: requestId,
        driver_name: driverName,
        driver_phone: driverPhone,
        vehicle_plate: vehiclePlate,
        brigade,
        destination: address.destination,
        destination_lat: address.lat,
        destination_lng: address.lng,
        street_type: address.streetType || null,
        street_number: address.streetNumber,
        street_plate: address.streetPlate,
        address_complement: address.complement,
        dispatch_date: new Date().toISOString().replace("T", " "),
        operator_id: operator.id,
        notes,
      });

      await pb.collection("requests").update(requestId, { status: "despachada" });

      router.push(`/panel/despachos/${dispatch.id}`);
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

  if (!requests) {
    return <LoadingLine />;
  }

  return (
    <div>
      <Link href="/panel/despachos" className="text-sm font-bold text-unal-green-dark">
        ← Despachos
      </Link>

      <h1 className="mt-2 text-2xl font-black tracking-tight">Registrar despacho</h1>

      {requests.length === 0 ? (
        <div className="mt-5 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">No hay solicitudes aprobadas para despachar.</p>
          <p className="mt-1 text-(--ink-2)">
            Aprueba una solicitud desde su detalle antes de registrar el despacho.
          </p>
        </div>
      ) : (
        <section className="mt-5 rounded border border-(--rule) bg-(--surface) p-4">
          <div>
            <label htmlFor="solicitud" className="mb-1 block text-sm font-bold">
              Solicitud aprobada <span className="text-unal-red">*</span>
            </label>
            <select
              id="solicitud"
              value={requestId}
              onChange={(event) => selectRequest(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              <option value="">Selecciona una solicitud…</option>
              {requests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.code} · {request.requester_name} · {request.destination}
                </option>
              ))}
            </select>
          </div>

          {selected ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <span className="mb-1 block text-sm font-bold">
                  Destino <span className="text-unal-red">*</span>
                </span>
                <p className="mb-2 text-xs text-(--muted)">
                  Heredado de la solicitud — ajústalo si el vehículo termina yendo a un punto distinto.
                </p>
                <AddressMapField value={address} onChange={setAddress} />
              </div>

              <div>
                <label htmlFor="conductor" className="mb-1 block text-sm font-bold">
                  Conductor <span className="text-unal-red">*</span>
                </label>
                <input
                  id="conductor"
                  value={driverName}
                  onChange={(event) => setDriverName(event.target.value)}
                  className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                />
              </div>

              <div>
                <label htmlFor="telconductor" className="mb-1 block text-sm font-bold">
                  Teléfono
                </label>
                <input
                  id="telconductor"
                  type="tel"
                  inputMode="tel"
                  value={driverPhone}
                  onChange={(event) => setDriverPhone(event.target.value)}
                  className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                />
              </div>

              <div>
                <label htmlFor="placa" className="mb-1 block text-sm font-bold">
                  Placa del vehículo
                </label>
                <input
                  id="placa"
                  value={vehiclePlate}
                  onChange={(event) => setVehiclePlate(event.target.value)}
                  className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                />
              </div>

              <div>
                <label htmlFor="brigada" className="mb-1 block text-sm font-bold">
                  Brigada <span className="font-normal text-(--muted)">(opcional)</span>
                </label>
                <input
                  id="brigada"
                  value={brigade}
                  onChange={(event) => setBrigade(event.target.value)}
                  className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                />
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
          ) : null}
        </section>
      )}

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      <div className="mt-5 flex gap-3">
        <Button variant="outline" onClick={() => router.back()} className="justify-center">
          Cancelar
        </Button>
        <Button
          onClick={save}
          disabled={saving || !selected}
          loading={saving}
          icon={Truck}
          className="flex-1 justify-center"
        >
          {saving ? "Guardando…" : "Guardar despacho"}
        </Button>
      </div>
    </div>
  );
}
