#!/usr/bin/env node
/*
 * Restaura la trazabilidad de donante en producción a partir de la hoja
 * "Respuestas de formulario 1" de "INVENTARIO INTERNO" (Google Sheets),
 * leída en vivo el 25 ago 2026. Pedido explícito de Juan Manuel tras
 * detectar que TODAS las donaciones en producción aparecían a nombre de
 * "Anónimo".
 *
 * Causa raíz (documentada en la conversación, no repetida aquí en detalle):
 * los 22 donantes reales importados el 21 ago se borraron en el vaciado
 * del 24 ago (a pedido explícito, con backup previo); el respaldo creado
 * esa misma noche (DON-000001) sólo reconstruyó el acumulado de la hoja
 * INGRESO, sin volver a tocar "Respuestas de formulario 1". Además, 5
 * donantes se registraron en la hoja DESPUÉS de la foto del 21 ago y
 * nunca se habían importado, ni antes del vaciado.
 *
 * Decisión confirmada con Juan Manuel (`AskUserQuestion`): esta hoja solo
 * trae un total en KG por donante, sin desglose de productos (a diferencia
 * de la hoja que sí usó import-base-datos-ingresos-inicial.mjs). No hay
 * forma de saber qué productos donó cada quien, así que este script SOLO
 * crea el registro del donante (nombre/contacto/cédula/kg total en
 * total_weight_kg), sin donation_items -- cero impacto en inventario.
 * DON-000001 sigue siendo la única fuente real del stock; esto solo
 * restaura de quién vino cada aporte, para trazabilidad/auditoría.
 *
 * Mismo patrón ya usado (y verificado en producción) el 21 ago 2026 en
 * import-inventario-historico.mjs, sección "Donantes": donor_type mapeado,
 * total_weight_kg, status "clasificada", sin ítems.
 *
 * Uso:
 *   node scripts/import-donantes-respuestas-formulario.mjs --dry-run
 *   node scripts/import-donantes-respuestas-formulario.mjs
 *
 * Variables: mismas que los demás scripts de import (PB_URL,
 * AKOPIA_OPERATOR_EMAIL, AKOPIA_OPERATOR_PASSWORD; carga .env.import).
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

// ── "Respuestas de formulario 1", leída en vivo de Google Sheets el 25 ago
// 2026 (28 filas -- 22 ya importadas una vez y borradas en el vaciado del
// 24 ago, 5 nunca importadas, y Sara Aguirre, incompleta desde siempre). ──
// Columnas: marca, correoStaff, tipo, nombre, telefono, cedula, direccion, responsable, kg, correoDonante
const ROWS = [
  ["18/08/2026 10:55:28", "lrestrepodi@unal.edu.co", "Persona Natural", "Mario Andrés Marín", "3226345865", "1038514211", "Cra 35 #101-57", "Luna Restrepo", "12.5", "mamarinmu@unal.edu.co"],
  ["18/08/2026 11:34:31", "lrestrepodi@unal.edu.co", "Persona Natural", "Andrés Felipe Marín montoya", "3212567456", "10014621", "Conjunto cerrado Monticelo", "Luna Restrepo", "15", "montoyafelipem@gmail.com"],
  ["18/08/2026 11:51:55", "lrestrepodi@unal.edu.co", "Entidad Pública", "Universidad nacional de Colombia", "3107630873", "1007234186", "Campus la nubia", "Luna Restrepo", "6", "bienestar_man@unal.edu.co"],
  ["18/08/2026 14:11:02", "aaaron@unal.edu.co", "Persona Natural", "Juan Esteban Jimenez Tello", "3017560727", "1193285052", "Cra 20 #52A 71", "Alaham Aarón", "8,1", "Jjimenezte@unal.edu.co"],
  ["18/08/2026 15:02:02", "aaaron@unal.edu.co", "Persona Natural", "Alejandro Loaiza Aristizabal", "3233779089", "1002655815", "Cra 25a #13-29", "Alaham Aarón", "3,3", "aloaizaq@unal.edu.co"],
  ["18/08/2026 15:53:41", "jarroyavea@unal.edu.co", "Persona Natural", "Camilo younes", "3002062498", "79627660", "Calle 63 234", "Julieth Arroyave", "25", "Cyounesv@unal.edu.co"],
  ["18/08/2026 15:55:44", "jarroyavea@unal.edu.co", "Persona Natural", "Natalia Vélez", "……", "…..", "….", "Julieth", "33", "Nvelezt@unql.edu.co"],
  ["18/08/2026 15:58:37", "jarroyavea@unal.edu.co", "Persona Natural", "Marta Cardona", "..,,", "….", "……", "…..", "18,9", "…."],
  ["18/08/2026 15:59:44", "jarroyavea@unal.edu.co", "Persona Natural", "Luis fernando Diaz", "3006142887", "…", "….", "….", "5", "…."],
  ["18/08/2026 16:34:37", "aaaron@unal.edu.co", "Persona Natural", "Oscar Ivan Castrillon Castrillon", "3117356388", "1053767273", "Calle 65B # 10-95 Barrio la Sultana", "Alaham Aarón", "34,1", "oicastrillonc@unal.edu.co"],
  ["18/08/2026 16:57:04", "aaaron@unal.edu.co", "Persona Natural", "Brandon Velasquez Jaramillo", "3113130751", "1002592323", "Cra 29 #38 - 18", "Alaham Aarón", "5,6", "bvelasquezj@unal.edu.co"],
  ["19/08/2026 8:29:22", "saalzates@unal.edu.co", "Persona Natural", "Sara Alzate Salazar", "3137790309", "1054398721", "Calle 2A#5-70", "Sara Alzate Salazar", "6,4", "saalzates@unal.edu.co"],
  ["19/08/2026 8:35:52", "jaristizabalh@unal.edu.co", "Persona Natural", "Aleyda Quiceno", "", "", "Laboratorio de Física", "", "3,8", ""],
  ["19/08/2026 14:24:42", "jaristizabalh@unal.edu.co", "Persona Natural", "Cristina Aguirre", "3117549610", "", "", "Juan Sebastián Rojas Aristizábal", "5,2", "maaguirrec@unal.edu.co"],
  ["19/08/2026 14:25:24", "jaristizabalh@unal.edu.co", "Persona Natural", "María Andrea Lorza", "3183329914", "", "", "Juan Sebastián Rojas Aristizábal", "17,1", "malorzap@unal.edu.co"],
  ["20/08/2026 10:17:34", "jaristizabalh@unal.edu.co", "Persona Natural", "Jhonattan de la Roche", "3005534615", "", "", "Juan Sebastián Rojas Aristizábal", "11,9", "jdey@unal.edu.co"],
  ["20/08/2026 15:29:34", "aaaron@unal.edu.co", "Entidad Pública", "Adriana Ruiz, Andrea", "3003927399", "30335563", "Cra 17 51-29", "Alaham Aarón", "3,8", "acortesd@unal.edu.co"],
  ["20/08/2026 15:32:02", "aaaron@unal.edu.co", "Persona Natural", "David Esteban Molina Castaño", "3006888216", "98644640", "", "Alaham Aarón", "1,5", "demolinac@unal.edu.co"],
  ["20/08/2026 15:33:53", "aaaron@unal.edu.co", "Persona Natural", "Lucas Iturriago", "3234894180", "1006571853", "Carrera 36 # 101 - 9, Apto 3B La Enea", "Alaham Aarón", "6,8", "liturriago@unal.edu.co"],
  ["20/08/2026 16:17:55", "aaaron@unal.edu.co", "Persona Natural", "Valeria Idarraga Hernandez", "3233496246", "1141514615", "Calle 65a # 10-11 la sultana", "Alaham Aarón", "30", "vidarragah@unal.edu.co"],
  ["21/08/2026 8:17:09", "cyounesv@unal.edu.co", "Persona Natural", "Martha Lopez", "", "", "", "", "4", ""],
  ["21/08/2026 10:40:06", "jaristizabalh@unal.edu.co", "Entidad Pública", "Universidad Nacional de Colombia Sede Bogotá", "", "", "", "Juan Sebastián Rojas Aristizábal", "1500", "vrs_bog@unal.edu.co"],
  ["21/08/2026 14:33:36", "aaaron@unal.edu.co", "Persona Natural", "Carlos Giovanni Franco Montoya", "3117571830", "1053779769", "Calle 15A # 6-11", "Alaham Aarón", "0.2", "cafrancom@unal.edu.co"],
  ["21/08/2026 16:06:05", "jaristizabalh@unal.edu.co", "Persona Natural", "Elisabeth Restrepo Parra", "3217004351", "", "", "Juan Sebastián Rojas Aristizábal", "14.1", "erestrepopa@unal.edu.co"],
  ["22/08/2026 9:13:06", "cyounesv@unal.edu.co", "Persona Natural", "Grupo de aseo élite La Nubia", "", "", "", "", "13", ""],
  ["22/08/2026 11:15:43", "cyounesv@unal.edu.co", "Persona Natural", "Mateo Aristizábal", "", "", "", "", "23", ""],
  ["24/08/2026 8:58:55", "jaristizabalh@unal.edu.co", "Persona Natural", "Leidy Luciana Guerrero", "3122542905", "", "", "Juan Sebastián Rojas Aristizábal", "2.3", "guerreroleidi98@gmail.com"],
  ["", "saaguirre@unal.edu.co", "Persona natural", "Sara Aguirre", "3104719227", "", "", "", "", ""],
];

function norm(s) {
  return (s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

const clean = (v) => (v && !/^[.\s…,]+$/.test(v) ? v.trim() : "");

const DONOR_TYPE_MAP = { "PERSONA NATURAL": "individual", "ENTIDAD PUBLICA": "institucion" };

function parseTimestamp(marca) {
  if (!marca) return null;
  const [datePart, timePart] = marca.split(" ");
  const [d, m, y] = datePart.split("/");
  return `${y}-${m}-${d} ${timePart || "00:00:00"}.000Z`;
}

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection("users").authWithPassword(OPERATOR_EMAIL, OPERATOR_PASSWORD);
  const operatorId = pb.authStore.record.id;
  console.log(`Conectado a ${PB_URL} como ${OPERATOR_EMAIL}${DRY_RUN ? " [--dry-run]" : ""}\n`);

  let ok = 0, errors = 0;

  for (const row of ROWS) {
    const [marca, correoStaff, tipo, nombreRaw, telefono, cedula, direccion, responsable, kg, correoDonante] = row;
    const nombre = (nombreRaw || "").trim();
    if (!nombre) continue;

    const kgNum = Number.parseFloat(String(kg || "").replace(",", "."));
    const hasWeight = !Number.isNaN(kgNum) && kgNum > 0;
    const timestamp = parseTimestamp(marca);
    const receiptDate = timestamp || new Date().toISOString().replace("T", " ");
    const cedulaClean = clean(cedula);

    const payload = {
      donor_type: DONOR_TYPE_MAP[norm(tipo)] || "individual",
      donor_name: nombre,
      donor_phone: clean(telefono),
      donor_email: clean(correoDonante),
      donor_id_number: cedulaClean,
      donor_id_type: cedulaClean ? "cedula_ciudadania" : undefined,
      receipt_date: receiptDate,
      operator_id: operatorId,
      status: "clasificada",
      total_weight_kg: hasWeight ? kgNum : undefined,
      notes: `Restaura la trazabilidad de donante desde "Respuestas de formulario 1" (INVENTARIO INTERNO, Google Sheets), leída en vivo el 25 ago 2026 -- tras detectar que el vaciado del 24 ago (a pedido explícito, con backup previo) había borrado los donantes reales importados el 21 ago, y que 5 donantes nunca se habían importado. Sin desglose de productos por donante (solo total en KG) -- por eso esta donación no tiene artículos; el inventario real ya está reflejado en DON-000001. Dirección original: ${clean(direccion) || "no registrada"}. Registrado por: ${clean(responsable) || correoStaff}.${!timestamp ? " Fecha original no registrada en la hoja -- se usó la fecha de esta restauración." : ""}`,
    };

    if (DRY_RUN) {
      console.log(`  [dry-run] ${nombre.padEnd(45)} ${payload.donor_type.padEnd(11)} kg=${hasWeight ? kgNum : "-"}`);
      ok++;
      continue;
    }

    try {
      const donation = await pb.collection("donations").create(payload);
      ok++;
      console.log(`  ${donation.code} -- ${nombre}`);
    } catch (err) {
      errors++;
      console.error(`  ERROR ${nombre}: ${err?.response?.message || err.message} ${JSON.stringify(err?.response?.data || {})}`);
    }
  }

  console.log(`\n${"=".repeat(60)}\nRESUMEN${DRY_RUN ? " (dry-run, nada se escribió)" : ""}\n${"=".repeat(60)}`);
  console.log(`Donantes: ${ok} OK, ${errors} con error, de ${ROWS.length} filas en la hoja`);
}

main().catch((err) => {
  console.error("Falló:", err?.response ?? err);
  process.exit(1);
});
