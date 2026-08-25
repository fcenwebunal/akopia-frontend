"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Gift, ClipboardList, Package, Truck, type LucideIcon } from "lucide-react";
import { pb } from "@/lib/pb";
import { CutIcon } from "@/components/ui/cut-icon";
import { loadCatalog } from "@/lib/catalog";
import { loadLocations, locationLabel } from "@/lib/locations";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";
import {
  StatTile,
  DistributionBar,
  HorizontalBarChart,
  DailyBarChart,
  DonutChart,
  NumberTable,
} from "@/components/panel/charts";
import { fetchMissingProducts, type MissingProduct } from "@/lib/missing-products";
import { MissingProductsList } from "@/components/inventory/missing-products-list";
import { fetchDispatchLocations, type DispatchLocation } from "@/lib/dispatch-locations";

// Leaflet toca `window` al cargarse: sin `ssr: false` el render en
// servidor de esta página truena.
const HelpMap = dynamic(() => import("@/components/panel/help-map").then((m) => m.HelpMap), {
  ssr: false,
  loading: () => <div className="h-72 w-full rounded border border-(--rule) bg-(--surface-2)" />,
});

interface InventoryRow {
  product_id: string;
  location_id: string;
  available_qty: number;
  reserved_qty: number;
  quarantine_qty: number;
}

interface LocationStock {
  label: string;
  available: number;
  reserved: number;
  quarantine: number;
}

const DONOR_TYPE_LABELS: Record<string, string> = {
  individual: "Persona",
  empresa: "Empresa",
  institucion: "Institución",
  anonimo: "Anónimo",
};

// Mismo orden fijo en el que se validó la paleta (ver globals.css) — el
// color sigue a la identidad del tipo de donante, nunca a su posición.
const DONOR_TYPE_ORDER = ["individual", "empresa", "institucion", "anonimo"];
const DONOR_TYPE_COLORS: Record<string, string> = {
  individual: "var(--viz-donor-individual)",
  empresa: "var(--viz-donor-empresa)",
  institucion: "var(--viz-donor-institucion)",
  anonimo: "var(--viz-donor-anonimo)",
};

