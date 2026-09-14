import {
  fmtDate,
  fmtDecimal,
  fmtDuration,
  fmtInt,
  fmtKg,
  fmtPercent,
  fmtQty,
  localDayKey,
  parsePbDate,
  plural,
} from "./format";
import { periodLabel } from "./period";
import {
  ADJUSTMENT_TYPES,
  INFLOW_TYPES,
  OUTFLOW_TYPES,
  TOTAL_EFFECT,
  WRITE_OFF_TYPES,
} from "./movements";
import type {
  ActivitySection,
  AdjustmentsSection,
  ClassificationSection,
  DispatchesSection,
  DonationsSection,
  FlowRow,
  FlowSection,
  LabeledValue,
  MethodologySection,
  ProductFlowRow,
  ReportData,
  ReportOptions,
  ReportRawData,
  RequestsSection,
  Segment,
  StockSection,
  SummarySection,
  TimeBucket,
  TimeChart,
} from "./types";

const DONOR_TYPES: { key: string; label: string; color: Segment["color"] }[] = [
  { key: "individual", label: "Persona", color: "donorIndividual" },
  { key: "empresa", label: "Empresa", color: "donorEmpresa" },
  { key: "institucion", label: "Institución", color: "donorInstitucion" },
  { key: "anonimo", label: "Anónimo", color: "donorAnonimo" },
];

const REQUEST_STATUSES: { key: string; label: string }[] = [
  { key: "pendiente", label: "Pendiente" },
  { key: "aprobada", label: "Aprobada" },
  { key: "en_preparacion", label: "En preparación" },
  { key: "despachada", label: "Despachada" },
  { key: "entregada", label: "Entregada" },
  { key: "rechazada", label: "Rechazada" },
  { key: "cancelada", label: "Cancelada" },
];

const PRIORITIES: { key: string; label: string }[] = [
  { key: "critica", label: "Crítica" },
  { key: "alta", label: "Alta" },
  { key: "media", label: "Media" },
  { key: "baja", label: "Baja" },
];

const DELIVERY_STATUSES: { key: string; label: string }[] = [
  { key: "entregado", label: "Entregado" },
  { key: "parcial", label: "Parcial" },
  { key: "no_entregado", label: "No entregado" },
];

const ENTITY_LABELS: Record<string, string> = {
  donations: "Donaciones",
  donation_items: "Artículos de donación",
  requests: "Solicitudes",
  request_items: "Renglones de solicitud",
  reservations: "Reservas",
  dispatches: "Despachos",
  deliveries: "Entregas",
  users: "Usuarios",
  kits: "Kits",
  kit_items: "Renglones de kit",
  adjustments: "Ajustes de inventario",
  products: "Productos",
  categories: "Categorías",
  groups: "Grupos",
  locations: "Ubicaciones",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Creaciones",
  update: "Ediciones",
  status_change: "Cambios de estado",
  delete: "Eliminaciones",
  login: "Inicios de sesión",
  logout: "Cierres de sesión",
};

const APPROVED_OR_LATER = new Set(["aprobada", "en_preparacion", "despachada", "entregada"]);

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

const DAY_MS = 86_400_000;

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function inRange(date: Date | null, from: Date, to: Date): date is Date {
  return date !== null && date >= from && date <= to;
}

function increment(map: Map<string, number>, key: string, by = 1) {
  map.set(key, (map.get(key) ?? 0) + by);
}

