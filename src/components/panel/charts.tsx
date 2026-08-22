"use client";

import type { LucideIcon } from "lucide-react";
import { CutIcon } from "@/components/ui/cut-icon";

/*
 * Gráficos hechos a mano en SVG/HTML plano, sin librería: son formas
 * simples (barra horizontal, barra segmentada, barras por día, anillo,
 * tabla) y traer una dependencia para esto sería más pesado que
 * escribirlas. Colores por `var(--viz-*)`, definidos y validados en
 * globals.css con el script de la skill de dataviz (separación CVD, de
 * visión normal, contraste, banda de luminosidad) — un solo matiz por
 * magnitud, una paleta categórica fija solo cuando la serie es
 * identidad (tipo de donante), nunca "arcoíris" para distinguir algo
 * que ya se distingue por su etiqueta.
 */

export function StatTile({
  label,
  value,
  hint,
  tone = "neutral",
  href,
  icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "neutral" | "good" | "warning" | "critical";
  href?: string;
  icon?: LucideIcon;
}) {
  const toneClass =
    tone === "good"
      ? "border-unal-green"
      : tone === "warning"
        ? "border-unal-yellow"
        : tone === "critical"
          ? "border-unal-red"
          : "border-(--rule)";

  const iconToneClass =
    tone === "good"
      ? "text-unal-green"
      : tone === "warning"
        ? "text-unal-yellow"
        : tone === "critical"
          ? "text-unal-red"
          : "text-(--muted)";

  const content = (
    <div
      className={`relative isolate h-full overflow-hidden rounded border border-(--rule) border-l-4 ${toneClass} bg-(--surface) p-3 sm:p-4`}
    >
      {icon ? (
        <CutIcon icon={icon} sizeClass="h-16 w-16" className={`opacity-[0.12] ${iconToneClass}`} />
      ) : null}
      <div className="relative z-1">
        <p className="text-2xl font-black tabular-nums sm:text-3xl">{value}</p>
        <p className="mt-1 text-sm text-(--muted)">{label}</p>
        {hint ? <p className="mt-1.5 text-xs font-bold text-(--ink-2)">{hint}</p> : null}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <a href={href} className="block h-full transition-opacity hover:opacity-80">
      {content}
    </a>
  );
}

