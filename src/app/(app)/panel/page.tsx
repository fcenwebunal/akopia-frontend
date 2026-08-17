"use client";

import Link from "next/link";
import { useCallback } from "react";
import { pb } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";

interface Summary {
  donationsToday: number;
  itemsPending: number;
  requestsPending: number;
  availableLines: number;
  quarantineLines: number;
}

async function count(collection: string, filter: string): Promise<number> {
  const page = await pb.collection(collection).getList(1, 1, { filter });
  return page.totalItems;
}

/*
 * Los saldos se leen tal como los dejó el backend. El frontend no suma
 * movimientos ni recalcula nada: si un número está mal, está mal en
 * `inventory`, y se corrige con un ajuste, no aquí.
 */
export default function PanelPage() {
  const fetchSummary = useCallback(async (): Promise<Summary> => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = startOfDay.toISOString().replace("T", " ");

    const [
      donationsToday,
      itemsPending,
      requestsPending,
      availableLines,
      quarantineLines,
    ] = await Promise.all([
      count("donations", `created >= "${today}"`),
      count("donation_items", 'classification_status = "pending"'),
      count("requests", 'status = "pendiente"'),
      count("inventory", "available_qty > 0"),
      count("inventory", "quarantine_qty > 0"),
    ]);

    return {
      donationsToday,
      itemsPending,
      requestsPending,
      availableLines,
      quarantineLines,
    };
  }, []);

  const { data: summary, error, reload } = useAsyncData(fetchSummary);

  if (error) {
    return (
      <div>
        <p
          role="alert"
          className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3"
        >
          {error}
        </p>
        <button
          type="button"
          onClick={reload}
          className="mt-4 rounded bg-unal-green-dark px-4 py-2 font-bold text-white"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Resumen de hoy</h1>
      <p className="mt-1 text-(--muted)">
        {new Date().toLocaleDateString("es-CO", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          label="Donaciones recibidas hoy"
          value={summary?.donationsToday}
          tone="green"
        />
        <Metric
          label="Artículos por clasificar"
          value={summary?.itemsPending}
          tone="yellow"
        />
        <Metric
          label="Solicitudes pendientes"
          value={summary?.requestsPending}
          tone="orange"
        />
        <Metric
          label="Productos con saldo disponible"
          value={summary?.availableLines}
          tone="green"
        />
        <Metric
          label="Productos en cuarentena"
          value={summary?.quarantineLines}
          tone="red"
        />
      </div>

      <h2 className="mt-10 text-lg font-bold">Acciones</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Action
          href="/panel/donaciones"
          title="Ver las donaciones"
          body="Lo que ha llegado al centro de acopio, con su código y su fecha."
        />
        <Action
          href="/panel/inventario"
          title="Consultar el inventario"
          body="Qué hay disponible, qué está reservado y qué está retenido."
        />
      </div>
    </div>
  );
}

const TONES = {
  green: "border-unal-green",
  yellow: "border-unal-yellow",
  orange: "border-unal-orange",
  red: "border-unal-red",
} as const;

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | undefined;
  tone: keyof typeof TONES;
}) {
  return (
    <div
      className={`rounded border border-(--rule) border-l-4 ${TONES[tone]} bg-(--surface) p-4`}
    >
      <p className="text-3xl font-black tabular-nums">
        {value === undefined ? <span className="text-(--muted)">—</span> : value}
      </p>
      <p className="mt-1 text-sm text-(--muted)">{label}</p>
    </div>
  );
}

function Action({
  href,
  title,
  body,
}: {
  href: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="rounded border border-(--rule) bg-(--surface) p-4 hover:border-unal-green"
    >
      <p className="font-bold text-unal-green-dark">{title}</p>
      <p className="mt-1 text-sm text-(--ink-2)">{body}</p>
    </Link>
  );
}
