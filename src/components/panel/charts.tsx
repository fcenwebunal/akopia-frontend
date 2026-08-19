"use client";

import type { LucideIcon } from "lucide-react";
import { CutIcon } from "@/components/ui/cut-icon";

/*
 * Gráficos hechos a mano en SVG plano, sin librería: son tres formas
 * simples (barra horizontal, barra segmentada, barras por día) y traer
 * una dependencia para esto sería más pesado que escribirlas. Colores
 * por `var(--viz-*)`, definidos y validados en globals.css — un solo
 * matiz por magnitud, nunca "arcoíris" para distinguir categorías que
 * ya se distinguen por su etiqueta.
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
      className={`relative isolate overflow-hidden rounded border border-(--rule) border-l-4 ${toneClass} bg-(--surface) p-4`}
    >
      {icon ? (
        <CutIcon icon={icon} sizeClass="h-16 w-16" className={`opacity-[0.12] ${iconToneClass}`} />
      ) : null}
      <div className="relative z-1">
        <p className="text-3xl font-black tabular-nums">{value}</p>
        <p className="mt-1 text-sm text-(--muted)">{label}</p>
        {hint ? <p className="mt-1.5 text-xs font-bold text-(--ink-2)">{hint}</p> : null}
      </div>
    </div>
  );

  if (!href) return content;

  return (
    <a href={href} className="block transition-opacity hover:opacity-80">
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
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: segment.color }}
                  aria-hidden="true"
                />
                {segment.label}
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

// Barras horizontales, un solo matiz, extremos redondeados. El orden
// (descendente) ya comunica el ranking — el color no necesita repetirlo.
export function HorizontalBarChart({
  rows,
  color = "var(--viz-magnitude)",
  unitLabel,
}: {
  rows: { label: string; value: number }[];
  color?: string;
  unitLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  return (
    <div className="space-y-2.5">
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-0.5 flex items-baseline justify-between text-sm">
            <span className="font-medium">{row.label}</span>
            <span className="tabular-nums text-(--muted)">
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
}

// Barras verticales por día — para una tendencia corta (7-14 días) sin
// necesidad de ejes propios: la fila de etiquetas hace ese trabajo.
export function DailyBarChart({
  days,
  color = "var(--viz-magnitude)",
}: {
  days: { key: string; label: string; value: number; isToday?: boolean }[];
  color?: string;
}) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const BAR_AREA_PX = 80;

  return (
    <div className="flex items-end gap-1.5">
      {days.map((day) => (
        <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-xs font-bold tabular-nums text-(--ink-2)">
            {day.value > 0 ? day.value : " "}
          </span>
          <div
            className="flex w-full items-end justify-center"
            style={{ height: `${BAR_AREA_PX}px` }}
          >
            <div
              className="w-full rounded-t"
              style={{
                height: `${day.value > 0 ? Math.max(6, (day.value / max) * BAR_AREA_PX) : 2}px`,
                backgroundColor: day.value === 0 ? "var(--rule)" : day.isToday ? "var(--viz-magnitude)" : color,
                opacity: day.value > 0 && !day.isToday ? 0.55 : 1,
              }}
            />
          </div>
          <span
            className={`text-[0.65rem] uppercase tracking-wide ${day.isToday ? "font-bold text-(--ink)" : "text-(--muted)"}`}
          >
            {day.label}
          </span>
        </div>
      ))}
    </div>
  );
}
