import { Font } from "@react-pdf/renderer";
import type { SeriesColor, Tone } from "@/lib/reports/types";

/*
 * The PDF cannot read CSS custom properties, so this mirrors the LIGHT
 * values of globals.css by hand (a printed page has no dark mode). If a
 * token changes there, change it here too. The chart colors are the
 * same validated `--viz-*` palette the dashboard uses.
 */
export const COLORS = {
  ink: "#232323",
  ink2: "#4b4b4b",
  muted: "#646464",
  rule: "#d9d9d9",
  surface: "#ffffff",
  surface2: "#f7f8f4",
  green: "#94b43b",
  greenDark: "#6f8a24",
  greenSoft: "#eef3e0",
  red: "#dc313a",
  yellow: "#f8c21c",
  chrome: "#333333",
  chromeText: "#d4d4d4",
};

export const SERIES_COLORS: Record<SeriesColor, string> = {
  available: "#6f8a24",
  reserved: "#33b3bc",
  quarantine: "#dc313a",
  magnitude: "#6f8a24",
  rejected: "#646464",
  donorIndividual: "#2a78d6",
  donorEmpresa: "#eb6834",
  donorInstitucion: "#1baf7a",
  donorAnonimo: "#eda100",
};

export const TONE_COLORS: Record<Tone, string> = {
  neutral: COLORS.rule,
  good: COLORS.green,
  warning: COLORS.yellow,
  critical: COLORS.red,
};

export const FONT_FAMILY = "AncizarSans";

let registered = false;

export function registerReportFonts(baseUrl: string) {
  if (registered) return;
  registered = true;

  Font.register({
    family: FONT_FAMILY,
    fonts: [
      { src: `${baseUrl}/reports/fonts/ancizar-sans-light.ttf`, fontWeight: 300 },
      { src: `${baseUrl}/reports/fonts/ancizar-sans-regular.ttf`, fontWeight: 400 },
      { src: `${baseUrl}/reports/fonts/ancizar-sans-bold.ttf`, fontWeight: 700 },
      { src: `${baseUrl}/reports/fonts/ancizar-sans-black.ttf`, fontWeight: 900 },
    ],
  });

  // The default callback hyphenates with English rules, which splits
  // Spanish words in odd places.
  Font.registerHyphenationCallback((word) => [word]);
}
