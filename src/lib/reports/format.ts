/*
 * Number and date formatting for the PDF report.
 *
 * Ancízar Sans ships without the "·", "≈", "°" and arrow glyphs: inside
 * the PDF they would render blank, so report text uses "aprox." and "|"
 * instead.
 */

const LOCALE = "es-CO";

export function fmtInt(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Math.round(value).toLocaleString(LOCALE);
}

export function fmtDecimal(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return "0";
  return value.toLocaleString(LOCALE, { maximumFractionDigits: digits, minimumFractionDigits: 0 });
}

// Decimals only add information below 10 kg; above that they are noise
// from the catalog-based weight estimate.
export function fmtKg(value: number): string {
  if (!Number.isFinite(value)) return "0 kg";
  const abs = Math.abs(value);
  const text = abs > 0 && abs < 10 ? fmtDecimal(value, 1) : fmtInt(value);
  return `${text} kg`;
}

// Same rule as the UI's `formatQuantity`: whole units from 1 upwards,
// up to 3 decimals below 1 (grams, millilitres).
export function fmtQty(value: number): string {
  if (!Number.isFinite(value)) return "0";
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded) < 1) return fmtDecimal(rounded, 3);
  return fmtInt(rounded);
}

export function fmtPercent(part: number, total: number): string {
  if (total <= 0) return "0 %";
  return `${Math.round((part / total) * 100)} %`;
}

export function plural(count: number, singular: string, pluralForm?: string): string {
  const word = Math.round(count) === 1 ? singular : (pluralForm ?? `${singular}s`);
  return `${fmtInt(count)} ${word}`;
}

export function fmtDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, { day: "numeric", month: "long", year: "numeric" });
}

export function fmtShortDate(date: Date): string {
  return date.toLocaleDateString(LOCALE, { day: "numeric", month: "short" });
}

export function fmtDateTime(date: Date): string {
  return date.toLocaleString(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours < 0) return "sin dato";
  if (hours < 1) return `${fmtInt(hours * 60)} min`;
  if (hours < 48) return `${fmtDecimal(hours, 1)} h`;
  return `${fmtDecimal(hours / 24, 1)} días`;
}

// PocketBase stores "2026-08-18 02:06:20.908Z"; an unset date field is "".
export function parsePbDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toPbDate(date: Date): string {
  return date.toISOString().replace("T", " ");
}

export function localDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