// Keeps charts and tables short: the tail folds into one "Otros" row
// instead of growing the report with every category.
function topWithOther(entries: Map<string, number>, limit: number, otherLabel = "Otros"): LabeledValue[] {
  const sorted = Array.from(entries.entries())
    .map(([label, value]) => ({ label, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value);

  if (sorted.length <= limit) return sorted.map((row) => ({ ...row, value: round1(row.value) }));

  const head = sorted.slice(0, limit - 1);
  const tail = sum(sorted.slice(limit - 1).map((row) => row.value));
  return [...head, { label: otherLabel, value: tail }].map((row) => ({ ...row, value: round1(row.value) }));
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  const offset = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - offset);
  return copy;
}

function buildTimeline(from: Date, to: Date) {
  const days = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / DAY_MS));
  const granularity: TimeChart["granularity"] = days <= 35 ? "day" : days <= 182 ? "week" : "month";

  const keyOf = (date: Date): string => {
    if (granularity === "day") return localDayKey(date);
    if (granularity === "week") return localDayKey(startOfWeek(date));
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  };

  const buckets: TimeBucket[] = [];
  const cursor = granularity === "week" ? startOfWeek(from) : new Date(from);
  cursor.setHours(0, 0, 0, 0);
  if (granularity === "month") cursor.setDate(1);

  while (cursor <= to) {
    const label =
      granularity === "month"
        ? `${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`
        : `${cursor.getDate()} ${MONTHS[cursor.getMonth()]}`;
    buckets.push({ key: keyOf(cursor), label });
    if (granularity === "day") cursor.setDate(cursor.getDate() + 1);
    else if (granularity === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  return { granularity, buckets, keyOf };
}

function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export function buildReport(raw: ReportRawData, options: ReportOptions): ReportData {
  const productById = new Map(raw.products.map((p) => [p.id, p]));
  const categoryById = new Map(raw.categories.map((c) => [c.id, c]));
  const groupById = new Map(raw.groups.map((g) => [g.id, g]));
  const unitById = new Map(raw.units.map((u) => [u.id, u]));
  const locationById = new Map(raw.locations.map((l) => [l.id, l]));

  const productsWithoutWeight = new Map<string, string>();

  // PocketBase leaves an unset number field at 0, so 0 means "no weight".
  const kgOf = (productId: string, quantity: number): number => {
    const product = productById.get(productId);
    const weight = product?.weight_kg ?? 0;
    if (weight <= 0) {
      if (product && quantity > 0) productsWithoutWeight.set(product.id, product.name);
      return 0;
    }
    return quantity * weight;
  };

  const groupNameOf = (productId: string): string => {
    const category = categoryById.get(productById.get(productId)?.category_id ?? "");
    return groupById.get(category?.group_id ?? "")?.name ?? "Sin grupo";
  };

  const unitOf = (productId: string): string => {
    const unit = unitById.get(productById.get(productId)?.default_unit_id ?? "");
    return unit ? unit.code || unit.name : "";
  };

  const movements = raw.movements.map((m) => ({ ...m, date: parsePbDate(m.created) }));
  const donations = raw.donations.map((d) => ({ ...d, date: parsePbDate(d.receipt_date) }));
  const requests = raw.requests.map((r) => ({ ...r, date: parsePbDate(r.created) }));
  const dispatches = raw.dispatches.map((d) => ({ ...d, date: parsePbDate(d.dispatch_date) }));
  const deliveries = raw.deliveries.map((d) => ({ ...d, date: parsePbDate(d.delivery_date) }));

  const to = options.to;
  let from = options.from;
  if (!from) {
    const firstDates = [...movements, ...donations, ...requests, ...dispatches]
      .map((record) => record.date)
      .filter((date): date is Date => date !== null && date <= to)
      .map((date) => date.getTime());
    from = new Date(firstDates.length > 0 ? Math.min(...firstDates) : to.getTime());
    from.setHours(0, 0, 0, 0);
  }

  const endsToday = localDayKey(to) === localDayKey(options.generatedAt);
  const periodMovements = movements.filter((m) => inRange(m.date, from, to));
  const periodDonations = donations.filter((d) => inRange(d.date, from, to));
  const periodRequests = requests.filter((r) => inRange(r.date, from, to));
  const periodDispatches = dispatches.filter((d) => inRange(d.date, from, to));
  const periodDeliveries = deliveries.filter((d) => inRange(d.date, from, to));

  const requestById = new Map(requests.map((r) => [r.id, r]));
  const itemsByRequest = new Map<string, typeof raw.requestItems>();
  for (const item of raw.requestItems) {
    const list = itemsByRequest.get(item.request_id) ?? [];
    list.push(item);
    itemsByRequest.set(item.request_id, list);
  }
  const requestKg = (requestId: string): number =>
    sum((itemsByRequest.get(requestId) ?? []).map((item) => kgOf(item.product_id, item.quantity_requested)));

  // ── Balances ─────────────────────────────────────────────────
  // The current balance comes from `inventory` (the backend is the
  // authority on it). The balance at an earlier instant is that same
  // number minus the effect of every movement recorded afterwards.
  const currentTotalByProduct = new Map<string, number>();
  const currentBuckets = { available: 0, reserved: 0, quarantine: 0 };
  for (const row of raw.inventory) {
    const total = (row.available_qty || 0) + (row.reserved_qty || 0) + (row.quarantine_qty || 0);
    increment(currentTotalByProduct, row.product_id, total);
    currentBuckets.available += kgOf(row.product_id, row.available_qty || 0);
    currentBuckets.reserved += kgOf(row.product_id, row.reserved_qty || 0);
    currentBuckets.quarantine += kgOf(row.product_id, row.quarantine_qty || 0);
  }

  const balanceAt = (instant: Date): Map<string, number> => {
    const balance = new Map(currentTotalByProduct);
    for (const movement of movements) {
      const effect = TOTAL_EFFECT[movement.movement_type] ?? 0;
      if (effect === 0 || !movement.date || movement.date <= instant) continue;
      increment(balance, movement.product_id, -effect * movement.quantity);
    }
    return balance;
  };

  const startBalance = balanceAt(new Date(from.getTime() - 1));
  const endBalance = endsToday ? currentTotalByProduct : balanceAt(to);

  interface ProductFlow {
    inflow: number;
    outflow: number;
    writeOff: number;
    adjustments: number;
  }
  const flowByProduct = new Map<string, ProductFlow>();
  const flowOf = (productId: string): ProductFlow => {
    let flow = flowByProduct.get(productId);
    if (!flow) {
      flow = { inflow: 0, outflow: 0, writeOff: 0, adjustments: 0 };
      flowByProduct.set(productId, flow);
    }
    return flow;
  };

  const movementKg = new Map<string, number>();
  for (const movement of periodMovements) {
    const type = movement.movement_type;
    const flow = flowOf(movement.product_id);
    if (INFLOW_TYPES.has(type)) flow.inflow += movement.quantity;
    else if (OUTFLOW_TYPES.has(type)) flow.outflow += movement.quantity;
    else if (WRITE_OFF_TYPES.has(type)) flow.writeOff += movement.quantity;
    else if (ADJUSTMENT_TYPES.has(type)) flow.adjustments += (TOTAL_EFFECT[type] ?? 0) * movement.quantity;
    increment(movementKg, type, kgOf(movement.product_id, movement.quantity));
  }

  const productIds = new Set([...startBalance.keys(), ...endBalance.keys(), ...flowByProduct.keys()]);
  const flowRowsByGroup = new Map<string, FlowRow>();
  const productFlowRows: (ProductFlowRow & { volumeKg: number })[] = [];

  for (const productId of productIds) {
    const start = Math.max(0, startBalance.get(productId) ?? 0);
    const end = Math.max(0, endBalance.get(productId) ?? 0);
    const flow = flowByProduct.get(productId) ?? { inflow: 0, outflow: 0, writeOff: 0, adjustments: 0 };
    if (start === 0 && end === 0 && flow.inflow === 0 && flow.outflow === 0 && flow.writeOff === 0 && flow.adjustments === 0) {
      continue;
    }

    const label = groupNameOf(productId);
    const row = flowRowsByGroup.get(label) ?? { label, start: 0, inflow: 0, outflow: 0, writeOff: 0, adjustments: 0, end: 0 };
    row.start += kgOf(productId, start);
    row.inflow += kgOf(productId, flow.inflow);
    row.outflow += kgOf(productId, flow.outflow);
    row.writeOff += kgOf(productId, flow.writeOff);
    row.adjustments += kgOf(productId, Math.abs(flow.adjustments)) * Math.sign(flow.adjustments);
    row.end += kgOf(productId, end);
    flowRowsByGroup.set(label, row);

    const product = productById.get(productId);
    const weight = product?.weight_kg ?? 0;
    const volume = flow.inflow + flow.outflow + flow.writeOff;
    if (volume > 0) {
      productFlowRows.push({
        name: product?.name ?? "Producto eliminado",
        unit: unitOf(productId),
        inflow: flow.inflow,
        outflow: flow.outflow,
        writeOff: flow.writeOff,
        end,
        endKg: weight > 0 ? end * weight : null,
        volumeKg: weight > 0 ? volume * weight : 0,
      });
    }
  }

  const flowRows = Array.from(flowRowsByGroup.values())
    .filter((row) => [row.start, row.inflow, row.outflow, row.writeOff, row.end].some((v) => v >= 0.05))
    .sort((a, b) => b.end + b.inflow - (a.end + a.inflow));

  const flowTotal: FlowRow = {
    label: "Total",
    start: sum(flowRows.map((r) => r.start)),
    inflow: sum(flowRows.map((r) => r.inflow)),
    outflow: sum(flowRows.map((r) => r.outflow)),
    writeOff: sum(flowRows.map((r) => r.writeOff)),
    adjustments: sum(flowRows.map((r) => r.adjustments)),
    end: sum(flowRows.map((r) => r.end)),
  };

  const topProducts = productFlowRows
    .sort((a, b) => b.volumeKg - a.volumeKg || b.inflow + b.outflow - (a.inflow + a.outflow))
    .slice(0, 10)
    .map((row) => ({
      name: row.name,
      unit: row.unit,
      inflow: row.inflow,
      outflow: row.outflow,
      writeOff: row.writeOff,
      end: row.end,
      endKg: row.endKg,
    }));

  // ── Pending snapshot (always "today", whatever the period) ───
  const itemsPendingNow = raw.donationItems.filter((item) => item.classification_status === "pending").length;
  const donationsInReceptionNow = raw.donations.filter((d) => d.status === "recepcion").length;
  const dispatchedUnconfirmed = dispatches.filter((d) => requestById.get(d.request_id)?.status === "despachada");
  const pendingConfirmationKg = sum(
    requests.filter((r) => r.status === "despachada").map((r) => requestKg(r.id))
  );
  const requestsPendingNow = requests.filter((r) => r.status === "pendiente").length;

  // ── Donations ────────────────────────────────────────────────
  const timeline = buildTimeline(from, to);

  const donationsByBucket = new Map<string, number>();
  const donorTypeCounts = new Map<string, number>();
  const donorTypeKg = new Map<string, number>();
  const donorKeys = new Set<string>();
  const donorTotals = new Map<string, { name: string; type: string; donations: number; kg: number }>();
  let anonymous = 0;
  let declaredKg = 0;
  let declaredCount = 0;

  for (const donation of periodDonations) {
    increment(donationsByBucket, timeline.keyOf(donation.date!));
    const typeKey = DONOR_TYPES.some((t) => t.key === donation.donor_type) ? donation.donor_type : "anonimo";
    increment(donorTypeCounts, typeKey);

    const weight = donation.total_weight_kg ?? 0;
    if (weight > 0) {
      declaredKg += weight;
      declaredCount += 1;
      increment(donorTypeKg, typeKey, weight);
    }

    const identity = normalizeText(donation.donor_id_number || donation.donor_name || "");
    if (typeKey === "anonimo" || !identity) {
      anonymous += 1;
      continue;
    }
    donorKeys.add(identity);
    const totals = donorTotals.get(identity) ?? {
      name: (donation.donor_name || donation.donor_id_number || "").trim(),
      type: DONOR_TYPES.find((t) => t.key === typeKey)?.label ?? "",
      donations: 0,
      kg: 0,
    };
    totals.donations += 1;
    totals.kg += Math.max(0, weight);
    donorTotals.set(identity, totals);
  }

  const periodDonationIds = new Set(periodDonations.map((d) => d.id));
  const periodDonationItems = raw.donationItems.filter((item) => periodDonationIds.has(item.donation_id));
  const receivedKgByGroup = new Map<string, number>();
  let itemsWithoutWeight = 0;
  for (const item of periodDonationItems) {
    const kg = kgOf(item.product_id, item.quantity);
    if (kg <= 0) itemsWithoutWeight += 1;
    increment(receivedKgByGroup, groupNameOf(item.product_id), kg);
  }

  const donorTypes = DONOR_TYPES.map((type) => ({
    label: type.label,
    value: donorTypeCounts.get(type.key) ?? 0,
    color: type.color,
    kg: round1(donorTypeKg.get(type.key) ?? 0),
  }));

  const inReception = periodDonations.filter((d) => d.status === "recepcion").length;
  const inflowKg = flowTotal.inflow;

  const donationParagraphs: string[] = [];
  if (periodDonations.length === 0) {
    donationParagraphs.push("No se registraron donaciones en este periodo.");
  } else {
    const leadingType = [...donorTypes].sort((a, b) => b.value - a.value)[0];
    donationParagraphs.push(
      `Se recibieron ${plural(periodDonations.length, "donación", "donaciones")} de ` +
        `${plural(donorKeys.size, "donante identificado", "donantes identificados")}` +
        `${anonymous > 0 ? ` y ${plural(anonymous, "aporte anónimo o sin nombre", "aportes anónimos o sin nombre")}` : ""}. ` +
        `El tipo de donante más frecuente fue ${leadingType.label.toLowerCase()} ` +
        `(${fmtPercent(leadingType.value, periodDonations.length)} de las donaciones).`
    );
    const weightSentence =
      declaredCount > 0
        ? `El peso declarado al recibir suma ${fmtKg(declaredKg)} en ${plural(declaredCount, "donación", "donaciones")} con ese dato` +
          `${declaredCount < periodDonations.length ? `; las otras ${fmtInt(periodDonations.length - declaredCount)} no lo registraron` : ""}. `
        : "Ninguna donación del periodo registró peso al recibirla. ";
    const groups = topWithOther(receivedKgByGroup, 3);
    const groupSentence =
      groups.length > 0 && sum(groups.map((g) => g.value)) > 0
        ? `Por lo clasificado, lo que más llegó fue ${groups
            .filter((g) => g.label !== "Otros")
            .map((g) => `${g.label.toLowerCase()} (${fmtKg(g.value)})`)
            .join(", ")}.`
        : "";
    donationParagraphs.push(weightSentence + groupSentence);
  }

  const donationsSection: DonationsSection = {
    hasData: periodDonations.length > 0,
    count: periodDonations.length,
    identifiedDonors: donorKeys.size,
    anonymous,
    declaredKg,
    declaredCount,
    paragraphs: donationParagraphs,
    figures: [
      { label: "Donaciones recibidas", value: fmtInt(periodDonations.length) },
      { label: "Donantes identificados", value: fmtInt(donorKeys.size), hint: anonymous > 0 ? `${fmtInt(anonymous)} sin identificar` : undefined },
      { label: "Peso declarado", value: fmtKg(declaredKg), hint: `${fmtInt(declaredCount)} con el dato` },
      {
        label: "Promedio por donación",
        value: declaredCount > 0 ? fmtKg(declaredKg / declaredCount) : "sin dato",
        hint: "Sobre las que declararon peso",
      },
    ],
    timeline: {
      granularity: timeline.granularity,
      buckets: timeline.buckets,
      series: [{ label: "Donaciones", color: "available", values: Object.fromEntries(donationsByBucket) }],
    },
    donorTypes,
    reception: { inReception, classified: periodDonations.length - inReception },
    kgByGroup: topWithOther(receivedKgByGroup, 8),
    itemsWithoutWeight,
    topDonors: options.includePersonalData
      ? Array.from(donorTotals.values())
          .sort((a, b) => b.kg - a.kg || b.donations - a.donations)
          .slice(0, 10)
          .map((donor) => ({ ...donor, kg: round1(donor.kg) }))
      : null,
  };

  // ── Classification ───────────────────────────────────────────
  const kgEntrada = movementKg.get("entrada") ?? 0;
  const kgCuarentena = movementKg.get("cuarentena") ?? 0;
  const kgTraslado = movementKg.get("traslado_a_cuarentena") ?? 0;
  const kgLiberado = movementKg.get("liberar_cuarentena") ?? 0;
  const kgRechazo = movementKg.get("rechazo") ?? 0;
  const classifiedKg = kgEntrada + kgCuarentena;
  const stillInReview = Math.max(0, kgCuarentena + kgTraslado - kgLiberado - kgRechazo);

  const rejectionReasons = (() => {
    const byReason = new Map<string, { reason: string; count: number; kg: number }>();
    for (const movement of periodMovements) {
      if (movement.movement_type !== "rechazo") continue;
      const reason = (movement.notes || "Sin motivo registrado").replace(/^Rechazo:\s*/i, "").trim();
      const key = normalizeText(reason);
      const entry = byReason.get(key) ?? { reason, count: 0, kg: 0 };
      entry.count += 1;
      entry.kg += kgOf(movement.product_id, movement.quantity);
      byReason.set(key, entry);
    }
    return Array.from(byReason.values())
      .sort((a, b) => b.kg - a.kg || b.count - a.count)
      .slice(0, 5)
      .map((entry) => ({ ...entry, kg: round1(entry.kg) }));
  })();

  const closedDonations = periodDonations.filter(
    (d) => d.status === "clasificada" && (d.total_weight_kg ?? 0) > 0 && (d.classified_weight_kg ?? 0) > 0
  );
  const weightCheck =
    closedDonations.length > 0
      ? {
          donations: closedDonations.length,
          declaredKg: sum(closedDonations.map((d) => d.total_weight_kg ?? 0)),
          classifiedKg: sum(closedDonations.map((d) => d.classified_weight_kg ?? 0)),
        }
      : null;

  const usableKg = Math.max(0, classifiedKg - kgRechazo - stillInReview);
  const classificationParagraphs: string[] = [];
  if (classifiedKg <= 0 && kgRechazo <= 0) {
    classificationParagraphs.push("No hubo clasificación de artículos en este periodo.");
  } else {
    classificationParagraphs.push(
      `Se clasificaron aproximadamente ${fmtKg(classifiedKg)}: ${fmtKg(kgEntrada)} pasaron directo a disponible ` +
        `y ${fmtKg(kgCuarentena)} entraron a revisión. De lo revisado se aprobaron ${fmtKg(kgLiberado)} ` +
        `y se rechazaron ${fmtKg(kgRechazo)}, de modo que el ${fmtPercent(Math.max(0, classifiedKg - kgRechazo), classifiedKg)} ` +
        `de lo que ingresó sigue siendo aprovechable.`
    );
  }
  if (itemsPendingNow > 0 || donationsInReceptionNow > 0) {
    classificationParagraphs.push(
      `Hoy siguen pendientes ${plural(itemsPendingNow, "artículo", "artículos")} por clasificar y ` +
        `${plural(donationsInReceptionNow, "donación", "donaciones")} en recepción, sin cerrar su clasificación.`
    );
  }

  const classificationSection: ClassificationSection = {
    hasData: classifiedKg > 0 || kgRechazo > 0,
    paragraphs: classificationParagraphs,
    figures: [
      { label: "Kilos clasificados", value: fmtKg(classifiedKg) },
      {
        label: "Aprovechable",
        value: classifiedKg > 0 ? fmtPercent(Math.max(0, classifiedKg - kgRechazo), classifiedKg) : "sin dato",
        tone: classifiedKg > 0 ? "good" : "neutral",
      },
      { label: "Rechazado", value: fmtKg(kgRechazo), tone: kgRechazo > 0 ? "critical" : "neutral" },
      {
        label: "Por clasificar hoy",
        value: fmtInt(itemsPendingNow),
        hint: plural(donationsInReceptionNow, "donación en recepción", "donaciones en recepción"),
        tone: itemsPendingNow > 0 ? "warning" : "good",
      },
    ],
    outcome: [
      { label: "Aprovechable", value: round1(usableKg), color: "available" },
      { label: "Sigue en revisión", value: round1(stillInReview), color: "quarantine" },
      { label: "Rechazado", value: round1(kgRechazo), color: "rejected" },
    ],
    weightCheck,
    rejectionReasons,
    pendingNow: { items: itemsPendingNow, donationsInReception: donationsInReceptionNow, quarantineKg: currentBuckets.quarantine },
  };

  // ── Flow ─────────────────────────────────────────────────────
  const flowParagraphs: string[] = [];
  flowParagraphs.push(
    `Al iniciar el periodo había aproximadamente ${fmtKg(flowTotal.start)} en bodega. ` +
      `Entraron ${fmtKg(flowTotal.inflow)}, salieron ${fmtKg(flowTotal.outflow)} en entregas confirmadas ` +
      `y se dieron de baja ${fmtKg(flowTotal.writeOff)} por rechazo` +
      `${Math.abs(flowTotal.adjustments) >= 0.05 ? `; los ajustes manuales suman ${fmtKg(flowTotal.adjustments)}` : ""}. ` +
      `${endsToday ? "Hoy" : "Al cierre"} quedan aproximadamente ${fmtKg(flowTotal.end)}.`
  );
  if (pendingConfirmationKg >= 0.05) {
    const single = dispatchedUnconfirmed.length === 1;
    flowParagraphs.push(
      `Además, ${plural(dispatchedUnconfirmed.length, "despacho", "despachos")} ya ${single ? "salió" : "salieron"} de bodega ` +
        `pero no ${single ? "tiene" : "tienen"} la entrega confirmada: sus ${fmtKg(pendingConfirmationKg)} todavía cuentan como ` +
        `reservados en la existencia y aparecerán como salida cuando se confirme${single ? "" : "n"}.`
    );
  }

  const flowSection: FlowSection = {
    paragraphs: flowParagraphs,
    rows: flowRows.map((row) => ({
      ...row,
      start: round1(row.start),
      inflow: round1(row.inflow),
      outflow: round1(row.outflow),
      writeOff: round1(row.writeOff),
      adjustments: round1(row.adjustments),
      end: round1(row.end),
    })),
    total: flowTotal,
    topProducts,
    pendingConfirmationKg,
  };

  // ── Stock (current snapshot) ─────────────────────────────────
  const stockByGroup = new Map<string, number>();
  const stockByLocation = new Map<string, { label: string; available: number; reserved: number; quarantine: number }>();
  const availableByProduct = new Map<string, number>();
  const stockedProducts = new Set<string>();

  for (const row of raw.inventory) {
    const total = (row.available_qty || 0) + (row.reserved_qty || 0) + (row.quarantine_qty || 0);
    if (total <= 0) continue;
    stockedProducts.add(row.product_id);
    increment(availableByProduct, row.product_id, row.available_qty || 0);
    increment(stockByGroup, groupNameOf(row.product_id), kgOf(row.product_id, total));

    const location = row.location_id ? locationById.get(row.location_id) : undefined;
    const label = location
      ? [location.zone, location.shelf, location.position].filter(Boolean).join("-")
      : "Por Ubicar";
    const bucket = stockByLocation.get(label) ?? { label, available: 0, reserved: 0, quarantine: 0 };
    bucket.available += kgOf(row.product_id, row.available_qty || 0);
    bucket.reserved += kgOf(row.product_id, row.reserved_qty || 0);
    bucket.quarantine += kgOf(row.product_id, row.quarantine_qty || 0);
    stockByLocation.set(label, bucket);
  }
  const productsWithStock = stockedProducts.size;

  const locationRows = Array.from(stockByLocation.values()).sort(
    (a, b) => b.available + b.reserved + b.quarantine - (a.available + a.reserved + a.quarantine)
  );
  const byLocation =
    locationRows.length <= 10
      ? locationRows
      : [
          ...locationRows.slice(0, 9),
          locationRows.slice(9).reduce(
            (acc, row) => ({
              label: "Otras ubicaciones",
              available: acc.available + row.available,
              reserved: acc.reserved + row.reserved,
              quarantine: acc.quarantine + row.quarantine,
            }),
            { label: "Otras ubicaciones", available: 0, reserved: 0, quarantine: 0 }
          ),
        ];

  const lowStockAll = raw.products
    .filter((p) => p.active !== false && (p.min_stock_alert ?? 0) > 0)
    .map((p) => ({ name: p.name, unit: unitOf(p.id), available: availableByProduct.get(p.id) ?? 0, min: p.min_stock_alert ?? 0 }))
    .filter((p) => p.available < p.min)
    .sort((a, b) => a.available / a.min - b.available / b.min);

  const stockTotalKg = currentBuckets.available + currentBuckets.reserved + currentBuckets.quarantine;
  const stockGroups = topWithOther(stockByGroup, 8);
  const stockParagraphs: string[] = [
    `A la fecha de generación del reporte hay ${plural(productsWithStock, "producto distinto", "productos distintos")} con existencia, ` +
      `que suman aproximadamente ${fmtKg(stockTotalKg)}. De eso, ${fmtKg(currentBuckets.available)} ` +
      `(${fmtPercent(currentBuckets.available, stockTotalKg)}) está disponible para entregar, ` +
      `${fmtKg(currentBuckets.reserved)} está reservado para solicitudes aprobadas y ` +
      `${fmtKg(currentBuckets.quarantine)} está en revisión.`,
  ];
  if (stockGroups.length > 0) {
    const leading = stockGroups[0];
    stockParagraphs.push(
      `El grupo con más existencia es ${leading.label.toLowerCase()}, con ${fmtKg(leading.value)} ` +
        `(${fmtPercent(leading.value, stockTotalKg)} del total).` +
        `${lowStockAll.length > 0 ? ` ${plural(lowStockAll.length, "producto está", "productos están")} por debajo de su existencia mínima.` : ""}`
    );
  }

  const stockSection: StockSection = {
    paragraphs: stockParagraphs,
    figures: [
      { label: "Existencia total", value: fmtKg(stockTotalKg), hint: plural(productsWithStock, "producto", "productos") },
      { label: "Disponible", value: fmtKg(currentBuckets.available), tone: "good" },
      { label: "Reservado", value: fmtKg(currentBuckets.reserved) },
      { label: "En revisión", value: fmtKg(currentBuckets.quarantine), tone: currentBuckets.quarantine > 0 ? "warning" : "neutral" },
    ],
    buckets: [
      { label: "Disponible", value: round1(currentBuckets.available), color: "available" },
      { label: "Reservado", value: round1(currentBuckets.reserved), color: "reserved" },
      { label: "En revisión", value: round1(currentBuckets.quarantine), color: "quarantine" },
    ],
    byGroup: stockGroups,
    byLocation: byLocation.map((row) => ({
      label: row.label,
      available: round1(row.available),
      reserved: round1(row.reserved),
      quarantine: round1(row.quarantine),
    })),
    lowStock: lowStockAll.slice(0, 8),
    lowStockCount: lowStockAll.length,
  };

  // ── Requests ─────────────────────────────────────────────────
  const statusCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  const requestedKgByProduct = new Map<string, number>();
  const kitCounts = new Map<string, number>();
  let beneficiaries = 0;
  let withBeneficiaries = 0;
  let fromKits = 0;
  const approvalHours: number[] = [];

  for (const request of periodRequests) {
    increment(statusCounts, request.status);
    increment(priorityCounts, request.priority);
    if ((request.beneficiary_count ?? 0) > 0) {
      beneficiaries += request.beneficiary_count ?? 0;
      withBeneficiaries += 1;
    }
    if (request.source_kit_id) {
      fromKits += 1;
      increment(kitCounts, request.source_kit_id);
    }
    const approvedAt = parsePbDate(request.approved_at);
    if (approvedAt && request.date) approvalHours.push((approvedAt.getTime() - request.date.getTime()) / 3_600_000);
    for (const item of itemsByRequest.get(request.id) ?? []) {
      const product = productById.get(item.product_id);
      increment(requestedKgByProduct, product?.name ?? "Producto eliminado", kgOf(item.product_id, item.quantity_requested));
    }
  }

  const approvedCount = periodRequests.filter((r) => APPROVED_OR_LATER.has(r.status)).length;
  const avgApproval = approvalHours.length > 0 ? sum(approvalHours) / approvalHours.length : null;
  const requestedKg = sum(periodRequests.map((r) => requestKg(r.id)));
  const attendedKg = sum(periodRequests.filter((r) => APPROVED_OR_LATER.has(r.status)).map((r) => requestKg(r.id)));
  const kitNameById = new Map((raw.kits ?? []).map((kit) => [kit.id, kit.name]));

  const missing = raw.missingProducts
    ? raw.missingProducts.slice(0, 8).map((item) => ({
        name: item.product_name,
        unit: item.unit,
        requested: item.requested_qty,
        available: item.available_qty,
        missing: item.missing_qty,
      }))
    : null;

  const requestParagraphs: string[] = [];
  if (periodRequests.length === 0) {
    requestParagraphs.push("No se registraron solicitudes en este periodo.");
  } else {
    requestParagraphs.push(
      `Se registraron ${plural(periodRequests.length, "solicitud", "solicitudes")}` +
        `${withBeneficiaries > 0 ? `, que declaran ${plural(beneficiaries, "beneficiario", "beneficiarios")}` : ""}. ` +
        `${fmtPercent(approvedCount, periodRequests.length)} fueron aprobadas o avanzaron más allá de la aprobación` +
        `${avgApproval !== null ? `, con un tiempo promedio de aprobación de ${fmtDuration(avgApproval)}` : ""}. ` +
        `Piden en total aproximadamente ${fmtKg(requestedKg)}, de los cuales ${fmtKg(attendedKg)} ` +
        `(${fmtPercent(attendedKg, requestedKg)}) corresponden a solicitudes ya atendidas.`
    );
    if (fromKits > 0) {
      requestParagraphs.push(
        `${plural(fromKits, "solicitud se armó", "solicitudes se armaron")} a partir de un kit, sin capturar producto por producto.`
      );
    }
  }
  if (raw.missingProducts && raw.missingProducts.length > 0) {
    requestParagraphs.push(
      `Hoy hay ${plural(raw.missingProducts.length, "producto solicitado", "productos solicitados")} en solicitudes pendientes ` +
        `sin existencia suficiente para cubrirlos. Es la demanda que conviene comunicar a los donantes.`
    );
  }

  const requestsSection: RequestsSection = {
    hasData: periodRequests.length > 0,
    paragraphs: requestParagraphs,
    figures: [
      { label: "Solicitudes", value: fmtInt(periodRequests.length) },
      {
        label: "Beneficiarios declarados",
        value: fmtInt(beneficiaries),
        hint: withBeneficiaries < periodRequests.length ? `${fmtInt(withBeneficiaries)} solicitudes con el dato` : undefined,
      },
      {
        label: "Aprobadas o más",
        value: periodRequests.length > 0 ? fmtPercent(approvedCount, periodRequests.length) : "sin dato",
        tone: periodRequests.length > 0 ? "good" : "neutral",
      },
      {
        label: "Pendientes hoy",
        value: fmtInt(requestsPendingNow),
        tone: requestsPendingNow > 0 ? "warning" : "good",
      },
    ],
    byStatus: REQUEST_STATUSES.map((s) => ({ label: s.label, value: statusCounts.get(s.key) ?? 0 })).filter((s) => s.value > 0),
    byPriority: PRIORITIES.map((p) => ({ label: p.label, value: priorityCounts.get(p.key) ?? 0 })),
    topRequested: topWithOther(requestedKgByProduct, 6, "Otros productos"),
    missing,
    missingCount: raw.missingProducts?.length ?? 0,
    kits: raw.kits
      ? Array.from(kitCounts.entries())
          .map(([id, count]) => ({ label: kitNameById.get(id) ?? "Kit sin nombre", value: count }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 5)
      : null,
  };

  // ── Dispatches and deliveries ────────────────────────────────
  const dispatchesByBucket = new Map<string, number>();
  const deliveriesByBucket = new Map<string, number>();
  const brigadeCounts = new Map<string, number>();
  const destinationKeys = new Set<string>();
  let withCoordinates = 0;

  for (const dispatch of periodDispatches) {
    increment(dispatchesByBucket, timeline.keyOf(dispatch.date!));
    const brigade = (dispatch.brigade || "").trim();
    if (brigade) increment(brigadeCounts, brigade);
    if ((dispatch.destination_lat ?? 0) !== 0 && (dispatch.destination_lng ?? 0) !== 0) withCoordinates += 1;
    const destination = normalizeText(dispatch.destination || "");
    if (destination) destinationKeys.add(destination);
  }

  const deliveryStatusCounts = new Map<string, number>();
  const dispatchById = new Map(dispatches.map((d) => [d.id, d]));
  const leadHours: number[] = [];
  for (const delivery of periodDeliveries) {
    increment(deliveriesByBucket, timeline.keyOf(delivery.date!));
    increment(deliveryStatusCounts, delivery.status);
    const dispatch = dispatchById.get(delivery.dispatch_id);
    if (dispatch?.date && delivery.date) leadHours.push((delivery.date.getTime() - dispatch.date.getTime()) / 3_600_000);
  }

  const dispatchedKg = sum(periodDispatches.map((d) => requestKg(d.request_id)));
  const deliveredKg = flowTotal.outflow;
  const unconfirmedInPeriod = periodDispatches.filter((d) => requestById.get(d.request_id)?.status === "despachada").length;
  const avgLead = leadHours.length > 0 ? sum(leadHours) / leadHours.length : null;

  const dispatchParagraphs: string[] = [];
  if (periodDispatches.length === 0 && periodDeliveries.length === 0) {
    dispatchParagraphs.push("No hubo despachos ni entregas en este periodo.");
  } else {
    const dispatchSentence =
      periodDispatches.length > 0
        ? `Se ${periodDispatches.length === 1 ? "realizó" : "realizaron"} ${plural(periodDispatches.length, "despacho", "despachos")}, ` +
          `que llevan aproximadamente ${fmtKg(dispatchedKg)} hacia ${plural(destinationKeys.size, "destino distinto", "destinos distintos")}` +
          `${withCoordinates > 0 ? ` (${fmtInt(withCoordinates)} con el punto marcado en el mapa)` : ""}. `
        : "No se hicieron despachos nuevos en el periodo. ";
    const deliverySentence =
      periodDeliveries.length > 0
        ? `Se ${periodDeliveries.length === 1 ? "confirmó" : "confirmaron"} ${plural(periodDeliveries.length, "entrega", "entregas")}, ` +
          `con ${fmtKg(deliveredKg)} que salieron definitivamente de bodega` +
          `${avgLead !== null ? `; entre el despacho y la confirmación pasaron en promedio ${fmtDuration(avgLead)}` : ""}.`
        : "Todavía no se ha confirmado ninguna entrega de este periodo.";
    dispatchParagraphs.push(dispatchSentence + deliverySentence);
    if (unconfirmedInPeriod > 0) {
      dispatchParagraphs.push(
        `${plural(unconfirmedInPeriod, "despacho del periodo sigue", "despachos del periodo siguen")} sin entrega confirmada. ` +
          `Mientras no se confirmen, su mercancía figura como reservada y no como salida.`
      );
    }
  }

  const dispatchesSection: DispatchesSection = {
    hasData: periodDispatches.length > 0 || periodDeliveries.length > 0,
    paragraphs: dispatchParagraphs,
    figures: [
      { label: "Despachos", value: fmtInt(periodDispatches.length), hint: fmtKg(dispatchedKg) },
      { label: "Entregas confirmadas", value: fmtInt(periodDeliveries.length), tone: "good", hint: fmtKg(deliveredKg) },
      {
        label: "Sin confirmar hoy",
        value: fmtInt(dispatchedUnconfirmed.length),
        tone: dispatchedUnconfirmed.length > 0 ? "warning" : "good",
        hint: fmtKg(pendingConfirmationKg),
      },
      { label: "Destinos distintos", value: fmtInt(destinationKeys.size) },
    ],
    timeline: {
      granularity: timeline.granularity,
      buckets: timeline.buckets,
      series: [
        { label: "Despachos", color: "reserved", values: Object.fromEntries(dispatchesByBucket) },
        { label: "Entregas confirmadas", color: "available", values: Object.fromEntries(deliveriesByBucket) },
      ],
    },
    deliveryStatus: DELIVERY_STATUSES.map((s) => ({ label: s.label, value: deliveryStatusCounts.get(s.key) ?? 0 })),
    brigades: topWithOther(brigadeCounts, 5, "Otras brigadas"),
  };

  // ── Adjustments ──────────────────────────────────────────────
  let adjustmentsSection: AdjustmentsSection | null = null;
  if (raw.adjustments) {
    const periodAdjustments = raw.adjustments
      .map((a) => ({ ...a, date: parsePbDate(a.created) }))
      .filter((a) => inRange(a.date, from, to))
      .sort((a, b) => b.date!.getTime() - a.date!.getTime());
    const positive = periodAdjustments.filter((a) => a.difference > 0);
    const negative = periodAdjustments.filter((a) => a.difference < 0);
    const positiveKg = sum(positive.map((a) => kgOf(a.product_id, a.difference)));
    const negativeKg = sum(negative.map((a) => kgOf(a.product_id, -a.difference)));
    const rejectCount = periodMovements.filter((m) => m.movement_type === "rechazo").length;

    adjustmentsSection = {
      paragraphs: [
        periodAdjustments.length === 0
          ? "No se hicieron ajustes manuales de inventario en este periodo."
          : `Se registraron ${plural(periodAdjustments.length, "ajuste manual", "ajustes manuales")} de inventario: ` +
            `${fmtInt(positive.length)} a favor (${fmtKg(positiveKg)}) y ${fmtInt(negative.length)} en contra (${fmtKg(negativeKg)}). ` +
            `Cada ajuste exige un motivo escrito y queda en el historial.`,
        rejectCount === 0
          ? "No hubo rechazos de mercancía en revisión."
          : `Además se rechazaron ${plural(rejectCount, "lote", "lotes")} en revisión, con ${fmtKg(kgRechazo)} dados de baja.`,
      ],
      figures: [
        { label: "Ajustes manuales", value: fmtInt(periodAdjustments.length) },
        { label: "Balance de ajustes", value: fmtKg(positiveKg - negativeKg), tone: "neutral" },
        { label: "Rechazos", value: fmtInt(rejectCount), tone: rejectCount > 0 ? "critical" : "neutral", hint: fmtKg(kgRechazo) },
      ],
      recent: periodAdjustments.slice(0, 8).map((a) => ({
        date: `${a.date!.getDate()} ${MONTHS[a.date!.getMonth()]}`,
        product: productById.get(a.product_id)?.name ?? "Producto eliminado",
        difference: `${a.difference > 0 ? "+" : ""}${fmtQty(a.difference)} ${unitOf(a.product_id)}`.trim(),
        reason: a.reason,
      })),
      rejectionReasons,
    };
  }

  // ── Activity ─────────────────────────────────────────────────
  let activitySection: ActivitySection | null = null;
  if (raw.audit) {
    const entries = raw.audit
      .map((entry) => ({ ...entry, date: parsePbDate(entry.created) }))
      .filter((entry) => inRange(entry.date, from, to));
    const byEntity = new Map<string, number>();
    const byAction = new Map<string, number>();
    const byBucket = new Map<string, number>();
    const operators = new Map<string, number>();
    const operatorNames = new Map<string, string>();

    for (const entry of entries) {
      increment(byEntity, ENTITY_LABELS[entry.entity_type] ?? entry.entity_type);
      increment(byAction, ACTION_LABELS[entry.action] ?? entry.action);
      increment(byBucket, timeline.keyOf(entry.date!));
      increment(operators, entry.operator_id);
      if (entry.operator_name) operatorNames.set(entry.operator_id, entry.operator_name);
    }

    const busiest = timeline.buckets
      .map((bucket) => ({ label: bucket.label, value: byBucket.get(bucket.key) ?? 0 }))
      .sort((a, b) => b.value - a.value)[0];
    const bucketNoun = timeline.granularity === "day" ? "día" : timeline.granularity === "week" ? "semana" : "mes";
    const entities = topWithOther(byEntity, 8, "Otros módulos");

    activitySection = {
      hasData: entries.length > 0,
      paragraphs: [
        entries.length === 0
          ? "No hay operaciones registradas en el historial para este periodo."
          : `El historial registra ${plural(entries.length, "operación", "operaciones")} hechas por ` +
            `${plural(operators.size, "persona", "personas")}. El módulo con más actividad fue ${entities[0]?.label.toLowerCase() ?? "ninguno"}` +
            `${busiest && busiest.value > 0 ? ` y el ${bucketNoun} más activo fue el ${busiest.label}, con ${plural(busiest.value, "operación", "operaciones")}` : ""}.`,
      ],
      figures: [
        { label: "Operaciones registradas", value: fmtInt(entries.length) },
        { label: "Personas activas", value: fmtInt(operators.size) },
        {
          label: `Promedio por ${bucketNoun}`,
          value: fmtDecimal(entries.length / Math.max(1, timeline.buckets.length), 1),
        },
      ],
      timeline: {
        granularity: timeline.granularity,
        buckets: timeline.buckets,
        series: [{ label: "Operaciones", color: "magnitude", values: Object.fromEntries(byBucket) }],
      },
      byEntity: entities,
      byAction: topWithOther(byAction, 6),
      topOperators:
        options.includePersonalData && operatorNames.size > 0
          ? Array.from(operators.entries())
              .map(([id, count]) => ({ label: operatorNames.get(id) ?? "Sin nombre visible", value: count }))
              .sort((a, b) => b.value - a.value)
              .slice(0, 10)
          : null,
    };
  }

  // ── Summary ──────────────────────────────────────────────────
  const period = periodLabel(from, to);
  const summaryParagraphs: string[] = [];
  const intro = `Entre el ${fmtDate(from)} y el ${fmtDate(to)}`;
  const receptionSentence =
    periodDonations.length > 0 || inflowKg >= 0.05
      ? `${intro}, el Centro de Acopio recibió ${plural(periodDonations.length, "donación", "donaciones")} ` +
        `y al inventario ingresaron aproximadamente ${fmtKg(inflowKg)} en productos clasificados.`
      : `${intro} no se registraron donaciones ni ingresos al inventario.`;
  const demandSentence =
    periodRequests.length > 0 || periodDispatches.length > 0
      ? ` En el mismo periodo se registraron ${plural(periodRequests.length, "solicitud", "solicitudes")}` +
        `${withBeneficiaries > 0 ? ` para ${plural(beneficiaries, "beneficiario", "beneficiarios")}` : ""} ` +
        `y se hicieron ${plural(periodDispatches.length, "despacho", "despachos")}.`
      : " Tampoco hubo solicitudes ni despachos nuevos.";
  summaryParagraphs.push(receptionSentence + demandSentence);

  const outflowSentence =
    periodDeliveries.length > 0
      ? `Salieron definitivamente de bodega ${fmtKg(deliveredKg)} en ${plural(periodDeliveries.length, "entrega confirmada", "entregas confirmadas")}`
      : "No se confirmaron entregas en el periodo";
  summaryParagraphs.push(
    outflowSentence +
      `${pendingConfirmationKg >= 0.05 ? `${periodDeliveries.length > 0 ? " y otros" : "; hay"} ${fmtKg(pendingConfirmationKg)} ya despachados que esperan confirmación de entrega` : ""}. ` +
      `${endsToday ? "Hoy" : "Al cierre del periodo"} el inventario suma aproximadamente ${fmtKg(flowTotal.end)}` +
      `${endsToday ? `, de los cuales ${fmtKg(currentBuckets.available)} están disponibles para nuevas solicitudes` : ""}.`
  );

  const attention: string[] = [];
  if (itemsPendingNow > 0) attention.push(`${plural(itemsPendingNow, "artículo de donación espera", "artículos de donación esperan")} clasificación.`);
  if (donationsInReceptionNow > 0) attention.push(`${plural(donationsInReceptionNow, "donación sigue", "donaciones siguen")} en recepción, sin cerrar.`);
  if (requestsPendingNow > 0) attention.push(`${plural(requestsPendingNow, "solicitud espera", "solicitudes esperan")} aprobación.`);
  if (dispatchedUnconfirmed.length > 0) attention.push(`${plural(dispatchedUnconfirmed.length, "despacho espera", "despachos esperan")} confirmación de entrega.`);
  if ((raw.missingProducts?.length ?? 0) > 0) attention.push(`${plural(raw.missingProducts!.length, "producto solicitado no alcanza", "productos solicitados no alcanzan")} con la existencia actual.`);
  if (lowStockAll.length > 0) attention.push(`${plural(lowStockAll.length, "producto está", "productos están")} por debajo de su mínimo.`);

  const summarySection: SummarySection = {
    paragraphs: summaryParagraphs,
    figures: [
      { label: "Donaciones recibidas", value: fmtInt(periodDonations.length), hint: plural(donorKeys.size, "donante identificado", "donantes identificados") },
      { label: "Kilos ingresados", value: fmtKg(inflowKg), hint: "Estimado por catálogo" },
      { label: "Solicitudes", value: fmtInt(periodRequests.length), hint: withBeneficiaries > 0 ? plural(beneficiaries, "beneficiario", "beneficiarios") : undefined },
      { label: "Despachos", value: fmtInt(periodDispatches.length), hint: plural(periodDeliveries.length, "entrega confirmada", "entregas confirmadas") },
      { label: "Kilos entregados", value: fmtKg(deliveredKg), tone: "good", hint: "Entregas confirmadas" },
      { label: endsToday ? "Existencia hoy" : "Existencia al cierre", value: fmtKg(flowTotal.end) },
    ],
    balance: {
      start: flowTotal.start,
      inflow: flowTotal.inflow,
      outflow: flowTotal.outflow,
      writeOff: flowTotal.writeOff,
      adjustments: flowTotal.adjustments,
      end: flowTotal.end,
    },
    attention,
  };

  // ── Methodology ──────────────────────────────────────────────
  const missingWeightNames = Array.from(productsWithoutWeight.values()).sort((a, b) => a.localeCompare(b, "es"));
  const methodology: MethodologySection = {
    bullets: [
      "Los kilos son una estimación: cada cantidad se multiplica por el peso típico por unidad registrado en el catálogo de productos, no por un pesaje real de cada remesa.",
      "Entradas: mercancía clasificada como disponible o enviada a revisión al recibir una donación. Salidas: entregas con confirmación registrada. Bajas: mercancía rechazada en revisión. Los traslados entre ubicaciones, las reservas y las liberaciones no cambian la existencia total.",
      "La existencia al inicio del periodo se reconstruye a partir del saldo actual del inventario, descontando los movimientos registrados después de esa fecha.",
      "Las secciones de pendientes, existencias actuales y demanda sin cubrir reflejan el estado al momento de generar el reporte, sin importar el periodo elegido.",
      `Las fechas se agrupan por ${timeline.granularity === "day" ? "día" : timeline.granularity === "week" ? "semana (de lunes a domingo)" : "mes"} en la hora local de quien genera el reporte.`,
      missingWeightNames.length > 0
        ? `${plural(missingWeightNames.length, "producto incluido en el reporte no tiene", "productos incluidos en el reporte no tienen")} peso registrado y no suma${missingWeightNames.length === 1 ? "" : "n"} en los kilos: ${missingWeightNames.slice(0, 12).join(", ")}${missingWeightNames.length > 12 ? " y otros" : ""}. Se corrige desde Catálogo.`
        : "Todos los productos incluidos en el reporte tienen peso registrado en el catálogo.",
      options.includePersonalData
        ? "Este reporte incluye nombres de personas. Es de uso interno y no debe publicarse."
        : "Este reporte no incluye nombres de donantes, beneficiarios ni operadores: solo cifras agregadas.",
    ],
  };

  return {
    meta: {
      title: options.title.trim() || "Informe del Centro de Acopio",
      periodLabel: period,
      from,
      to,
      generatedAt: options.generatedAt,
      generatedBy: options.generatedBy,
      notes: options.notes.trim(),
      includePersonalData: options.includePersonalData,
      sections: options.sections,
      endsToday,
    },
    summary: summarySection,
    donations: donationsSection,
    classification: classificationSection,
    flow: flowSection,
    stock: stockSection,
    requests: requestsSection,
    dispatches: dispatchesSection,
    adjustments: adjustmentsSection,
    activity: activitySection,
    methodology,
  };
}