// Franja de tres tramos con leyenda directa — no hace falta leyenda
// aparte con solo tres series, cada una ya lleva su etiqueta y su cifra.
export function DistributionBar({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div>
      <div className="flex h-6 w-full overflow-hidden rounded-full bg-(--surface-2)">
        {segments.map((segment, i) => {
          const pct = total > 0 ? (segment.value / total) * 100 : 0;
          if (pct <= 0) return null;
          return (
            <div
              key={segment.label}
              style={{ width: `${pct}%`, backgroundColor: segment.color }}
              className={i > 0 ? "ml-0.5" : ""}
              title={`${segment.label}: ${segment.value.toLocaleString("es-CO")}`}
            />
          );
        })}
      </div>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        {segments.map((segment) => {
          const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <div key={segment.label}>
              <dt className="flex items-center gap-1.5 text-(--muted)">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{segment.label}</span>
              </dt>
              <dd className="font-bold tabular-nums">
                {segment.value.toLocaleString("es-CO")}{" "}
                <span className="font-normal text-(--muted)">({pct}%)</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

// ~42px por fila (línea de texto + barra + espacio) — con `maxVisibleRows`
// las dos cuadrículas que se muestran una al lado de la otra
// ("Productos con existencia por grupo" / "Stock por categoría") quedan
// con exactamente el mismo alto fijo, tengan 3 filas o 30: lo que sobra
// se ve con scroll propio, en vez de estirar la tarjeta y desalinear el
// resto del panel.
const ROW_HEIGHT_PX = 42;

// Barras horizontales, un solo matiz, extremos redondeados. El orden
// (descendente) ya comunica el ranking — el color no necesita repetirlo.
export function HorizontalBarChart({
  rows,
  color = "var(--viz-magnitude)",
  unitLabel,
  maxVisibleRows,
}: {
  rows: { label: string; value: number }[];
  color?: string;
  unitLabel?: string;
  /** Alto fijo (en filas) con scroll propio para el resto — ver arriba. */
  maxVisibleRows?: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  const list = (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-0.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-medium" title={row.label}>
              {row.label}
            </span>
            <span className="shrink-0 tabular-nums text-(--muted)">
              {row.value.toLocaleString("es-CO")}
              {unitLabel ? ` ${unitLabel}` : ""}
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-(--surface-2)">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(3, (row.value / max) * 100)}%`,
                backgroundColor: color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );

  if (!maxVisibleRows) return list;

  return (
    <div style={{ maxHeight: `${maxVisibleRows * ROW_HEIGHT_PX}px` }} className="overflow-y-auto pr-1">
      {list}
    </div>
  );
}

interface DaySeries {
  label: string;
  color: string;
  /** Valor por día, indexado por la misma `key` que trae `days`. */
  values: Record<string, number>;
}

/*
 * Barras verticales por día — para una tendencia corta (7-14 días) sin
 * necesidad de ejes propios: la fila de etiquetas hace ese trabajo. Con
 * una sola serie (`series.length === 1`) muestra el número sobre cada
 * barra, igual que siempre; con dos o más, el número por barra se vuelve
 * ruido (14 días × N series), así que la lectura exacta pasa al `title`
 * de cada barra (tooltip nativo) y la identidad de cada serie a la
 * leyenda de abajo — nunca solo el color, con dos series o más.
 */
export function DailyBarChart({
  days,
  series,
}: {
  days: { key: string; label: string; isToday?: boolean }[];
  series: DaySeries[];
}) {
  const max = Math.max(1, ...series.flatMap((s) => days.map((d) => s.values[d.key] ?? 0)));
  const BAR_AREA_PX = 80;
  const showValues = series.length === 1;

  return (
    <div>
      <div className="flex items-end gap-1">
        {days.map((day) => (
          <div
            key={day.key}
            className={`flex flex-1 flex-col items-center gap-1 rounded ${day.isToday ? "bg-(--surface-2)" : ""}`}
          >
            {showValues ? (
              <span className="text-xs font-bold tabular-nums text-(--ink-2)">
                {(series[0].values[day.key] ?? 0) > 0 ? series[0].values[day.key] : " "}
              </span>
            ) : (
              <span aria-hidden="true" className="text-xs">
                &nbsp;
              </span>
            )}
            <div
              className="flex w-full items-end justify-center gap-0.5 px-0.5"
              style={{ height: `${BAR_AREA_PX}px` }}
            >
              {series.map((s) => {
                const value = s.values[day.key] ?? 0;
                return (
                  <div
                    key={s.label}
                    className="w-full rounded-t"
                    title={`${s.label}, ${day.label}: ${value.toLocaleString("es-CO")}`}
                    style={{
                      height: `${value > 0 ? Math.max(6, (value / max) * BAR_AREA_PX) : 2}px`,
                      backgroundColor: value === 0 ? "var(--rule)" : s.color,
                    }}
                  />
                );
              })}
            </div>
            <span
              className={`text-[0.65rem] uppercase tracking-wide ${day.isToday ? "font-bold text-(--ink)" : "text-(--muted)"}`}
            >
              {day.label}
            </span>
          </div>
        ))}
      </div>

      {series.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {series.map((s) => (
            <span key={s.label} className="flex items-center gap-1.5 text-(--muted)">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: s.color }}
                aria-hidden="true"
              />
              {s.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/*
 * Anillo (donut) por trazo de `<circle>` con `stroke-dasharray`/
 * `-dashoffset` — la técnica estándar para no calcular arcos a mano.
 * `-rotate-90` en el SVG hace que el primer segmento arranque a las 12,
 * como en un reloj. Un hueco de 3px entre segmentos (recortado del
 * final de cada trazo, antes de avanzar al siguiente) separa los
 * colores igual que ya hace `DistributionBar` con su `ml-0.5`.
 *
 * Con 4 series categóricas, la ley de la skill de dataviz vuelve
 * obligatoria la etiqueta directa — aquí es la leyenda con cifra y
 * porcentaje, siempre visible debajo del anillo, nunca solo el color.
 */
export function DonutChart({
  segments,
  centerLabel,
}: {
  segments: { label: string; value: number; color: string }[];
  centerLabel?: string;
}) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const size = 140;
  const stroke = 22;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = 3;

  const arcs: (typeof segments[number] & { visible: number; start: number })[] = [];
  let cumulative = 0;
  for (const segment of segments) {
    if (segment.value <= 0) continue;
    const length = (segment.value / total) * circumference;
    arcs.push({ ...segment, visible: Math.max(0, length - gap), start: cumulative });
    cumulative += length;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={stroke}
          />
          {arcs.map((arc) => (
            <circle
              key={arc.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={stroke}
              strokeDasharray={`${arc.visible} ${circumference - arc.visible}`}
              strokeDashoffset={-arc.start}
            >
              <title>{`${arc.label}: ${arc.value.toLocaleString("es-CO")}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-black tabular-nums">{total.toLocaleString("es-CO")}</span>
          {centerLabel ? <span className="text-[0.65rem] text-(--muted)">{centerLabel}</span> : null}
        </div>
      </div>

      <dl className="w-full space-y-1.5 text-sm">
        {segments.map((segment) => {
          const pct = total > 0 ? Math.round((segment.value / total) * 100) : 0;
          return (
            <div key={segment.label} className="flex items-center justify-between gap-2">
              <dt className="flex min-w-0 items-center gap-1.5 text-(--muted)">
                <span
                  className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                <span className="truncate">{segment.label}</span>
              </dt>
              <dd className="shrink-0 font-bold tabular-nums">
                {segment.value.toLocaleString("es-CO")}{" "}
                <span className="font-normal text-(--muted)">({pct}%)</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/*
 * Tabla compacta, solo cifras (además de la etiqueta de fila, que es
 * quien identifica cada renglón). Encabezado fijo (`sticky`) y un alto
 * máximo con scroll propio — el resto del panel no debe estirarse
 * porque haya muchas ubicaciones.
 */
export function NumberTable({
  columns,
  rows,
  maxVisibleRows = 6,
}: {
  columns: string[];
  rows: { label: string; values: (number | null)[] }[];
  maxVisibleRows?: number;
}) {
  return (
    <div
      style={{ maxHeight: `${maxVisibleRows * ROW_HEIGHT_PX}px` }}
      className="overflow-y-auto rounded border border-(--rule)"
    >
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-(--surface-2) text-xs uppercase tracking-wide text-(--muted)">
          <tr>
            <th className="px-3 py-2 text-left font-bold">{columns[0]}</th>
            {columns.slice(1).map((c) => (
              <th key={c} className="px-3 py-2 text-right font-bold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-(--rule)">
          {rows.map((row) => (
            <tr key={row.label}>
              <td className="max-w-[9rem] truncate px-3 py-2 font-medium" title={row.label}>
                {row.label}
              </td>
              {row.values.map((value, i) => (
                <td key={i} className="px-3 py-2 text-right tabular-nums">
                  {value !== null && value > 0 ? (
                    value.toLocaleString("es-CO")
                  ) : (
                    <span className="text-(--muted)">—</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
