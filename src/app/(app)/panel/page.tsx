"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { pb } from "@/lib/pb";
import { loadCatalog } from "@/lib/catalog";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";
import { StatTile, DistributionBar, HorizontalBarChart, DailyBarChart } from "@/components/panel/charts";

interface InventoryRow {
  product_id: string;
  available_qty: number;
  reserved_qty: number;
  quarantine_qty: number;
}

interface Dashboard {
  itemsPending: number;
  requestsPending: number;
  requestsUrgent: number;
  dispatchesAwaitingConfirmation: number;
  belowMinimum: { name: string; available: number; min: number }[];
  distribution: { available: number; reserved: number; quarantine: number };
  byGroup: { label: string; value: number }[];
  donationsByDay: { key: string; label: string; value: number; isToday: boolean }[];
  donationsInPeriod: number;
}

async function count(collection: string, filter: string): Promise<number> {
  const page = await pb.collection(collection).getList(1, 1, { filter });
  return page.totalItems;
}

const DAY_LABELS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const HISTORY_DAYS = 14;

/*
 * Todo lo que se ve aquí sale de una lectura directa de PocketBase, sin
 * recalcular saldos: si un número está mal, está mal en `inventory` y se
 * corrige con un ajuste, no en esta pantalla. Las cantidades sumadas
 * entre productos (distribución, por grupo) mezclan unidades distintas
 * (kg, litros, unidades…) a propósito, como referencia agregada — igual
 * que ya hace `/api/inventory/summary` en el backend — no como una cifra
 * con precisión dimensional.
 */
