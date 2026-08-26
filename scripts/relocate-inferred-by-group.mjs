#!/usr/bin/env node
/*
 * Reubica automáticamente los renglones "Por Ubicar" cuyo grupo de
 * catálogo calza sin ambigüedad con el nombre de una ubicación activa
 * ya existente. Pedido explícito de Juan Manuel, 25 ago 2026 ("ayúdame
 * a reubicar los productos que puedas inferir su ubicación").
 *
 * Mapeo confirmado con Juan Manuel antes de correr esto (AskUserQuestion
 * para el único caso ambiguo -- "Elementos de Aseo"):
 *   - Alimentos y Bebidas          -> ALIMENTOS (NO PERECEDEROS)
 *   - Mascotas                     -> COMIDA PARA MASCOTAS
 *   - Medicamentos y Botiquines    -> MEDICAMENTOS Y PRIMEROS AUXILIOS
 *   - Higiene Personal             -> ELEMENTOS DE ASEO
 *   - Limpieza del Hogar           -> ELEMENTOS DE ASEO
 *
 * A propósito NO se tocan (se quedan "Por Ubicar"): Agua, Hogar,
 * Herramientas y Equipos, Ropa y Calzado -- ninguna de las 5 ubicaciones
 * existentes calza con esos grupos, e inventar una asignación sería
 * peor que dejarlos pendientes de una decisión real.
 *
 * Mueve la cantidad DISPONIBLE completa de cada renglón (lo reservado
 * se queda donde estaba -- así es como ya funciona /relocate para
 * cualquier reubicación manual, no es un comportamiento nuevo de este
 * script).
 *
 * Uso:
 *   node scripts/relocate-inferred-by-group.mjs --dry-run
 *   node scripts/relocate-inferred-by-group.mjs
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

const GROUP_TO_LOCATION_ZONE = {
  "Alimentos y Bebidas": "ALIMENTOS (NO PERECEDEROS)",
  "Mascotas": "COMIDA PARA MASCOTAS",
  "Medicamentos y Botiquines": "MEDICAMENTOS Y PRIMEROS AUXILIOS",
  "Higiene Personal": "ELEMENTOS DE ASEO",
  "Limpieza del Hogar": "ELEMENTOS DE ASEO",
};

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection("users").authWithPassword(OPERATOR_EMAIL, OPERATOR_PASSWORD);
  console.log(`Conectado a ${PB_URL} como ${OPERATOR_EMAIL}${DRY_RUN ? " [--dry-run]" : ""}\n`);

  const [locations, products, categories, groups] = await Promise.all([
    pb.collection("locations").getFullList({ filter: "active = true" }),
    pb.collection("products").getFullList({ fields: "id,name,category_id" }),
    pb.collection("categories").getFullList({ fields: "id,name,group_id" }),
    pb.collection("groups").getFullList({ fields: "id,name" }),
  ]);
  const locationByZone = new Map(locations.map((l) => [l.zone, l]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const groupById = new Map(groups.map((g) => [g.id, g]));
  const productById = new Map(products.map((p) => [p.id, p]));

  // Confirma que las 5 ubicaciones esperadas existen tal como se
  // inspeccionaron -- si alguna cambió de nombre entre la inspección y
  // esta corrida, mejor fallar temprano que reubicar a ciegas.
  for (const zone of new Set(Object.values(GROUP_TO_LOCATION_ZONE))) {
    if (!locationByZone.has(zone)) {
      console.error(`No existe (o no está activa) la ubicación "${zone}". Abortando.`);
      process.exit(1);
    }
  }

  const rows = await pb.collection("inventory").getFullList({
    filter: "available_qty > 0 && (location_id = '' || location_id = null)",
  });

  const plan = [];
  const skipped = [];
  for (const row of rows) {
    const product = productById.get(row.product_id);
    const category = product ? categoryById.get(product.category_id) : null;
    const group = category ? groupById.get(category.group_id) : null;
    const zone = group ? GROUP_TO_LOCATION_ZONE[group.name] : null;
    const location = zone ? locationByZone.get(zone) : null;

    if (!location) {
      skipped.push({ name: product?.name || row.product_id, group: group?.name || "?", qty: row.available_qty });
      continue;
    }
    plan.push({ row, product, location, qty: row.available_qty });
  }

  console.log(`=== PLAN: ${plan.length} renglones a reubicar, ${skipped.length} sin ubicación que calce ===\n`);
  const byLocation = new Map();
  for (const p of plan) {
    if (!byLocation.has(p.location.zone)) byLocation.set(p.location.zone, []);
    byLocation.get(p.location.zone).push(p);
  }
  for (const [zone, items] of byLocation.entries()) {
    console.log(`-- ${zone} (${items.length}) --`);
    for (const it of items) console.log(`  ${it.product?.name?.padEnd(30) || it.row.product_id}  qty=${it.qty}`);
  }
  console.log(`\n-- Sin ubicación que calce, se quedan "Por Ubicar" (${skipped.length}) --`);
  for (const s of skipped) console.log(`  ${s.name.padEnd(30)} grupo="${s.group}" qty=${s.qty}`);

  if (DRY_RUN) {
    console.log(`\nDRY-RUN: nada se escribió.`);
    return;
  }

  console.log(`\n=== Ejecutando ===`);
  let ok = 0, errors = [];
  for (const p of plan) {
    try {
      await fetch(pb.buildURL(`/api/inventory/${p.row.id}/relocate`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
        body: JSON.stringify({
          location_id: p.location.id,
          quantity: p.qty,
          notes: "Reubicación inferida por grupo de catálogo, pedido de Juan Manuel 25 ago 2026",
        }),
      }).then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}: ${JSON.stringify(await r.json().catch(() => ({})))}`);
      });
      ok++;
      console.log(`  OK  ${p.product?.name} -> ${p.location.zone}`);
    } catch (err) {
      errors.push({ name: p.product?.name, error: err.message });
      console.error(`  ERROR ${p.product?.name}: ${err.message}`);
    }
  }

  console.log(`\n${"=".repeat(50)}\nRESUMEN\n${"=".repeat(50)}`);
  console.log(`Reubicados: ${ok}/${plan.length}  |  Errores: ${errors.length}  |  Sin ubicación que calce: ${skipped.length}`);
}

main().catch((err) => {
  console.error("Falló:", err?.response ?? err);
  process.exit(1);
});