interface Dashboard {
  itemsPending: number;
  requestsPending: number;
  requestsUrgent: number;
  dispatchesAwaitingConfirmation: number;
  donationsTotal: number;
  dispatchesRealizedTotal: number;
  missingProducts: MissingProduct[];
  distribution: { available: number; reserved: number; quarantine: number };
  byGroup: { label: string; value: number }[];
  byCategory: { label: string; value: number }[];
  productsMissingWeight: number;
  inventoryByLocation: LocationStock[];
  donorTypeBreakdown: { label: string; value: number; color: string }[];
  activityDays: { key: string; label: string; isToday: boolean }[];
  activitySeries: { label: string; color: string; values: Record<string, number> }[];
  activityInPeriod: number;
  helpLocations: DispatchLocation[];
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
 * corrige con un ajuste, no en esta pantalla. La distribución (tres
 * cubetas) y el saldo por ubicación siguen sumando cantidad cruda,
 * mezclando kg/litros/unidades a propósito, como referencia agregada —
 * igual que ya hace `/api/inventory/summary` en el backend.
 *
 * Por grupo y por categoría, en cambio, sí conviene un total que
 * signifique algo real: se convierte cada renglón a kilogramos usando
 * `product.weight_kg` (cuántos kg pesa una unidad de la medida por
 * defecto del producto — ver migración 059 del backend), y se suma eso.
 * Es una estimación, no una báscula: el peso es un dato de catálogo
 * cargado a mano (tamaños típicos de empaque), no medido remesa por
 * remesa. Un producto sin peso asignado queda fuera de la suma — se
 * cuenta cuántos son para no fingir que el total incluye todo.
 */
export default function PanelPage() {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async (): Promise<Dashboard> => {
    const since = new Date();
    since.setDate(since.getDate() - (HISTORY_DAYS - 1));
    since.setHours(0, 0, 0, 0);
    const sinceFilter = since.toISOString().replace("T", " ");

    const [
      catalog,
      inventoryRows,
      locations,
      donations,
      dispatchesRecent,
      itemsPending,
      requestsPending,
      requestsUrgent,
      dispatchesAwaitingConfirmation,
      dispatchesRealizedTotal,
      missingProducts,
      helpLocations,
    ] = await Promise.all([
      loadCatalog(),
      pb.collection("inventory").getFullList<InventoryRow>({
        fields: "product_id,location_id,available_qty,reserved_qty,quarantine_qty",
      }),
      loadLocations(),
      // Todas las donaciones, no solo las del período: alimenta el
      // total de la tarjeta, el desglose por tipo de donante Y el
      // conteo por día — una sola lectura en vez de tres.
      pb.collection("donations").getFullList<{ created: string; donor_type: string }>({
        fields: "created,donor_type",
      }),
      pb.collection("dispatches").getFullList<{ dispatch_date: string }>({
        filter: `dispatch_date >= "${sinceFilter}"`,
        fields: "dispatch_date",
      }),
      count("donation_items", 'classification_status = "pending"'),
      count("requests", 'status = "pendiente"'),
      count("requests", 'status = "pendiente" && (priority = "alta" || priority = "critica")'),
      count("dispatches", 'request_id.status = "despachada"'),
      // Un despacho "realizado" es uno con entrega confirmada — la
      // colección `deliveries` solo tiene un registro cuando eso ya
      // pasó (`confirm-delivery`, ruta propia del backend).
      count("deliveries", ""),
      fetchMissingProducts(),
      fetchDispatchLocations(),
    ]);

    const productById = new Map(catalog.products.map((p) => [p.id, p]));
    const categoryById = new Map(catalog.categories.map((c) => [c.id, c]));
    const groupById = new Map(catalog.groups.map((g) => [g.id, g]));
    const locationById = new Map(locations.map((l) => [l.id, l]));

    // Distribución de las tres cubetas, tal como las define el backend.
    const distribution = { available: 0, reserved: 0, quarantine: 0 };

    // Kilos en inventario por grupo/categoría — `available_qty` del
    // producto convertida con su `weight_kg` (ver comentario de arriba).
    const kgByGroup = new Map<string, number>();
    const kgByCategory = new Map<string, number>();
    const productsWithoutWeight = new Set<string>();

    // Saldo por ubicación, sumado en las mismas tres cubetas — la
    // ubicación vacía ("Por Ubicar") es su propio renglón, como en
    // /panel/inventario.
    const stockByLocationId = new Map<string, LocationStock>();

    for (const row of inventoryRows) {
      distribution.available += row.available_qty || 0;
      distribution.reserved += row.reserved_qty || 0;
      distribution.quarantine += row.quarantine_qty || 0;

      const locationKey = row.location_id || "";
      const bucket = stockByLocationId.get(locationKey) ?? {
        label: locationKey ? locationLabel(locationById.get(locationKey)) : "Por Ubicar",
        available: 0,
        reserved: 0,
        quarantine: 0,
      };
      bucket.available += row.available_qty || 0;
      bucket.reserved += row.reserved_qty || 0;
      bucket.quarantine += row.quarantine_qty || 0;
      stockByLocationId.set(locationKey, bucket);

      if (row.available_qty > 0) {
        const product = productById.get(row.product_id);
        const category = product ? categoryById.get(product.category_id) : undefined;
        const group = category ? groupById.get(category.group_id) : undefined;

        if (!product || product.weight_kg == null) {
          if (product) productsWithoutWeight.add(product.id);
        } else {
          const kg = row.available_qty * product.weight_kg;
          if (group) kgByGroup.set(group.name, (kgByGroup.get(group.name) ?? 0) + kg);
          if (category) kgByCategory.set(category.name, (kgByCategory.get(category.name) ?? 0) + kg);
        }
      }
    }

    const byGroup = Array.from(kgByGroup.entries())
      .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.value - a.value);

    const byCategory = Array.from(kgByCategory.entries())
      .map(([label, value]) => ({ label, value: Math.round(value * 10) / 10 }))
      .sort((a, b) => b.value - a.value);

    const inventoryByLocation = Array.from(stockByLocationId.values())
      .filter((row) => row.available > 0 || row.reserved > 0 || row.quarantine > 0)
      .sort((a, b) => b.available + b.reserved + b.quarantine - (a.available + a.reserved + a.quarantine));

    const donorCounts = new Map<string, number>();
    for (const donation of donations) {
      const key = DONOR_TYPE_LABELS[donation.donor_type] ? donation.donor_type : "anonimo";
      donorCounts.set(key, (donorCounts.get(key) ?? 0) + 1);
    }
    const donorTypeBreakdown = DONOR_TYPE_ORDER.map((key) => ({
      label: DONOR_TYPE_LABELS[key],
      value: donorCounts.get(key) ?? 0,
      color: DONOR_TYPE_COLORS[key],
    }));

    const donationsByDay = new Map<string, number>();
    for (const donation of donations) {
      const day = donation.created.slice(0, 10);
      donationsByDay.set(day, (donationsByDay.get(day) ?? 0) + 1);
    }
    const dispatchesByDay = new Map<string, number>();
    for (const dispatch of dispatchesRecent) {
      const day = dispatch.dispatch_date.slice(0, 10);
      dispatchesByDay.set(day, (dispatchesByDay.get(day) ?? 0) + 1);
    }

    const activityDays: Dashboard["activityDays"] = [];
    const todayKey = new Date().toISOString().slice(0, 10);
    for (let i = HISTORY_DAYS - 1; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      const key = day.toISOString().slice(0, 10);
      activityDays.push({ key, label: DAY_LABELS[day.getDay()], isToday: key === todayKey });
    }

    const activityInPeriod =
      activityDays.reduce((sum, d) => sum + (donationsByDay.get(d.key) ?? 0), 0) +
      Array.from(dispatchesByDay.values()).reduce((sum, v) => sum + v, 0);

    return {
      itemsPending,
      requestsPending,
      requestsUrgent,
      dispatchesAwaitingConfirmation,
      donationsTotal: donations.length,
      dispatchesRealizedTotal,
      missingProducts,
      distribution,
      byGroup,
      byCategory,
      productsMissingWeight: productsWithoutWeight.size,
      inventoryByLocation,
      donorTypeBreakdown,
      activityDays,
      activitySeries: [
        { label: "Donaciones", color: "var(--viz-available)", values: Object.fromEntries(donationsByDay) },
        { label: "Despachos", color: "var(--viz-reserved)", values: Object.fromEntries(dispatchesByDay) },
      ],
      activityInPeriod,
      helpLocations,
    };
  }, []);

  const { data: dashboard, error, reload } = useAsyncData(fetchDashboard);

  // Ajuste de estado derivado de una prop-como-valor durante el propio
  // render (patrón que ya documenta este proyecto para este caso, ver
  // `DecimalInput`), en vez de un `useEffect` que dispara un
  // renderizado en cascada.
  const [lastSeenDashboard, setLastSeenDashboard] = useState<Dashboard | null>(null);
  if (dashboard && dashboard !== lastSeenDashboard) {
    setLastSeenDashboard(dashboard);
    setLastUpdated(new Date());
  }

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
      <h1 className="text-2xl font-black tracking-tight">Acciones</h1>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Action href="/panel/donaciones/nueva" title="Registrar donación" body="Lo que acaba de llegar." icon={Gift} />
        <Action href="/panel/solicitudes/nueva" title="Nueva solicitud" body="Un pedido para alguien." icon={ClipboardList} />
        <Action
          href="/panel/inventario"
          title="Consultar inventario"
          body="Qué hay, qué está reservado, qué está retenido."
          icon={Package}
        />
        <Action href="/panel/despachos" title="Ver despachos" body="Lo que va saliendo hacia su destino." icon={Truck} />
      </div>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black tracking-tight">Resumen</h2>
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

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Artículos por clasificar"
          value={dashboard.itemsPending}
          tone={dashboard.itemsPending > 0 ? "warning" : "good"}
          href="/panel/donaciones"
          icon={Gift}
        />
        <StatTile
          label="Solicitudes pendientes"
          value={dashboard.requestsPending}
          hint={dashboard.requestsUrgent > 0 ? `${dashboard.requestsUrgent} de prioridad alta o crítica` : undefined}
          tone={dashboard.requestsUrgent > 0 ? "warning" : "neutral"}
          href="/panel/solicitudes"
          icon={ClipboardList}
        />
        <StatTile
          label="Despachos por confirmar"
          value={dashboard.dispatchesAwaitingConfirmation}
          tone={dashboard.dispatchesAwaitingConfirmation > 0 ? "warning" : "good"}
          href="/panel/despachos"
          icon={Truck}
        />
        <StatTile
          label="Productos solicitados faltantes"
          value={dashboard.missingProducts.length}
          hint={dashboard.missingProducts.length === 0 ? "Todo cubierto" : undefined}
          tone={dashboard.missingProducts.length > 0 ? "critical" : "good"}
          href="/panel/solicitudes/faltantes"
          icon={Package}
        />
        <StatTile
          label="Donaciones recibidas"
          value={dashboard.donationsTotal}
          hint="Histórico"
          tone="good"
          href="/panel/donaciones"
          icon={Gift}
        />
        <StatTile
          label="Despachos realizados"
          value={dashboard.dispatchesRealizedTotal}
          hint="Histórico"
          tone="good"
          href="/panel/despachos"
          icon={Truck}
        />
      </div>

      {dashboard.missingProducts.length > 0 ? (
        <section className="mt-4 rounded border border-unal-red bg-(--surface) p-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-unal-red">
              Solicitado sin stock suficiente
            </h3>
            <Link
              href="/panel/solicitudes/faltantes"
              className="text-xs font-bold text-unal-green-dark hover:underline"
            >
              Ver todo
            </Link>
          </div>
          <div className="mt-3">
            <MissingProductsList items={dashboard.missingProducts.slice(0, 3)} title="" />
          </div>
        </section>
      ) : null}

      <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4">
        <section className="rounded border border-(--rule) bg-(--surface) p-3 sm:p-4">
          <h3 className="text-sm font-bold">Distribución del inventario</h3>
          <p className="mt-0.5 text-xs text-(--muted)">
            Cada producto en su propia unidad, sumado como referencia agregada.
          </p>
          <div className="mt-4">
            <DistributionBar
              segments={[
                { label: "Disponible", value: dashboard.distribution.available, color: "var(--viz-available)" },
                { label: "Reservado", value: dashboard.distribution.reserved, color: "var(--viz-reserved)" },
                { label: "En Revisión", value: dashboard.distribution.quarantine, color: "var(--viz-quarantine)" },
              ]}
            />
          </div>
        </section>

        <section className="rounded border border-(--rule) bg-(--surface) p-3 sm:p-4">
          <h3 className="text-sm font-bold">Tipo de donante</h3>
          <p className="mt-0.5 text-xs text-(--muted)">Donaciones recibidas, histórico.</p>
          <div className="mt-4">
            {dashboard.donationsTotal > 0 ? (
              <DonutChart segments={dashboard.donorTypeBreakdown} centerLabel="donaciones" />
            ) : (
              <p className="text-sm text-(--muted)">Sin donaciones todavía.</p>
            )}
          </div>
        </section>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4">
        <section className="rounded border border-(--rule) bg-(--surface) p-3 sm:p-4">
          <h3 className="text-sm font-bold">Kilos en inventario por grupo</h3>
          <p className="mt-0.5 text-xs text-(--muted)">
            Disponible hoy, convertido a kg (estimado — ver peso por producto en Catálogo).
          </p>
          <div className="mt-4">
            {dashboard.byGroup.length > 0 ? (
              <HorizontalBarChart rows={dashboard.byGroup} unitLabel="kg" maxVisibleRows={5} />
            ) : (
              <p className="text-sm text-(--muted)">Sin existencias con peso registrado todavía.</p>
            )}
          </div>
        </section>

        <section className="rounded border border-(--rule) bg-(--surface) p-3 sm:p-4">
          <h3 className="text-sm font-bold">Kilos en inventario por categoría</h3>
          <p className="mt-0.5 text-xs text-(--muted)">
            Disponible hoy, convertido a kg (estimado — ver peso por producto en Catálogo).
          </p>
          <div className="mt-4">
            {dashboard.byCategory.length > 0 ? (
              <HorizontalBarChart rows={dashboard.byCategory} unitLabel="kg" maxVisibleRows={5} />
            ) : (
              <p className="text-sm text-(--muted)">Sin existencias con peso registrado todavía.</p>
            )}
          </div>
        </section>

        {dashboard.productsMissingWeight > 0 ? (
          <p className="col-span-2 text-xs text-(--muted)">
            {dashboard.productsMissingWeight} producto(s) con saldo disponible no tienen peso
            registrado en el catálogo y no se incluyen en estos dos gráficos.
          </p>
        ) : null}
      </div>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold">Donaciones y despachos — últimos 14 días</h3>
          <p className="text-xs text-(--muted)">{dashboard.activityInPeriod} en el período</p>
        </div>
        <div className="mt-4">
          <DailyBarChart days={dashboard.activityDays} series={dashboard.activitySeries} />
        </div>
      </section>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-3 sm:p-4">
        <h3 className="text-sm font-bold">Detalle de inventario por ubicación</h3>
        <p className="mt-0.5 text-xs text-(--muted)">Saldo actual, sumado por ubicación.</p>
        <div className="mt-4">
          {dashboard.inventoryByLocation.length > 0 ? (
            <NumberTable
              columns={["Ubicación", "Disponible", "Reservado", "En Revisión"]}
              rows={dashboard.inventoryByLocation.map((row) => ({
                label: row.label,
                values: [row.available, row.reserved, row.quarantine],
              }))}
            />
          ) : (
            <p className="text-sm text-(--muted)">Sin existencias todavía.</p>
          )}
        </div>
      </section>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-3 sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold">Dónde ha llegado la ayuda</h3>
          <p className="text-xs text-(--muted)">
            {dashboard.helpLocations.length} despacho{dashboard.helpLocations.length === 1 ? "" : "s"} con ubicación marcada
          </p>
        </div>
        <div className="mt-4">
          {dashboard.helpLocations.length > 0 ? (
            <HelpMap points={dashboard.helpLocations} />
          ) : (
            <p className="text-sm text-(--muted)">
              Ningún despacho tiene todavía un punto marcado en el mapa.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function Action({ href, title, body, icon }: { href: string; title: string; body: string; icon: LucideIcon }) {
  return (
    <Link
      href={href}
      className="relative isolate block h-full overflow-hidden rounded border border-(--rule) bg-(--surface) p-3 hover:border-unal-green sm:p-4"
    >
      <CutIcon icon={icon} sizeClass="h-14 w-14" className="text-unal-green opacity-[0.12]" />
      <div className="relative z-1">
        <p className="font-bold text-unal-green-dark">{title}</p>
        <p className="mt-1 text-sm text-(--ink-2)">{body}</p>
      </div>
    </Link>
  );
}