export default function PanelPage() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async (): Promise<Dashboard> => {
    const since = new Date();
    since.setDate(since.getDate() - (HISTORY_DAYS - 1));
    since.setHours(0, 0, 0, 0);

    const [
      catalog,
      inventoryRows,
      donations,
      itemsPending,
      requestsPending,
      requestsUrgent,
      dispatchesAwaitingConfirmation,
    ] = await Promise.all([
      loadCatalog(),
      pb.collection("inventory").getFullList<InventoryRow>({
        fields: "product_id,available_qty,reserved_qty,quarantine_qty",
      }),
      pb.collection("donations").getFullList<{ created: string }>({
        filter: `created >= "${since.toISOString().replace("T", " ")}"`,
        fields: "created",
      }),
      count("donation_items", 'classification_status = "pending"'),
      count("requests", 'status = "pendiente"'),
      count("requests", 'status = "pendiente" && (priority = "alta" || priority = "critica")'),
      count("dispatches", 'request_id.status = "despachada"'),
    ]);

    const productById = new Map(catalog.products.map((p) => [p.id, p]));
    const categoryById = new Map(catalog.categories.map((c) => [c.id, c]));
    const groupById = new Map(catalog.groups.map((g) => [g.id, g]));

    // Distribución de las tres cubetas, tal como las define el backend.
    const distribution = { available: 0, reserved: 0, quarantine: 0 };

    // Saldo por producto (una fila de inventory por producto+ubicación,
    // varias ubicaciones pueden sumar el mismo producto).
    const availableByProduct = new Map<string, number>();
    // Cuántos productos con saldo disponible tiene cada grupo — no la
    // cantidad sumada, que mezclaría kilos con litros con unidades.
    const productsByGroup = new Map<string, Set<string>>();

    for (const row of inventoryRows) {
      distribution.available += row.available_qty || 0;
      distribution.reserved += row.reserved_qty || 0;
      distribution.quarantine += row.quarantine_qty || 0;

      availableByProduct.set(
        row.product_id,
        (availableByProduct.get(row.product_id) ?? 0) + (row.available_qty || 0)
      );

      if (row.available_qty > 0) {
        const product = productById.get(row.product_id);
        const category = product ? categoryById.get(product.category_id) : undefined;
        const group = category ? groupById.get(category.group_id) : undefined;
        if (group) {
          if (!productsByGroup.has(group.name)) productsByGroup.set(group.name, new Set());
          productsByGroup.get(group.name)!.add(row.product_id);
        }
      }
    }

    const byGroup = Array.from(productsByGroup.entries())
      .map(([label, products]) => ({ label, value: products.size }))
      .sort((a, b) => b.value - a.value);

    const byGroupTop = byGroup.slice(0, 7);
    const otherCount = byGroup.slice(7).reduce((sum, g) => sum + g.value, 0);
    if (otherCount > 0) byGroupTop.push({ label: "Otros grupos", value: otherCount });

    const belowMinimum = catalog.products
      .filter((p) => (p.min_stock_alert ?? 0) > 0)
      .map((p) => ({
        name: p.name,
        available: availableByProduct.get(p.id) ?? 0,
        min: p.min_stock_alert ?? 0,
      }))
      .filter((p) => p.available < p.min)
      .sort((a, b) => a.available - b.available)
      .slice(0, 6);

    const dayBuckets = new Map<string, number>();
    for (const donation of donations) {
      const day = donation.created.slice(0, 10);
      dayBuckets.set(day, (dayBuckets.get(day) ?? 0) + 1);
    }

    const donationsByDay: Dashboard["donationsByDay"] = [];
    const todayKey = new Date().toISOString().slice(0, 10);
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      donationsByDay.push({
        key,
        label: DAY_LABELS[day.getDay()],
        value: dayBuckets.get(key) ?? 0,
        isToday: key === todayKey,
      });
    }

    return {
      itemsPending,
      requestsPending,
      requestsUrgent,
      dispatchesAwaitingConfirmation,
      belowMinimum,
      distribution,
      byGroup: byGroupTop,
      donationsByDay,
      donationsInPeriod: donations.length,
    };
  }, []);

  const { data: dashboard, error, reload } = useAsyncData(fetchDashboard);

  useEffect(() => {
    if (dashboard) setLastUpdated(new Date());
  }, [dashboard]);

  // Se refresca solo cada 45s — sin llegar a una suscripción en tiempo
  // real por cada colección, que es mucha complejidad para un panel de
  // lectura. Quien necesite el dato al segundo tiene el botón manual.
  useEffect(() => {
    const interval = setInterval(reload, 45000);
    return () => clearInterval(interval);
  }, [reload]);

  if (error) {
    return (
      <div>
        <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
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

  if (!dashboard) {
    return <LoadingLine />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Resumen</h1>
          <p className="mt-1 text-(--muted)">
            {new Date().toLocaleDateString("es-CO", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="text-xs font-bold text-(--muted) hover:text-unal-green-dark"
        >
          {lastUpdated
            ? `Actualizado ${lastUpdated.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })} · actualizar`
            : "Actualizar"}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Artículos por clasificar"
          value={dashboard.itemsPending}
          tone={dashboard.itemsPending > 0 ? "warning" : "good"}
          href="/panel/donaciones"
        />
        <StatTile
          label="Solicitudes pendientes"
          value={dashboard.requestsPending}
          hint={dashboard.requestsUrgent > 0 ? `${dashboard.requestsUrgent} de prioridad alta o crítica` : undefined}
          tone={dashboard.requestsUrgent > 0 ? "warning" : "neutral"}
          href="/panel/solicitudes"
        />
        <StatTile
          label="Despachos por confirmar"
          value={dashboard.dispatchesAwaitingConfirmation}
          tone={dashboard.dispatchesAwaitingConfirmation > 0 ? "warning" : "good"}
          href="/panel/despachos"
        />
        <StatTile
          label="Productos bajo el mínimo"
          value={dashboard.belowMinimum.length}
          hint={dashboard.belowMinimum.length === 0 ? "Todo en orden" : undefined}
          tone={dashboard.belowMinimum.length > 0 ? "critical" : "good"}
          href="/panel/inventario"
        />
      </div>

      {dashboard.belowMinimum.length > 0 ? (
        <section className="mt-4 rounded border border-unal-red bg-(--surface) p-4">
          <h2 className="text-sm font-bold text-unal-red">Bajo el mínimo definido</h2>
          <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
            {dashboard.belowMinimum.map((p) => (
              <li key={p.name} className="flex justify-between gap-2">
                <span>{p.name}</span>
                <span className="tabular-nums text-(--muted)">
                  {p.available} / {p.min}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded border border-(--rule) bg-(--surface) p-4">
          <h2 className="text-sm font-bold">Distribución del inventario</h2>
          <p className="mt-0.5 text-xs text-(--muted)">
            Cada producto en su propia unidad, sumado como referencia agregada.
          </p>
          <div className="mt-4">
            <DistributionBar
              segments={[
                { label: "Disponible", value: dashboard.distribution.available, color: "var(--viz-available)" },
                { label: "Reservado", value: dashboard.distribution.reserved, color: "var(--viz-reserved)" },
                { label: "Cuarentena", value: dashboard.distribution.quarantine, color: "var(--viz-quarantine)" },
              ]}
            />
          </div>
        </section>

        <section className="rounded border border-(--rule) bg-(--surface) p-4">
          <h2 className="text-sm font-bold">Productos con existencia por grupo</h2>
          <p className="mt-0.5 text-xs text-(--muted)">
            Cuántas referencias distintas tienen saldo disponible hoy.
          </p>
          <div className="mt-4">
            {dashboard.byGroup.length > 0 ? (
              <HorizontalBarChart rows={dashboard.byGroup} unitLabel="productos" />
            ) : (
              <p className="text-sm text-(--muted)">Sin existencias todavía.</p>
            )}
          </div>
        </section>
      </div>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-bold">Donaciones — últimos 14 días</h2>
          <p className="text-xs text-(--muted)">{dashboard.donationsInPeriod} en el período</p>
        </div>
        <div className="mt-4">
          <DailyBarChart days={dashboard.donationsByDay} />
        </div>
      </section>

      <h2 className="mt-8 text-lg font-bold">Acciones</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Action href="/panel/donaciones/nueva" title="Registrar donación" body="Lo que acaba de llegar." />
        <Action href="/panel/solicitudes/nueva" title="Nueva solicitud" body="Un pedido para alguien." />
        <Action href="/panel/inventario" title="Consultar inventario" body="Qué hay, qué está reservado, qué está retenido." />
        <Action href="/panel/despachos" title="Ver despachos" body="Lo que va saliendo hacia su destino." />
      </div>
    </div>
  );
}

function Action({ href, title, body }: { href: string; title: string; body: string }) {
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
