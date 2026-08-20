#!/usr/bin/env node
/*
 * Borra TODOS los registros del flujo de donación (donación → clasificación →
 * inventario → solicitud → reserva → despacho → entrega) en una instancia de
 * PocketBase, para volver a empezar desde cero tras una capacitación de
 * prueba. Deja intactos el catálogo (units, groups, categories, products,
 * con sus fotos), locations y users.
 *
 * Colecciones que se vacían, en este orden (hijos antes que padres, para no
 * dejar referencias colgando aunque PocketBase no las valide al borrar):
 *   audit_log → inventory_movements → adjustments → deliveries → dispatches
 *   → preparations → reservations → request_items → requests
 *   → donation_items → donations → inventory
 *
 * Uso:
 *   node scripts/wipe-donation-flow.mjs --dry-run   (solo cuenta, no borra)
 *   node scripts/wipe-donation-flow.mjs
 *
 * Variables esperadas:
 *   PB_URL             URL del backend (ej. https://akopia-backend-production.up.railway.app)
 *   PB_ADMIN_EMAIL      email del superusuario (colección _superusers)
 *   PB_ADMIN_PASSWORD   su contraseña
 */
import PocketBase from "pocketbase";

const DRY_RUN = process.argv.includes("--dry-run");

const COLLECTIONS_IN_ORDER = [
  "audit_log",
  "inventory_movements",
  "adjustments",
  "deliveries",
  "dispatches",
  "preparations",
  "reservations",
  "request_items",
  "requests",
  "donation_items",
  "donations",
  "inventory",
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Falta la variable ${name}.`);
    process.exit(1);
  }
  return value;
}

async function main() {
  const url = requireEnv("PB_URL");
  const email = requireEnv("PB_ADMIN_EMAIL");
  const password = requireEnv("PB_ADMIN_PASSWORD");

  const pb = new PocketBase(url);
  await pb.collection("_superusers").authWithPassword(email, password);

  console.log(`Conectado a ${url}${DRY_RUN ? " (dry-run, no se borra nada)" : ""}\n`);

  let totalDeleted = 0;

  for (const collectionName of COLLECTIONS_IN_ORDER) {
    const records = await pb.collection(collectionName).getFullList();

    if (records.length === 0) {
      console.log(`${collectionName}: 0 registros`);
      continue;
    }

    if (DRY_RUN) {
      console.log(`${collectionName}: ${records.length} registros (se borrarían)`);
      continue;
    }

    let deleted = 0;
    for (const record of records) {
      await pb.collection(collectionName).delete(record.id);
      deleted++;
    }
    totalDeleted += deleted;
    console.log(`${collectionName}: ${deleted} registros borrados`);
  }

  console.log(
    DRY_RUN
      ? "\nDry-run completo. Nada se borró."
      : `\nListo. ${totalDeleted} registros borrados en total. Catálogo, ubicaciones y usuarios intactos.`
  );
}

main().catch((err) => {
  console.error("Error:", err?.response ?? err);
  process.exit(1);
});
