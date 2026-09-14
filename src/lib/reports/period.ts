import { fmtDate } from "./format";

export type PeriodPreset = "all" | "last7" | "last30" | "thisMonth" | "custom";

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "all", label: "Todo el histórico" },
  { id: "last7", label: "Últimos 7 días" },
  { id: "last30", label: "Últimos 30 días" },
  { id: "thisMonth", label: "Este mes" },
  { id: "custom", label: "Personalizado" },
];

export interface ReportRange {
  // null means "since the first record", resolved once the data is loaded.
  from: Date | null;
  to: Date;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

// `<input type="date">` yields "YYYY-MM-DD", which `new Date()` would
// parse as UTC midnight: the previous day in Colombia.
export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function toDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function resolveRange(
  preset: PeriodPreset,
  customFrom: string,
  customTo: string,
  now = new Date()
): ReportRange | null {
  const to = endOfDay(now);

  switch (preset) {
    case "all":
      return { from: null, to };
    case "last7": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 6);
      return { from, to };
    }
    case "last30": {
      const from = startOfDay(now);
      from.setDate(from.getDate() - 29);
      return { from, to };
    }
    case "thisMonth":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case "custom": {
      const from = parseDateInput(customFrom);
      const until = parseDateInput(customTo);
      if (!from || !until || from > until) return null;
      return { from: startOfDay(from), to: endOfDay(until) };
    }
  }
}

export function periodLabel(from: Date, to: Date): string {
  return `Del ${fmtDate(from)} al ${fmtDate(to)}`;
}
