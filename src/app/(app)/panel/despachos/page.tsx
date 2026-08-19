"use client";

import Link from "next/link";
import { useCallback } from "react";
import { Truck } from "lucide-react";
import { pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";
import { LinkButton } from "@/components/ui/button";

interface Dispatch {
  id: string;
  code: string;
  destination: string;
  driver_name: string;
  dispatch_date: string;
  expand?: {
    request_id?: { code?: string; status?: string };
  };
}

const REQUEST_STATUS_LABELS: Record<string, string> = {
  despachada: "En ruta",
  entregada: "Entregado",
  cancelada: "Cancelado",
};

const REQUEST_STATUS_STYLES: Record<string, string> = {
  despachada: "bg-unal-yellow/20 text-unal-orange",
  entregada: "bg-unal-green-soft text-unal-green-dark",
  cancelada: "bg-(--surface-2) text-(--ink-2)",
};

export default function DespachosPage() {
  const fetchDispatches = useCallback(async () => {
    const page = await pb.collection("dispatches").getList<Dispatch>(1, 50, {
      sort: "-created",
      expand: "request_id",
    });
    return page.items;
  }, []);

  const { data: dispatches, error } = useAsyncData(fetchDispatches);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Despachos</h1>
          <p className="mt-1 text-(--muted)">
            Salidas registradas y su estado de entrega.
          </p>
        </div>
        <LinkButton href="/panel/despachos/nueva" icon={Truck}>
          Registrar despacho
        </LinkButton>
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      {dispatches === null && !error ? (
        <div className="mt-6">
          <LoadingLine />
        </div>
      ) : null}

      {dispatches !== null && dispatches.length === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">Todavía no hay despachos registrados.</p>
          <p className="mt-1 text-(--ink-2)">
            Se despachan las solicitudes que ya están aprobadas.
          </p>
        </div>
      ) : null}

      {dispatches !== null && dispatches.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {dispatches.map((dispatch) => {
            const status = dispatch.expand?.request_id?.status ?? "despachada";
            return (
              <li key={dispatch.id}>
                <Link
                  href={`/panel/despachos/${dispatch.id}`}
                  className="block rounded border border-(--rule) bg-(--surface) p-4 hover:border-unal-green"
                >
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-bold text-unal-green-dark">{dispatch.destination}</span>
                    <span
                      className={`rounded px-2 py-0.5 text-xs font-bold ${REQUEST_STATUS_STYLES[status] ?? "bg-(--surface-2) text-(--ink-2)"}`}
                    >
                      {REQUEST_STATUS_LABELS[status] ?? status}
                    </span>
                    <span className="ml-auto text-sm text-(--muted)">
                      {new Date(dispatch.dispatch_date).toLocaleDateString("es-CO", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-(--muted)">
                    <span className="font-mono">{dispatch.code}</span>
                    <span>· conduce {dispatch.driver_name}</span>
                    {dispatch.expand?.request_id?.code ? (
                      <span>· {dispatch.expand.request_id.code}</span>
                    ) : null}
                  </p>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
