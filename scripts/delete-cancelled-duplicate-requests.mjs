#!/usr/bin/env node
/*
 * Elimina las solicitudes en estado "cancelada" que quedaron como rastro
 * de los dos rehechos de la segunda entrega de mercados (25/26 ago 2026)
 * -- cada rehecho cancela las 30 solicitudes del intento anterior antes
 * de crear las nuevas, pero cancelar nunca borra el registro. El
 * resultado, dos rondas después: 60 solicitudes "Cancelada" en el
 * listado, todas duplicados del mismo evento ya resuelto en las 30
 * solicitudes activas (`despachada`) actuales -- puro ruido que puede
 * confundirse con cancelaciones reales. Pedido explícito de Juan Manuel,
 * 26 ago 2026.
 *
 * Usa la ruta de "eliminar con motivo" ya existente
 * (`11_edit_delete_with_reason.pb.js`), la misma que ya revisa
 * dependencias antes de borrar -- por eso primero se filtra a solo las
 * que no tengan despacho vivo (ya verificado: 0/60 lo tienen, porque el
 * despacho de cada intento anterior también se borró en su momento).
 *
 * Uso:
 *   node scripts/delete-cancelled-duplicate-requests.mjs --dry-run
 *   node scripts/delete-cancelled-duplicate-requests.mjs
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import PocketBase from "pocketbase";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(__dirname, "..", ".env.import"));
} catch {
  // sin archivo -- se asume que las variables ya están en el entorno
}

const DRY_RUN = process.argv.includes("--dry-run");
const PB_URL = process.env.PB_URL || "https://acopio.manizales.unal.edu.co";
const OPERATOR_EMAIL = process.env.AKOPIA_OPERATOR_EMAIL || "admin@akopia.org";
const OPERATOR_PASSWORD = process.env.AKOPIA_OPERATOR_PASSWORD;

if (!OPERATOR_PASSWORD) {
  console.error("Falta AKOPIA_OPERATOR_PASSWORD (variable de entorno o .env.import).");
  process.exit(1);
}

const REASON =
  "Duplicado de un rehecho anterior de la 'segunda entrega de mercados' -- la solicitud activa de esta persona ya existe, despachada, con otro código. Se elimina para no confundir el listado con cancelaciones reales.";

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection("users").authWithPassword(OPERATOR_EMAIL, OPERATOR_PASSWORD);
  console.log(`Conectado a ${PB_URL} como ${OPERATOR_EMAIL}${DRY_RUN ? " [--dry-run]" : ""}\n`);

  const cancelled = await pb.collection("requests").getFullList({
    filter: 'status = "cancelada" && notes ~ "Segunda entrega de mercados"',
    sort: "code",
  });
  console.log(`Solicitudes canceladas de la segunda entrega encontradas: ${cancelled.length}`);

  const plan = [];
  for (const r of cancelled) {
    const dispatches = await pb.collection("dispatches").getFullList({ filter: `request_id = "${r.id}"` });
    if (dispatches.length > 0) {
      console.log(`  SALTADA (tiene despacho vivo): ${r.code} ${r.requester_name}`);
      continue;
    }
    plan.push(r);
  }
  console.log(`\nA eliminar: ${plan.length} de ${cancelled.length}\n`);

  if (DRY_RUN) {
    for (const r of plan) console.log(`  ${r.code} "${r.requester_name}" (creada ${r.created})`);
    console.log("\nDRY-RUN: nada se escribió.");
    return;
  }

  let ok = 0;
  const errors = [];
  for (const r of plan) {
    try {
      const res = await fetch(pb.buildURL(`/api/records/requests/${r.id}/delete`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
        body: JSON.stringify({ reason: REASON }),
      });
      if (!res.ok) throw new Error(`${res.status}: ${JSON.stringify(await res.json().catch(() => ({})))}`);
      ok++;
      console.log(`  OK  ${r.code} ${r.requester_name}`);
    } catch (err) {
      errors.push({ code: r.code, error: err.message });
      console.error(`  ERROR ${r.code}: ${err.message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}\nRESUMEN\n${"=".repeat(50)}`);
  console.log(`Eliminadas: ${ok}/${plan.length}  |  Errores: ${errors.length}`);
}

main().catch((err) => {
  console.error("Falló:", err?.response ?? err);
  process.exit(1);
});
