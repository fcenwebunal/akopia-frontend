#!/usr/bin/env node
/*
 * Importa el histórico de "INVENTARIO INTERNO" (Google Sheets, 18-21 de
 * agosto de 2026 -- lo que el equipo registró a mano mientras el
 * aplicativo no funcionaba) a AKOPIA. Decisiones tomadas con Juan Manuel
 * antes de escribir esto:
 *
 *   - Los ~355 renglones de productos se agrupan en UNA donación
 *     histórica por día (18/19/20/21 ago), sin donante específico por
 *     artículo -- no hay ninguna columna que conecte el log de productos
 *     con el registro de donantes.
 *   - Los 23 registros de "Respuestas de formulario 1" (quién donó,
 *     cuánto en KG) se importan aparte, como donaciones sin artículos.
 *   - Gramos -> Kilogramo y ml -> Litro: conversión métrica real.
 *   - Bolsa -> Kilogramo: 0.5 kg (instrucción explícita, 21 ago 2026).
 *   - De resto, criterio propio documentado por fila (ver
 *     REPORTE-PRUEBA-IMPORTACION-INVENTARIO.md, raíz del proyecto).
 *   - Todo entra como "available" salvo la categoría "Otros Medicamentos",
 *     que entra en "quarantine" -- nadie ha revisado esos medicamentos
 *     donados todavía.
 *
 * Requiere estar autenticado como un operador real (colección `users`,
 * no `_superusers`): el hook de inventario exige un operador para
 * generar los movimientos.
 *
 * Uso:
 *   node scripts/import-inventario-historico.mjs --dry-run
 *   node scripts/import-inventario-historico.mjs
 *
 * Variables esperadas (o en un archivo .env.import junto a este script,
 * cargado automáticamente si existe):
 *   PB_URL                    (por defecto, producción)
 *   AKOPIA_OPERATOR_EMAIL     (por defecto, admin@akopia.org)
 *   AKOPIA_OPERATOR_PASSWORD  (obligatoria, nunca se pide por consola)
 */
import fs from "node:fs";
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

const DATA = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "inventario-interno-2026-08.json"), "utf8")
);

// ── normalización y emparejamiento de productos ──────────────────────

