"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { PackageSearch, ClipboardList } from "lucide-react";
import { currentUser, pb } from "@/lib/pb";
import { hasAnyRole } from "@/lib/roles";
import { normalize } from "@/lib/catalog";
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
  const operator = currentUser();
  const canCreate = hasAnyRole(operator?.role, ["admin", "coordinacion", "salida"]);

  const fetchRequests = useCallback(async () => {
    const page = await pb.collection("requests").getList<Request>(1, 50, {
      sort: "-created",
    });
    return page.items;
  }, []);

  const { data: requests, error } = useAsyncData(fetchRequests);

  const [query, setQuery] = useState("");

  const filteredRequests = useMemo(() => {
    if (!requests) return requests;
    const needle = normalize(query.trim());
    if (!needle) return requests;
    return requests.filter((request) => {
      const haystack = [request.code, request.requester_name, request.destination]
        .filter(Boolean)
        .join(" ");
      return normalize(haystack).includes(needle);
    });
  }, [requests, query]);

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
          {canCreate ? (
            <LinkButton href="/panel/solicitudes/nueva" icon={ClipboardList}>
              Registrar solicitud
            </LinkButton>
          ) : null}
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
        <div className="mt-6">
          <label className="sr-only" htmlFor="buscar-solicitudes">
            Buscar solicitud
          </label>
          <input
            id="buscar-solicitudes"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por solicitante, destino o código…"
            autoComplete="off"
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5 sm:max-w-sm"
          />
        </div>
      ) : null}

      {filteredRequests !== null && requests && requests.length > 0 && filteredRequests.length === 0 ? (
        <p className="mt-6 text-(--muted)">Ninguna solicitud coincide con la búsqueda.</p>
      ) : null}

      {filteredRequests !== null && filteredRequests.length > 0 ? (
        <ul className="mt-6 space-y-2">
          {filteredRequests.map((request) => (
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
