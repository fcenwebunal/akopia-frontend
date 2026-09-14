"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CheckSquare, ExternalLink, FileDown, Square } from "lucide-react";
import { currentUser, errorMessage } from "@/lib/pb";
import { hasAnyRole } from "@/lib/roles";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { buildReport } from "@/lib/reports/build";
import { fetchReportData } from "@/lib/reports/fetch";
import {
  PERIOD_PRESETS,
  resolveRange,
  toDateInput,
  type PeriodPreset,
} from "@/lib/reports/period";
import { REPORT_ROLES, sectionsForRoles, type ReportSectionId } from "@/lib/reports/sections";

type Status =
  | { step: "idle" }
  | { step: "working"; label: string }
  | { step: "done"; url: string; filename: string; size: string }
  | { step: "error"; message: string };

const DEFAULT_TITLE = "Informe del Centro de Acopio";

/*
 * Everything happens in the browser: the page reads PocketBase with the
 * operator's own session (so each role only gets what its access rules
 * allow), aggregates in memory, and renders the PDF client-side. Nothing
 * is stored and the server never sees the document.
 */
export default function ReportesPage() {
  const user = currentUser();
  const availableSections = useMemo(() => sectionsForRoles(user?.role), [user?.role]);

  const [preset, setPreset] = useState<PeriodPreset>("all");
  const [customFrom, setCustomFrom] = useState(() => {
    const start = new Date();
    start.setDate(start.getDate() - 6);
    return toDateInput(start);
  });
  const [customTo, setCustomTo] = useState(() => toDateInput(new Date()));
  const [selected, setSelected] = useState<Set<ReportSectionId>>(
    () => new Set(availableSections.filter((s) => s.defaultOn).map((s) => s.id))
  );
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [notes, setNotes] = useState("");
  const [includeNames, setIncludeNames] = useState(false);
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    };
  }, []);

  if (user && !hasAnyRole(user.role, REPORT_ROLES)) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es solo para administración, coordinación y comunicaciones.
      </p>
    );
  }

  const range = resolveRange(preset, customFrom, customTo);
  const orderedSelection = availableSections.filter((s) => selected.has(s.id)).map((s) => s.id);
  const busy = status.step === "working";
  const canGenerate = !busy && range !== null && orderedSelection.length > 0;

  function toggleSection(id: ReportSectionId) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function download(url: string, filename: string) {
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function generate() {
    if (!range || !user) return;

    try {
      setStatus({ step: "working", label: "Consultando los registros…" });
      const raw = await fetchReportData({
        sections: orderedSelection,
        roles: user.role,
        includePersonalData: includeNames,
        from: range.from,
        to: range.to,
      });

      setStatus({ step: "working", label: "Calculando cifras…" });
      const data = buildReport(raw, {
        title,
        notes,
        sections: orderedSelection,
        includePersonalData: includeNames,
        from: range.from,
        to: range.to,
        generatedBy: user.full_name || user.email,
        generatedAt: new Date(),
      });

      setStatus({ step: "working", label: "Armando el PDF…" });
      const { renderReportBlob } = await import("@/components/reports/render-report");
      const blob = await renderReportBlob(data);

      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
      const url = URL.createObjectURL(blob);
      lastUrl.current = url;

      const filename = `akopia-informe-${toDateInput(data.meta.from)}-a-${toDateInput(data.meta.to)}.pdf`;
      download(url, filename);
      setStatus({ step: "done", url, filename, size: `${(blob.size / 1024).toFixed(0)} KB` });
    } catch (err) {
      console.error(err);
      // PocketBase errors carry a Spanish message in `response`; anything
      // else (fonts, the PDF engine) only has its own message to offer.
      const fromBackend = typeof err === "object" && err !== null && "response" in err;
      setStatus({
        step: "error",
        message: !fromBackend && err instanceof Error ? err.message : errorMessage(err),
      });
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Reportes</h1>
      <p className="mt-1 max-w-3xl text-(--muted)">
        Genera un informe en PDF con cifras, gráficos y párrafos que resumen la operación del centro de
        acopio. Elige el periodo y las secciones; el documento se arma solo con los registros de AKOPIA.
      </p>

      <section className="mt-6 rounded border border-(--rule) bg-(--surface) p-4 sm:p-5">
        <h2 className="font-bold">1. Periodo</h2>
        <p className="mt-0.5 text-sm text-(--muted)">
          Donaciones, solicitudes, despachos y movimientos se filtran a estas fechas. Existencias y
          pendientes siempre muestran el estado de hoy.
        </p>
        <div role="radiogroup" aria-label="Periodo del reporte" className="mt-3 flex flex-wrap gap-2">
          {PERIOD_PRESETS.map((option) => {
            const active = preset === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setPreset(option.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-bold transition-colors ${
                  active
                    ? "border-unal-green-dark bg-unal-green-dark text-white"
                    : "border-(--rule) text-(--ink-2) hover:border-unal-green"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {preset === "custom" ? (
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="text-sm font-bold">
              Desde
              <input
                type="date"
                value={customFrom}
                max={customTo}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="mt-1 block rounded border border-(--rule) bg-(--surface) px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-bold">
              Hasta
              <input
                type="date"
                value={customTo}
                min={customFrom}
                max={toDateInput(new Date())}
                onChange={(event) => setCustomTo(event.target.value)}
                className="mt-1 block rounded border border-(--rule) bg-(--surface) px-3 py-2 font-normal"
              />
            </label>
            {range === null ? (
              <p role="alert" className="text-sm text-unal-red">
                La fecha inicial no puede ser posterior a la final.
              </p>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-4 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="font-bold">2. Secciones</h2>
            <p className="mt-0.5 text-sm text-(--muted)">
              {orderedSelection.length} de {availableSections.length} seleccionadas. Cada sección ocupa
              media página o una página.
            </p>
          </div>
          <div className="flex gap-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => setSelected(new Set(availableSections.map((s) => s.id)))}
              className="flex items-center gap-1 text-unal-green-dark hover:underline"
            >
              <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
              Todas
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="flex items-center gap-1 text-(--muted) hover:text-(--ink)"
            >
              <Square className="h-3.5 w-3.5" aria-hidden="true" />
              Ninguna
            </button>
          </div>
        </div>

        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {availableSections.map((section) => {
            const checked = selected.has(section.id);
            return (
              <li key={section.id}>
                <label
                  className={`flex h-full cursor-pointer gap-3 rounded border p-3 transition-colors ${
                    checked ? "border-unal-green-dark bg-(--surface-2)" : "border-(--rule) hover:border-unal-green"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSection(section.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-unal-green-dark"
                  />
                  <span>
                    <span className="block text-sm font-bold">{section.title}</span>
                    <span className="mt-0.5 block text-xs text-(--muted)">{section.description}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mt-4 rounded border border-(--rule) bg-(--surface) p-4 sm:p-5">
        <h2 className="font-bold">3. Personalización</h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-bold" htmlFor="report-title">
              Título del reporte
            </label>
            <input
              id="report-title"
              type="text"
              value={title}
              maxLength={90}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={DEFAULT_TITLE}
              className="mt-1 w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />

            <div className="mt-4">
              <Toggle
                label="Incluir nombres de personas"
                checked={includeNames}
                onChange={setIncludeNames}
              />
              <p className="mt-1.5 text-xs text-(--muted)">
                Agrega los principales donantes y la actividad por operador. El PDF queda marcado como de
                uso interno. Apagado, el reporte solo lleva cifras agregadas y se puede compartir.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold" htmlFor="report-notes">
              Observaciones <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <textarea
              id="report-notes"
              value={notes}
              maxLength={1000}
              rows={5}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Contexto que las cifras no cuentan solas: una campaña, un corte de agua, un cambio de bodega…"
              className="mt-1 w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5 text-sm"
            />
            <p className="mt-1 text-xs text-(--muted)">Aparece en la primera página, debajo del índice.</p>
          </div>
        </div>
      </section>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded border border-(--rule) bg-(--surface) p-4 sm:p-5">
        <Button onClick={generate} disabled={!canGenerate} loading={busy} icon={FileDown}>
          {busy ? status.label : "Generar PDF"}
        </Button>

        {orderedSelection.length === 0 ? (
          <p className="text-sm text-(--muted)">Elige al menos una sección.</p>
        ) : null}

        {status.step === "done" ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <p>
              <span className="font-bold text-unal-green-dark">Listo.</span> {status.filename}{" "}
              <span className="text-(--muted)">({status.size})</span>
            </p>
            <button
              type="button"
              onClick={() => download(status.url, status.filename)}
              className="font-bold text-unal-green-dark hover:underline"
            >
              Descargar de nuevo
            </button>
            <a
              href={status.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 font-bold text-unal-green-dark hover:underline"
            >
              Abrir en otra pestaña
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </a>
          </div>
        ) : null}

        {status.step === "error" ? (
          <p role="alert" className="w-full rounded border-l-4 border-unal-red bg-(--surface-2) px-4 py-3 text-sm">
            No se pudo generar el reporte: {status.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