function norm(s) {
  return (s || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const SYNONYMS = {
  ARROZ: "Arroz", ACEITE: "Aceite vegetal", FRIJOL: "Frijol", LENTEJA: "Lenteja",
  GARBANZO: "Garbanzo", AZUCAR: "Azúcar", SAL: "Sal", ATUN: "Atún enlatado",
  SARDINAS: "Sardina enlatada", "LECHE EN POLVO": "Leche en polvo",
  PASTA: "Pasta (fideos)", SPAGUETI: "Pasta (fideos)", CEREALES: "Cereal",
  AVENA: "Avena", AGUA: "Agua embotellada 1L", JABON: "Jabón de barra",
  "JABON DE MANOS": "Jabón líquido", "CREMA DENTAL": "Pasta dental",
  "CREMA DENTAL NINOS": "Pasta dental", "CEPILLO DE DIENTES": "Cepillo de dientes",
  "CEPILLO DE DIENTES NINOS": "Cepillo de dientes", PANALES: "Pañales para bebé",
  "PANALES PARA ADULTOS": "Pañales para adulto", "PANITOS HUMEDOS": "Toallitas húmedas",
  "TOALLA HIGIENICA": "Toallas sanitarias", "CONCENTRADO PARA PERRO": "Croquetas para perro",
  "CONCENTRADO PARA GATO": "Croquetas para gato",
  "ALIMENTO HUMEDO PARA MASCOTAS": "Alimento húmedo para mascota",
  DESODORANTE: "Desodorante", SHAMPOO: "Shampoo", "JABON PARA ROPA": "Jabón para ropa",
  "JABON DE LOZA": "Jabón para trastes", "DETERGENTE LIQUIDO": "Detergente",
  "DETERGENTE EN POLVO": "Detergente", "PROTECTOR SOLAR": "Bloqueador solar",
  ALCOHOL: "Alcohol", "GAFAS DE SEGURIDAD": "Lentes de protección", TAPABOCAS: "Tapabocas",
  "PANTALON HOMBRE": "Pantalones", "PANTALON MUJER": "Pantalones",
  "PANTALON NIN@": "Pantalones", CAMISETA: "Playeras", CASCOS: "Casco",
  "ZAPATOS HOMBRE": "Calzado", "ZAPATOS MUJER": "Calzado", "ZAPATOS NIN@": "Calzado",
  "BULTO CEMENTO": "Cemento", PERFILES: "Perlin", GUANTES: "Guantes de trabajo",
  ACETAMINOFEN: "Paracetamol", GALLETAS: "Galletas saladas",
  "BEBIDA ACHOCOLATADA": "Chocolate en polvo", CHOCOLATE: "Chocolate en barra",
  PROTECTORES: "Protectores diarios", CONDIMENTOS: "Condimentos varios",
  ENLATADOS: "Enlatados varios", HARINA: "Harina de trigo",
  "HARINA DE MAIZ": "Harina de maíz", "JABON BEBE": "Jabón para bebé",
  "SACO MUJER": "Saco", "SACO HOMBRE": "Saco", "SACO NINA": "Saco", "SACO NINO": "Saco",
  "TOALLA CUERPO": "Toalla de cuerpo", "ABRIGO MUJER": "Abrigo",
  "PAQUETE DE PELOTAS DE TRAPO": "Pelotas de trapo",
  "CREMA ANTIPANIALITIS": "Crema antipañalitis", "ARENA PARA GATOS": "Arena para gatos",
  "BOLSA DESECHOS ANIMALES": "Bolsa desechos para mascotas",
};
for (let i = 1; i <= 30; i++) SYNONYMS[`PAPEL HIGIENICO X${i} UND`] = "Papel higiénico";

function contextOverride(sheetProductNorm, note) {
  const n = norm(note);
  if (sheetProductNorm === "FRIJOL" && n.includes("LATA")) return "Frijoles enlatados";
  if (sheetProductNorm === "ENLATADOS" && (n.includes("VERDURA") || n.includes("ALBERJA") || n.includes("ZANAHORIA")))
    return "Verduras enlatadas";
  return null;
}

const FALLBACK_FACTORS = {
  "Aceite vegetal|LITRO": 1, "Aceite vegetal|UNIDAD": 1,
  "Agua embotellada 1L|LITRO": 1, "Agua embotellada 1L|UNIDAD": 1,
  "Alcohol|UNIDAD": 1, "Shampoo|BOLSA": 1,
  "Atún enlatado|GRAMOS": 1 / 170, "Atún enlatado|KILOGRAMO": 1000 / 170, "Atún enlatado|UNIDAD": 1,
  "Alimento húmedo para mascota|GRAMOS": 1 / 400,
  "Cereal|GRAMOS": 1 / 400, "Avena|GRAMOS": 1 / 500,
  "Leche en polvo|GRAMOS": 1 / 400, "Leche en polvo|KILOGRAMO": 1000 / 400,
  "Pasta (fideos)|GRAMOS": 1 / 500, "Pasta (fideos)|KILOGRAMO": 1000 / 500,
  "Sal|GRAMOS": 1 / 500, "Sal|KILOGRAMO": 1000 / 500, "Sal|UNIDAD": 1,
  "Jabón de barra|UNIDAD": 1, "Jabón de barra|BOLSA": 1,
  "Jabón para ropa|UNIDAD": 1, "Detergente|UNIDAD": 1,
  "Panela|PAQUETE": 1, "Tapabocas|BOLSA": 0.1, "Tapabocas|PAQUETE": 0.1,
  "Pasta dental|UNIDAD": 1,
  "Croquetas para perro|KILOGRAMO": 1 / 20, "Croquetas para gato|KILOGRAMO": 1 / 20,
  "Cepillo de dientes|PAR": 2,
  "Chocolate en barra|KILOGRAMO": 1000 / 100, "Chocolate en barra|GRAMOS": 1 / 100,
  "Máquina de afeitar|PAQUETE": 4, "Kits dentales|PAQUETE": 1,
  "Tampones|PAQUETE": 1, "Curitas|PAQUETE": 1,
  "Desodorante|GRAMOS": 1, "Papel higiénico|GRAMOS": 1,
  "Protectores diarios|CAJA": 1, "Quintamanchas|BOLSA": 1,
};

function unitCodeFromSheetLabel(label) {
  const n = norm(label);
  const map = {
    KG: "KILOGRAMO", KILOGRAMOS: "KILOGRAMO", GRAMOS: "GRAMOS",
    LITROS: "LITRO", ML: "ML", MILILITROS: "ML",
    UNIDADES: "UNIDAD", UNIDAD: "UNIDAD", PAQUETES: "PAQUETE", PAQUETE: "PAQUETE",
    BOLSAS: "BOLSA", BOLSA: "BOLSA", BOTELLAS: "BOTELLA", BOTELLA: "BOTELLA",
    CAJAS: "CAJA", CAJA: "CAJA", TABLETAS: "TABLETAS", PARES: "PAR", BULTOS: "BULTO",
  };
  return map[n] || null;
}

function noteMultiplier(note) {
  const n = norm(note);
  const m = n.match(/(\d+)\s*(?:UNIDADES?)?\s*(?:POR|CADA|X)\s*PA?QUETE|DE\s*(\d+)\s*UNIDADES?\s*CADA/);
  if (m) return Number.parseInt(m[1] || m[2], 10);
  const m2 = n.match(/^(\d+)\s*POR\s*PAQUETEO?$/);
  if (m2) return Number.parseInt(m2[1], 10);
  return null;
}

function convert(product, sheetUnitLabel, sheetQuantityRaw, note) {
  const { name, defaultUnitCode } = product;
  const qty = Number.parseFloat(String(sheetQuantityRaw).replace(",", "."));
  if (!sheetUnitLabel || Number.isNaN(qty) || qty <= 0) return { skip: "cantidad o unidad vacía/no numérica" };

  const sheetUnitCode = unitCodeFromSheetLabel(sheetUnitLabel);
  if (!sheetUnitCode) return { skip: `unidad de hoja no reconocida: "${sheetUnitLabel}"` };

  const directCode = sheetUnitCode === "GRAMOS" ? "KILOGRAMO" : sheetUnitCode === "ML" ? "LITRO" : sheetUnitCode;
  if (directCode === defaultUnitCode && sheetUnitCode !== "GRAMOS" && sheetUnitCode !== "ML") {
    return { quantity: qty, unitCode: defaultUnitCode };
  }
  if (sheetUnitCode === "GRAMOS" && defaultUnitCode === "KILOGRAMO") return { quantity: qty / 1000, unitCode: defaultUnitCode };
  if (sheetUnitCode === "ML" && defaultUnitCode === "LITRO") return { quantity: qty / 1000, unitCode: defaultUnitCode };
  if (sheetUnitCode === "ML" && defaultUnitCode === "BOTELLA") return { quantity: qty / 1000, unitCode: defaultUnitCode, assumption: "1 botella = 1 L" };
  if (sheetUnitCode === "BOLSA" && defaultUnitCode === "KILOGRAMO") return { quantity: qty * 0.5, unitCode: defaultUnitCode, assumption: "1 bolsa = 0.5 kg" };

  const mult = noteMultiplier(note);
  if (mult && ["PAQUETE", "CAJA", "BOLSA"].includes(sheetUnitCode) && ["UNIDAD", "TABLETAS"].includes(defaultUnitCode)) {
    return { quantity: qty * mult, unitCode: defaultUnitCode, assumption: `nota: ${mult} por paquete` };
  }

  if (norm(note).includes("LIBRA") && ["KILOGRAMO", "LITRO", "BOTELLA"].includes(defaultUnitCode)) {
    return { quantity: qty * 0.5, unitCode: defaultUnitCode, assumption: "nota: libra = 0.5" };
  }

  if (sheetUnitCode === "UNIDAD" && ["UNIDAD", "TABLETAS", "PAR"].includes(defaultUnitCode)) {
    return { quantity: qty, unitCode: defaultUnitCode };
  }

  const factorKey = `${name}|${sheetUnitCode}`;
  if (FALLBACK_FACTORS[factorKey] != null) {
    return { quantity: qty * FALLBACK_FACTORS[factorKey], unitCode: defaultUnitCode, assumption: `supuesto ${sheetUnitLabel}->${defaultUnitCode}` };
  }

  if (sheetUnitCode === "UNIDAD") return { quantity: qty, unitCode: defaultUnitCode, assumption: "relabel" };

  return { skip: `sin regla de conversión: ${sheetUnitLabel} -> ${defaultUnitCode} (${name})` };
}

// ── main ──────────────────────────────────────────────────────────────

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection("users").authWithPassword(OPERATOR_EMAIL, OPERATOR_PASSWORD);
  const operatorId = pb.authStore.record.id;
  console.log(`Conectado a ${PB_URL} como ${OPERATOR_EMAIL} (${operatorId})${DRY_RUN ? " [--dry-run]" : ""}\n`);

  const [products, units, categories] = await Promise.all([
    pb.collection("products").getFullList({ fields: "id,name,category_id,default_unit_id" }),
    pb.collection("units").getFullList({ fields: "id,code" }),
    pb.collection("categories").getFullList({ fields: "id,name" }),
  ]);
  const unitById = new Map(units.map((u) => [u.id, u]));
  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const productByExactName = new Map(products.map((p) => [p.name, p]));
  const productByNorm = new Map(products.map((p) => [norm(p.name), p]));

  function matchProduct(sheetProductName, note) {
    const key = norm(sheetProductName);
    const override = contextOverride(key, note);
    if (override) return productByExactName.get(override) || null;
    if (SYNONYMS[key]) return productByExactName.get(SYNONYMS[key]) || null;
    return productByNorm.get(key) || null;
  }

  function productInfo(p) {
    const unit = unitById.get(p.default_unit_id);
    return { id: p.id, name: p.name, defaultUnitCode: unit ? unit.code : null, defaultUnitId: p.default_unit_id, categoryName: categoryById.get(p.category_id)?.name || "" };
  }

  // -- agrupar INGRESO por día --
  const byDay = new Map();
  for (const row of DATA.ingreso) {
    const [fecha, producto, , unidad, cantidad, notaA, notaB] = row;
    const isFullyBlank = !fecha && !producto && !unidad && !cantidad;
    if (isFullyBlank || !fecha) continue;
    const note = [notaA, notaB].filter(Boolean).join(" ").trim();
    const rawProduct = matchProduct(producto, note);
    if (!rawProduct) continue; // ya no debería pasar, catálogo ampliado
    const product = productInfo(rawProduct);
    const result = convert(product, unidad, cantidad, note);
    if (result.skip) continue;
    if (!byDay.has(fecha)) byDay.set(fecha, []);
    byDay.get(fecha).push({
      product,
      quantity: Math.round(result.quantity * 1000) / 1000,
      note: `Importado de INVENTARIO INTERNO (hoja): "${producto}"${note ? ` -- ${note}` : ""}`,
      classification_status: product.categoryName === "Otros Medicamentos" ? "quarantine" : "available",
    });
  }

  const stats = { donations: 0, items: 0, itemErrors: 0, donorDonations: 0, donorErrors: 0 };

  function parseDate(ddmmyyyy) {
    const [d, m, y] = ddmmyyyy.split("/");
    return `${y}-${m}-${d} 00:00:00.000Z`;
  }

  for (const [fecha, items] of [...byDay.entries()].sort()) {
    console.log(`\n== Donación histórica del ${fecha} -- ${items.length} artículos ==`);
    if (DRY_RUN) { stats.donations++; stats.items += items.length; continue; }

    const donation = await pb.collection("donations").create({
      donor_type: "anonimo",
      donor_name: "",
      receipt_date: parseDate(fecha),
      operator_id: operatorId,
      status: "clasificada",
      notes: `Carga histórica: renglones de INVENTARIO INTERNO (Google Sheets) del ${fecha}, previa a la puesta en producción de AKOPIA. Sin donante específico por artículo -- ver PROPUESTA-AMPLIACION-CATALOGO.md y REPORTE-PRUEBA-IMPORTACION-INVENTARIO.md.`,
    });
    stats.donations++;
    console.log(`  Donación ${donation.code} creada (${donation.id})`);

    for (const item of items) {
      try {
        await pb.collection("donation_items").create({
          donation_id: donation.id,
          product_id: item.product.id,
          unit_id: item.product.defaultUnitId,
          quantity: item.quantity,
          classification_status: item.classification_status,
          notes: item.note,
        });
        stats.items++;
      } catch (err) {
        stats.itemErrors++;
        console.error(`  ERROR ${item.product.name} x${item.quantity}: ${err?.response?.message || err.message}`);
      }
    }
  }

  console.log(`\n== Donantes ("Respuestas de formulario 1") -- ${DATA.donantes.length} registros ==`);
  const donorTypeMap = { "PERSONA NATURAL": "individual", "ENTIDAD PUBLICA": "institucion" };

  for (const row of DATA.donantes) {
    const [marca, correoStaff, tipo, nombre, telefono, cedula, direccion, responsable, kg, correoDonante] = row;
    if (!nombre) continue;
    const clean = (v) => (v && !/^[.\s…]+$/.test(v) ? v.trim() : "");
    const kgNum = Number.parseFloat(String(kg || "").replace(",", "."));
    const fecha = marca ? marca.split(" ")[0] : "21/08/2026"; // Sara Aguirre: sin fecha en la hoja
    if (DRY_RUN) { stats.donorDonations++; continue; }

    try {
      const donation = await pb.collection("donations").create({
        donor_type: donorTypeMap[norm(tipo)] || "individual",
        donor_name: nombre.trim(),
        donor_phone: clean(telefono),
        donor_email: clean(correoDonante),
        donor_id_number: clean(cedula),
        donor_id_type: clean(cedula) ? "cedula_ciudadania" : undefined,
        receipt_date: parseDate(fecha),
        operator_id: operatorId,
        status: "clasificada",
        total_weight_kg: Number.isNaN(kgNum) || kgNum <= 0 ? undefined : kgNum,
        notes: `Carga histórica desde "Respuestas de formulario 1" (INVENTARIO INTERNO). Dirección original: ${clean(direccion) || "no registrada"}. Registrado por: ${clean(responsable) || correoStaff}.${!marca ? " Fecha original no registrada en la hoja -- se usó la última fecha del formulario." : ""}`,
      });
      stats.donorDonations++;
      console.log(`  Donación ${donation.code} (${nombre.trim()})`);
    } catch (err) {
      stats.donorErrors++;
      console.error(`  ERROR donante ${nombre}: ${err?.response?.message || err.message}`);
    }
  }

  console.log(`\n${"=".repeat(60)}\nRESUMEN${DRY_RUN ? " (dry-run, nada se escribió)" : ""}\n${"=".repeat(60)}`);
  console.log(`Donaciones históricas por día: ${stats.donations}`);
  console.log(`Artículos creados: ${stats.items}  |  errores: ${stats.itemErrors}`);
  console.log(`Donaciones de donantes: ${stats.donorDonations}  |  errores: ${stats.donorErrors}`);
}

main().catch((err) => {
  console.error("Falló:", err?.response ?? err);
  process.exit(1);
});
