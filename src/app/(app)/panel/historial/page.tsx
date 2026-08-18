"use client";

import { useCallback, useMemo, useState } from "react";
import { currentUser, pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";

type Action = "create" | "update" | "delete" | "status_change" | "login" | "logout";

interface FieldChange {
  field: string;
  old_value: unknown;
  new_value: unknown;
}

interface AuditEntry {
  id: string;
  entity_type: string;
  entity_id: string;
  action: Action;
  changes: { changes?: FieldChange[]; data?: Record<string, unknown> } | null;
  notes: string;
  created: string;
  expand?: { operator_id?: { full_name?: string } };
}

const ENTITY_LABELS: Record<string, string> = {
  donations: "Donación",
  donation_items: "Artículo de donación",
  requests: "Solicitud",
  request_items: "Renglón de solicitud",
  reservations: "Reserva",
  dispatches: "Despacho",
  deliveries: "Entrega",
  users: "Usuario",
};

const ACTION_LABELS: Record<Action, string> = {
  create: "Creado",
  update: "Actualizado",
  delete: "Eliminado",
  status_change: "Cambio de estado",
  login: "Inicio de sesión",
  logout: "Cierre de sesión",
};

const ACTION_STYLES: Record<Action, string> = {
  create: "bg-unal-green-soft text-unal-green-dark",
  update: "bg-(--surface-2) text-unal-aqua",
  status_change: "bg-(--surface-2) text-unal-orange",
  delete: "bg-(--surface-2) text-unal-red",
  login: "bg-(--surface-2) text-(--ink-2)",
  logout: "bg-(--surface-2) text-(--ink-2)",
};

/*
 * Solo lectura: nada aquí escribe en audit_log. Los hooks del backend ya
 * lo llenan solos en cada create/update de las 8 colecciones que
 * auditan (04_audit.pb.js) — esta pantalla únicamente lo muestra.
 */
export default function HistorialPage() {
  const admin = currentUser();
  const [entityFilter, setEntityFilter] = useState("");

  const fetchEntries = useCallback(async () => {
    const page = await pb.collection("audit_log").getList<AuditEntry>(1, 200, {
      sort: "-created",
      expand: "operator_id",
    });
    return page.items;
  }, []);

  const { data: entries, error } = useAsyncData(fetchEntries);

  const filtered = useMemo(() => {
    if (!entries) return [];
    return entityFilter
      ? entries.filter((entry) => entry.entity_type === entityFilter)
      : entries;
  }, [entries, entityFilter]);

  if (admin && admin.role !== "admin") {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es solo para administradores.
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {error}
      </p>
    );
  }

  if (!entries) {
    return <LoadingLine />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Historial</h1>
          <p className="mt-1 text-(--muted)">
            Quién cambió qué, y cuándo. Lo escriben solos los hooks del
            backend en cada operación — nadie edita esto a mano.
          </p>
        </div>

        <select
          value={entityFilter}
          onChange={(event) => setEntityFilter(event.target.value)}
          className="rounded border border-(--rule) bg-(--surface) px-3 py-2.5 text-sm"
        >
          <option value="">Todas las entidades</option>
          {Object.entries(ENTITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">No hay movimientos que mostrar.</p>
        </div>
      ) : (
        <ul className="mt-6 space-y-2">
          {filtered.map((entry) => (
            <li
              key={entry.id}
              className="rounded border border-(--rule) bg-(--surface) p-4"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-bold ${ACTION_STYLES[entry.action]}`}
                >
                  {ACTION_LABELS[entry.action] ?? entry.action}
                </span>
                <span className="font-medium">
                  {ENTITY_LABELS[entry.entity_type] ?? entry.entity_type}
                </span>
                <span className="ml-auto text-sm text-(--muted)">
                  {new Date(entry.created).toLocaleString("es-CO", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              <p className="mt-1 text-sm text-(--muted)">
                {entry.expand?.operator_id?.full_name ?? "Operador desconocido"}
              </p>

              {entry.changes?.changes && entry.changes.changes.length > 0 ? (
                <ul className="mt-2 space-y-0.5 text-sm">
                  {entry.changes.changes.map((change) => (
                    <li key={change.field}>
                      <span className="font-mono text-xs text-(--muted)">
                        {change.field}
                      </span>{" "}
                      {String(change.old_value ?? "—")} →{" "}
                      <strong>{String(change.new_value ?? "—")}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
