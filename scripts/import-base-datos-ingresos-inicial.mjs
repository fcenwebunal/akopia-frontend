#!/usr/bin/env node
/*
 * Importa los 23 renglones de "Base de datos INGRESOS - Centro de Acopio
 * Unal.xlsx" (hoja Detalle_Ingresos, columnas D:N) -- los primeros
 * ingresos reales, del 18 de agosto de 2026, capturados en una plantilla
 * anterior incluso a INVENTARIO INTERNO. A diferencia de esa hoja, aquí
 * cada fila ya trae el donante y el producto juntos, así que se crea
 * una donación real por donante, no una bolsa genérica por día.
 *
 * Tres exclusiones, decididas con Juan Manuel el 21 ago 2026:
 *   - "Otros" (x2): el propio dato no dice qué producto es.
 *   - "Crema" SÍ se incluye -- confirmado que es crema dental (Pasta
 *     dental).
 *
 * Uso:
 *   node scripts/import-base-datos-ingresos-inicial.mjs --dry-run
 *   node scripts/import-base-datos-ingresos-inicial.mjs
 *
 * Variables: mismas que import-inventario-historico.mjs (PB_URL,
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

const RECEIPT_DATE = "2026-08-18 00:00:00.000Z";

const na = (v) => (v == null || String(v).trim() === "" || /^no aplica$/i.test(String(v).trim()) ? "" : String(v).trim());

const DONORS = [
  {
    donor_name: "Dahiana López García",
    donor_phone: "3002599281",
    donor_id_number: "1053845817",
    address: "Calle 33 # 27-81",
    registeredBy: "Juan Sebastián Rojas Aristizábal",
    items: [
      { sheetProduct: "Arroz", product: "Arroz", unitCode: "KILOGRAMO", quantity: 3 },
      { sheetProduct: "Frijol", product: "Frijol", unitCode: "KILOGRAMO", quantity: 3 },
      { sheetProduct: "Aceite", product: "Aceite vegetal", unitCode: "BOTELLA", quantity: 3, assumption: "1 kg ~ 1 botella" },
      { sheetProduct: "Atún", product: "Atún enlatado", unitCode: "LATA", quantity: 3000 / 170, assumption: "lata estándar ~170 g" },
      { sheetProduct: "Chocolate", product: "Chocolate en barra", unitCode: "PAQUETE", quantity: 3000 / 100, assumption: "paquete estándar ~100 g" },
      { sheetProduct: "Papel Higienico", product: "Papel higiénico", unitCode: "PAQUETE", quantity: 6 },
      { sheetProduct: "Protectores o toallas", product: "Toallas sanitarias", unitCode: "PAQUETE", quantity: 3, assumption: "interpretado como toallas sanitarias" },
      { sheetProduct: "Jabon", product: "Jabón de barra", unitCode: "PAQUETE", quantity: 3 },
      { sheetProduct: "Sal", product: "Sal", unitCode: "PAQUETE", quantity: 3000 / 500, assumption: "paquete estándar ~500 g" },
    ],
  },
  {
    donor_name: "Alejandro Ramirez Jiménez",
    donor_phone: "3128784160",
    donor_id_number: "1002656549",
    address: "Calle 5b #9-61 Villamaría",
    registeredBy: "Luna Restrepo",
    items: [
      { sheetProduct: "Arroz", product: "Arroz", unitCode: "KILOGRAMO", quantity: 2.5 },
      { sheetProduct: "Sal", product: "Sal", unitCode: "PAQUETE", quantity: 800 / 500, assumption: "paquete estándar ~500 g" },
      { sheetProduct: "Frijol", product: "Frijol", unitCode: "KILOGRAMO", quantity: 1 },
      { sheetProduct: "Garbanzos", product: "Garbanzo", unitCode: "KILOGRAMO", quantity: 0.5 },
      { sheetProduct: "Aceite", product: "Aceite vegetal", unitCode: "BOTELLA", quantity: 0.9, assumption: "900 ml ~ 0.9 botella" },
      { sheetProduct: "Azucar", product: "Azúcar", unitCode: "KILOGRAMO", quantity: 0.5 },
      { sheetProduct: "Pasta", product: "Pasta (fideos)", unitCode: "PAQUETE", quantity: 250 / 500, assumption: "paquete estándar ~500 g" },
      { sheetProduct: "Agua", product: "Agua embotellada 1L", unitCode: "BOTELLA", quantity: 5, assumption: "1 litro ~ 1 botella" },
    ],
  },
  {
    donor_name: "Alejandro Ramirez",
    donor_phone: "",
    donor_id_number: "",
    address: "",
    registeredBy: "Andrés Felipe Londoño Sierra",
    items: [
      { sheetProduct: "Jabon", product: "Jabón de barra", unitCode: "PAQUETE", quantity: 330 / 100, assumption: "paquete/barra estándar ~100 g" },
      { sheetProduct: "Crema", product: "Pasta dental", unitCode: "TUBO", quantity: 225 / 100, assumption: "tubo estándar ~100 g; confirmado como crema dental" },
      { sheetProduct: "Desodorante", product: "Desodorante", unitCode: "UNIDAD", quantity: 190 / 90, assumption: "unidad estándar ~90 g" },
    ],
  },
];

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection("users").authWithPassword(OPERATOR_EMAIL, OPERATOR_PASSWORD);
  const operatorId = pb.authStore.record.id;
  console.log(`Conectado a ${PB_URL} como ${OPERATOR_EMAIL}${DRY_RUN ? " [--dry-run]" : ""}\n`);

  const [products, units] = await Promise.all([
    pb.collection("products").getFullList({ fields: "id,name,default_unit_id" }),
    pb.collection("units").getFullList({ fields: "id,code" }),
  ]);
  const unitIdByCode = new Map(units.map((u) => [u.code, u.id]));
  const productByName = new Map(products.map((p) => [p.name, p]));

  let donations = 0, items = 0, itemErrors = 0;

  for (const donor of DONORS) {
    console.log(`\n== ${donor.donor_name} -- ${donor.items.length} artículos ==`);
    for (const item of donor.items) {
      const product = productByName.get(item.product);
      if (!product) console.log(`  ¡SIN CATÁLOGO! "${item.product}"`);
      const q = Math.round(item.quantity * 1000) / 1000;
      console.log(`  ${item.product.padEnd(22)} ${String(q).padStart(8)} ${item.unitCode.padEnd(10)} (hoja: "${item.sheetProduct}")${item.assumption ? `  [${item.assumption}]` : ""}`);
    }

    if (DRY_RUN) { donations++; items += donor.items.length; continue; }

    const donation = await pb.collection("donations").create({
      donor_type: "individual",
      donor_name: donor.donor_name,
      donor_phone: na(donor.donor_phone),
      donor_id_number: na(donor.donor_id_number),
      donor_id_type: na(donor.donor_id_number) ? "cedula_ciudadania" : undefined,
      receipt_date: RECEIPT_DATE,
      operator_id: operatorId,
      status: "clasificada",
      notes: `Carga histórica desde "Base de datos INGRESOS - Centro de Acopio Unal.xlsx" (Detalle_Ingresos), plantilla previa a INVENTARIO INTERNO. Dirección original: ${na(donor.address) || "no registrada"}. Registrado por: ${donor.registeredBy}.`,
    });
    donations++;
    console.log(`  Donación ${donation.code} creada (${donation.id})`);

    for (const item of donor.items) {
      const product = productByName.get(item.product);
      if (!product) { itemErrors++; continue; }
      try {
        await pb.collection("donation_items").create({
          donation_id: donation.id,
          product_id: product.id,
          unit_id: unitIdByCode.get(item.unitCode),
          quantity: Math.round(item.quantity * 1000) / 1000,
          classification_status: "available",
          notes: `Importado de Base de datos INGRESOS (Excel): "${item.sheetProduct}"${item.assumption ? ` -- ${item.assumption}` : ""}`,
        });
        items++;
      } catch (err) {
        itemErrors++;
        console.error(`  ERROR ${item.product}: ${err?.response?.message || err.message}`);
      }
    }
  }

  console.log(`\n${"=".repeat(50)}\nRESUMEN${DRY_RUN ? " (dry-run, nada se escribió)" : ""}\n${"=".repeat(50)}`);
  console.log(`Donaciones: ${donations}  |  Artículos: ${items}  |  Errores: ${itemErrors}`);
}

main().catch((err) => {
  console.error("Falló:", err?.response ?? err);
  process.exit(1);
});
