"use client";

import { pdf } from "@react-pdf/renderer";
import type { ReportData } from "@/lib/reports/types";
import { registerReportFonts } from "./pdf-theme";
import { ReportDocument } from "./report-document";

/*
 * Loaded with a dynamic `import()` from the reports page, so the PDF
 * engine (and its WebAssembly layout module) only downloads when someone
 * actually generates a report. Production CSP needs 'wasm-unsafe-eval'
 * in script-src for that module; see src/proxy.ts.
 */
export async function renderReportBlob(data: ReportData): Promise<Blob> {
  const origin = window.location.origin;
  registerReportFonts(origin);
  return pdf(<ReportDocument data={data} assets={{ shieldSrc: `${origin}/reports/escudo-unal-white.png` }} />).toBlob();
}
