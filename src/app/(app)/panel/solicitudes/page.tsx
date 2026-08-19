"use client";

import Link from "next/link";
import { useCallback } from "react";
import { PackageSearch, ClipboardList } from "lucide-react";
import { pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LinkButton } from "@/components/ui/button";

interface Request {
  id: string;
  code: string;
  requester_name: string;
  destination: string;
  priority: "baja" | "media" | "alta" | "critica";
  status:
    | "pendiente"
    | "aprobada"
    | "rechazada"
    | "en_preparacion"
    | "despachada"
    | "entregada"
    | "cancelada";
  created: string;
}

const PRIORITY_STYLES: Record<Request["priority"], string> = {
  baja: "bg-(--surface-2) text-(--ink-2)",
  media: "bg-(--surface-2) text-unal-aqua",
  alta: "bg-(--surface-2) text-unal-orange",
  critica: "bg-(--surface-2) text-unal-red",
};

const STATUS_LABELS: Record<Request["status"], string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  en_preparacion: "En preparación",
  despachada: "Despachada",
  entregada: "Entregada",
  cancelada: "Cancelada",
};

const STATUS_STYLES: Record<Request["status"], string> = {
  pendiente: "bg-unal-yellow/20 text-unal-orange",
  aprobada: "bg-unal-green-soft text-unal-green-dark",
  rechazada: "bg-(--surface-2) text-unal-red",
  en_preparacion: "bg-unal-green-soft text-unal-green-dark",
  despachada: "bg-unal-green-soft text-unal-green-dark",
  entregada: "bg-(--surface-2) text-(--ink-2)",
  cancelada: "bg-(--surface-2) text-(--ink-2)",
};

export default function SolicitudesPage() {
  const fetchRequests = useCallback(async () => {
    const page = await pb.collection("requests").getList<Request>(1, 50, {
      sort: "-created",
    });
    return page.items;
  }, []);

  const { data: requests, error } = useAsyncData(fetchRequests);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Solicitudes</h1>
          <p className="mt-1 text-(--muted)">
            Ayuda pedida por la comunidad, en el orden en que llegó.
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/panel/solicitudes/faltantes" variant="outline" icon={PackageSearch}>
            Productos faltantes
          </LinkButton>
          <LinkButton href="/panel/solicitudes/nueva" icon={ClipboardList}>
            Registrar solicitud
          </LinkButton>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-6 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3"
        >
          {error}
        </p>
      ) : null}

      {requests === null && !error ? (
        <p className="mt-6 text-(--muted)">Cargando…</p>
      ) : null}

      {requests !== null && requests.length === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">Todavía no hay solicitudes registradas.</p>
        </div>
      ) : null}

      {requests !== null && requests.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {requests.map((request) => (
            <li key={request.id}>
              <Link
                href={`/panel/solicitudes/${request.id}`}
                className="block rounded border border-(--rule) bg-(--surface) p-4 hover:border-unal-green"
              >
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-bold text-unal-green-dark">{request.requester_name}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${PRIORITY_STYLES[request.priority]}`}
                  >
                    {request.priority}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-bold ${STATUS_STYLES[request.status]}`}
                  >
                    {STATUS_LABELS[request.status]}
                  </span>
                  <span className="ml-auto text-sm text-(--muted)">
                    {new Date(request.created).toLocaleDateString("es-CO", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-(--muted)">
                  <span className="font-mono">{request.code}</span>
                  <span>· {request.destination}</span>
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
