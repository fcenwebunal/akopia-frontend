#!/usr/bin/env node
/*
 * Respaldo del inventario y de la segunda entrega de mercados registrados
 * en Google Sheets ("INVENTARIO INTERNO": hojas INGRESO, Respuestas de
 * formulario 1, SALIDAS y una hoja de STOCK ya calculada por la propia
 * planilla). Pedido explícito de Juan Manuel, 24 ago 2026 -- decisiones
 * confirmadas con él antes de escribir esto (`AskUserQuestion`):
 *
 *   - Entorno: solo el servidor de la UNAL (único despliegue real).
 *   - Beneficiarios: 30 únicos (Brandon Velásquez Jaramillo aparece dos
 *     veces en la ruta de entrega, misma cédula -- se cuenta una vez).
 *   - El bloque de artículos de aseo al final de SALIDAS (sin fecha, pero
 *     confirmado que es de hoy) se reparte igual que los alimentos.
 *   - 6 productos sin equivalente se agregaron al catálogo (migración 057
 *     del backend, con la corrección 058 de un duplicado real encontrado
 *     después: "Kit dental" ya existía como "Kits dentales").
 *   - Los 7 casos donde SALIDAS > INGRESO registrado (mezcla de unidad al
 *     anotar) se reconciliaron a mano -- ver RECONCILE_NOTES abajo.
 *
 * MÉTODO: en vez de re-sumar a mano las ~300 filas de SALIDAS (riesgo real
 * de transcripción con una tabla tan repetitiva), se usa directamente
 * INGRESO y STOCK -- ambos ya agregados por la propia hoja -- y se calcula
 * `salida = ingreso - stock` por producto+unidad. Es la misma aritmética
 * que ya hace la planilla, solo que aplicada explícitamente.
 *
 * "Reparte las salidas entre los beneficiados de forma equitativa" (pedido
 * explícito, porque no se sabe qué le llegó a quién): cada uno de los 30
 * recibe una solicitud con la misma fracción (salida_total / 30) de cada
 * producto que sí tuvo salida. Para los productos donde el total es menor
 * a 30, esto da fracciones pequeñas por persona (p. ej. 1 paquete de
 * cepillos entre 30 = 0.033 cada uno) -- es la consecuencia matemática
 * esperada del reparto equitativo pedido, no un error.
 *
 * Cada solicitud se aprueba (reserva inventario) y su despacho se crea de
 * una vez, marcado "pendiente" (la solicitud queda en `despachada`, sin
 * confirmar entrega) -- para que luego se marquen como entregados uno por
 * uno, tal como se pidió.
 *
 * Uso:
 *   node scripts/import-salidas-beneficiarios.mjs --dry-run
 *   node scripts/import-salidas-beneficiarios.mjs
 *
 * Variables: mismas que los demás scripts de import (PB_URL,
 * AKOPIA_OPERATOR_EMAIL, AKOPIA_OPERATOR_PASSWORD; carga .env.import).
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
const SKIP_DONATION = process.argv.includes("--skip-donation");
const PB_URL = process.env.PB_URL || "https://acopio.manizales.unal.edu.co";
const OPERATOR_EMAIL = process.env.AKOPIA_OPERATOR_EMAIL || "admin@akopia.org";
const OPERATOR_PASSWORD = process.env.AKOPIA_OPERATOR_PASSWORD;

if (!OPERATOR_PASSWORD) {
  console.error("Falta AKOPIA_OPERATOR_PASSWORD (variable de entorno o .env.import).");
  process.exit(1);
}

const N_BENEFICIARIES = 30;

// ── INGRESO tal cual la hoja (sin deduplicar -- hay productos con más de
// una fila; se suman al vuelo) ──────────────────────────────────────────
const INGRESO_RAW = [
  ["AGUA", "LITROS", 129.39], ["PANELA", "KG", 27.355], ["ACEITE", "LITROS", 43.1],
  ["SAL", "KG", 23.67], ["AZUCAR", "KG", 17.554], ["ARROZ", "KG", 121.158],
  ["CHOCOLATE", "KG", 9.34], ["LECHE EN POLVO", "KG", 11.45], ["ATUN", "KG", 10.595],
  ["SARDINA", "KG", 9.965], ["CHILE CON CARNE", "KG", 0.6], ["VERDURAS EN LATA", "KG", 3.89],
  ["FRIJOLES EN LATA", "KG", 2.96], ["COMPOTA", "KG", 1.08], ["PASTA", "KG", 49.775],
  ["LENTEJAS", "KG", 20.814], ["FRIJOL", "KG", 34.898], ["ARVEJA", "KG", 2.908],
  ["GARBANZO", "KG", 4.874], ["AVENA", "KG", 1.55], ["HARINA", "KG", 30.3],
  ["CEREAL", "KG", 0.23], ["GALLETAS", "KG", 3.739], ["BOLSAS DE BASURA", "PAQUETES", 7],
  ["VASOS", "PAQUETES", 6], ["SAZONADOR", "UNIDADES", 27], ["SALCHICHA", "KG", 3],
  ["JUGO EN CAJA", "LITROS", 1.2], ["MAIZ PIRA", "KG", 2.5], ["CAFE", "KG", 1.765],
  ["SALSA", "KG", 0.11], ["GELATINA", "KG", 0.03], ["SOPAS INSTANTANEAS", "KG", 0.663],
  ["LENTEJAS EN LATA", "KG", 0.3], ["PANADERIA", "KG", 0.88], ["REFRESCO EN SOBRE", "KG", 0.015],
  ["JABON DE LOZA", "KG", 4.5], ["DETERGENTE", "LITROS", 9], ["JABON DE MANOS", "LITROS", 8],
  ["JABON DE ROPA", "UNIDADES", 13], ["CREMA CORPORAL BEBE", "LITROS", 0.8],
  ["SHAMPOO ADULTOS", "LITROS", 9.85], ["LIMPIAPISOS", "LITROS", 3], ["ESPONJILLA", "UNIDADES", 1],
  ["VELAS", "UNIDADES", 10], ["DETERGENTE", "KG", 0.9], ["QUITAMANCHAS", "KG", 0.48],
  ["TOALLAS HIGIENICAS", "PAQUETES", 300], ["PROTECTORES", "PAQUETES", 57],
  ["PANITOS HUMEDOS", "PAQUETES", 163], ["JABON ADULTO", "UNIDADES", 358],
  ["JABON BEBE", "UNIDADES", 10], ["CREMA DENTAL ADULTO", "UNIDADES", 122],
  ["CREMA DENTAL NINOS", "UNIDADES", 6], ["KIT DENTAL", "PAQUETES", 80], ["TALCO", "UNIDADES", 5],
  ["ACEITE PARA BEBE", "UNIDADES", 1], ["TAMPONES", "PAQUETES", 3],
  ["CEPILLO DE DIENTES X8", "PAQUETES", 3], ["PAPEL HIGIENICO X12", "PAQUETES", 15],
  ["CEPILLO DE DIENTES X2", "PAQUETES", 31], ["CEPILLO DE DIENTES X1", "PAQUETES", 12],
  ["CEPILLO DE DIENTES X3", "PAQUETES", 2], ["CEPILLO DE DIENTES NINO X1", "PAQUETES", 24],
  ["PAPEL HIGIENICO X18", "PAQUETES", 5], ["PAPEL HIGIENICO X30", "PAQUETES", 2],
  ["PAPEL HIGIENICO X4", "PAQUETES", 7], ["DESODORANTE", "UNIDADES", 75],
  ["PAPEL HIGIENICO X1", "PAQUETES", 48], ["PAPEL HIGIENICO X2", "PAQUETES", 36],
  ["MAQUINAS DE AFEITAR", "PAQUETES", 39], ["SERVILLETAS", "PAQUETES", 1],
  ["CREMA ANTIPANALITIS", "UNIDADES", 2], ["PROTECTOR SOLAR", "UNIDADES", 2],
  ["CONCENTRADO PARA PERRO", "PAQUETES", 31], ["CONCENTRADO PARA GATOS", "PAQUETES", 20],
  ["COMIDA HUMEDA GATO", "UNIDADES", 12], ["COMIDA HUMEDA PERRO", "UNIDADES", 6],
  ["COCAS PARA MASCOTAS", "UNIDADES", 5], ["CHOCOLATE", "KG", 0.2], ["HARINA", "KG", 2],
  ["PANELA", "KG", 2.7], ["VASOS", "PAQUETES", 1], ["CONCENTRADO PARA PERRO", "KG", 30],
  ["CONCENTRADO PARA GATOS", "KG", 24],
];

// ── STOCK ya calculado por la propia hoja (INGRESO - SALIDAS) ──────────
const STOCK_RAW = [
  ["ACEITE", "LITROS", 12.8], ["ACEITE PARA BEBE", "UNIDADES", 1], ["AGUA", "LITROS", 129.39],
  ["ARROZ", "KG", 38.396], ["ARVEJA", "KG", 1.408], ["ATUN", "KG", 3.3], ["AVENA", "KG", 0.25],
  ["AZUCAR", "KG", -0.4], ["BOLSAS DE BASURA", "PAQUETES", 7], ["CAFE", "KG", 1.765],
  ["CEPILLO DE DIENTES NINO X1", "PAQUETES", 24], ["CEPILLO DE DIENTES X1", "PAQUETES", 12],
  ["CEPILLO DE DIENTES X2", "PAQUETES", 31], ["CEPILLO DE DIENTES X3", "PAQUETES", 2],
  ["CEPILLO DE DIENTES X8", "PAQUETES", 2], ["CEREAL", "KG", 0], ["CHILE CON CARNE", "KG", 0.3],
  ["CHOCOLATE", "KG", 2.6], ["COCAS PARA MASCOTAS", "UNIDADES", 5],
  ["COMIDA HUMEDA GATO", "UNIDADES", 12], ["COMIDA HUMEDA PERRO", "UNIDADES", 6],
  ["COMPOTA", "KG", 1.08], ["CONCENTRADO PARA GATOS", "KG", 24],
  ["CONCENTRADO PARA GATOS", "PAQUETES", 20], ["CONCENTRADO PARA PERRO", "KG", 0],
  ["CONCENTRADO PARA PERRO", "PAQUETES", 31], ["CREMA ANTIPANALITIS", "UNIDADES", 2],
  ["CREMA CORPORAL BEBE", "LITROS", 0.8], ["CREMA DENTAL ADULTO", "UNIDADES", 120],
  ["CREMA DENTAL NINOS", "UNIDADES", 6], ["DESODORANTE", "UNIDADES", 27],
  ["DETERGENTE", "KG", 0.9], ["DETERGENTE", "LITROS", 6], ["DETERGENTE", "UNIDADES", -2],
  ["ESPONJILLA", "UNIDADES", 1], ["FRIJOL", "KG", 14.69], ["FRIJOLES EN LATA", "KG", 2.66],
  ["GALLETAS", "KG", 0.536], ["GARBANZO", "KG", 3.374], ["GELATINA", "KG", 0.03],
  ["HARINA", "KG", 1.2], ["JABON ADULTO", "UNIDADES", 306], ["JABON BEBE", "UNIDADES", 10],
  ["JABON DE LOZA", "KG", 4.5], ["JABON DE LOZA", "UNIDADES", -10], ["JABON DE MANOS", "LITROS", 3],
  ["JABON DE MANOS", "UNIDADES", -4], ["JABON DE ROPA", "UNIDADES", 9],
  ["JUGO EN CAJA", "LITROS", 1.2], ["KIT DENTAL", "PAQUETES", 67], ["KIT DENTAL", "UNIDADES", -11],
  ["LECHE EN POLVO", "KG", 2.3], ["LENTEJAS", "KG", 2.11], ["LENTEJAS EN LATA", "KG", 0.3],
  ["LIMPIAPISOS", "LITROS", 2], ["MAIZ PIRA", "KG", 0.5], ["MAQUINAS DE AFEITAR", "PAQUETES", 0],
  ["MAQUINAS DE AFEITAR", "UNIDADES", -19], ["PANADERIA", "KG", 0], ["PANELA", "KG", 12.62],
  ["PANITOS HUMEDOS", "PAQUETES", 110], ["PAPEL HIGIENICO X1", "PAQUETES", 18],
  ["PAPEL HIGIENICO X12", "PAQUETES", 15], ["PAPEL HIGIENICO X18", "PAQUETES", 4],
  ["PAPEL HIGIENICO X2", "PAQUETES", 0], ["PAPEL HIGIENICO X30", "PAQUETES", 2],
  ["PAPEL HIGIENICO X4", "PAQUETES", 7], ["PASTA", "KG", 26.625], ["PROTECTORES", "PAQUETES", 57],
  ["PROTECTOR SOLAR", "UNIDADES", 2], ["QUITAMANCHAS", "KG", 0.48],
  ["REFRESCO EN SOBRE", "KG", 0.015], ["SAL", "KG", 0], ["SALCHICHA", "KG", 0],
  ["SALSA", "KG", 0.11], ["SARDINA", "KG", 0.105], ["SAZONADOR", "UNIDADES", 21],
  ["SERVILLETAS", "PAQUETES", 0], ["SHAMPOO ADULTOS", "LITROS", 9.6],
  ["SHAMPOO ADULTOS", "UNIDADES", -66], ["SOPAS INSTANTANEAS", "KG", 0.493],
  ["TALCO", "UNIDADES", 3], ["TAMPONES", "PAQUETES", 3], ["TOALLAS HIGIENICAS", "PAQUETES", 276],
  ["VASOS", "PAQUETES", 7], ["VELAS", "UNIDADES", 10], ["VERDURAS EN LATA", "KG", 0.68],
];

// ── mapeo hoja -> catálogo real. factor: cantidad_catalogo = qty_hoja * factor.
// skip:true => sin equivalente razonable en el catálogo, se omite (no se
// fuerza un mapeo malo). Verificado contra el catálogo real (181+6
// productos) el 24 ago 2026, no adivinado.
const PRODUCT_MAP = {
  "AGUA": { name: "Agua embotellada 1L", factor: 1 },
  "PANELA": { name: "Panela", factor: 1 },
  "ACEITE": { name: "Aceite vegetal", factor: 1 },
  "SAL": { name: "Sal", factor: 1 },
  "AZUCAR": { name: "Azúcar", factor: 1 },
  "ARROZ": { name: "Arroz", factor: 1 },
  "CHOCOLATE": { name: "Chocolate en barra", factor: 1 },
  "LECHE EN POLVO": { name: "Leche en polvo", factor: 1 },
  "ATUN": { name: "Atún enlatado", factor: 1000 / 170, assumption: "lata estándar ~170 g" },
  "SARDINA": { name: "Sardina enlatada", factor: 1000 / 170, assumption: "lata estándar ~170 g" },
  "CHILE CON CARNE": { name: "Chile con carne", factor: 1 },
  "VERDURAS EN LATA": { name: "Verduras enlatadas", factor: 1000 / 170, assumption: "lata estándar ~170 g" },
  "FRIJOLES EN LATA": { name: "Frijoles enlatados", factor: 1000 / 170, assumption: "lata estándar ~170 g" },
  "COMPOTA": { name: "Compota", factor: 1 },
  "PASTA": { name: "Pasta (fideos)", factor: 1 },
  "LENTEJAS": { name: "Lenteja", factor: 1 },
  "FRIJOL": { name: "Frijol", factor: 1 },
  "ARVEJA": { name: "Arveja", factor: 1 },
  "GARBANZO": { name: "Garbanzo", factor: 1 },
  "AVENA": { name: "Avena", factor: 1 },
  "HARINA": { name: "Harina de trigo", factor: 1 },
  "CEREAL": { name: "Cereal", factor: 1 },
  "GALLETAS": { name: "Galletas saladas", factor: 1 },
  "BOLSAS DE BASURA": { name: "Bolsas de basura", factor: 1 },
  "VASOS": { name: "Vasos desechables", factor: 1 },
  "SAZONADOR": { name: "Condimentos varios", factor: 1 },
  "SALCHICHA": { name: "Salchicha", factor: 1 },
  "JUGO EN CAJA": { name: "Jugo en caja", factor: 1 },
  "MAIZ PIRA": { name: "Maíz pira", factor: 1 },
  "CAFE": { name: "Café soluble", factor: 1 },
  "SALSA": { name: "Salsa de tomate", factor: 1 },
  "GELATINA": { name: "Gelatina", factor: 1 },
  "SOPAS INSTANTANEAS": { name: "Sopa instantánea", factor: 1 },
  "LENTEJAS EN LATA": { skip: true, reason: "sin equivalente en catálogo" },
  "PANADERIA": { name: "Pan dulce", factor: 2, assumption: "1 paquete ≈ 0.5 kg" },
  "REFRESCO EN SOBRE": { skip: true, reason: "sin equivalente (sobre en polvo vs. Refresco embotellado)" },
  "JABON DE LOZA": { name: "Jabón para trastes", factor: 1 },
  "DETERGENTE": { name: "Detergente", factor: 1 },
  "JABON DE MANOS": { name: "Jabón líquido", factor: 1 },
  "JABON DE ROPA": { name: "Jabón para ropa", factor: 1 },
  "CREMA CORPORAL BEBE": { skip: true, reason: "sin equivalente en catálogo" },
  "SHAMPOO ADULTOS": { name: "Shampoo", factor: 1 },
  "LIMPIAPISOS": { name: "Limpiapisos", factor: 1 },
  "ESPONJILLA": { name: "Esponjilla", factor: 1 },
  "VELAS": { name: "Velas", factor: 1 },
  "QUITAMANCHAS": { name: "Quintamanchas", factor: 1 },
  "TOALLAS HIGIENICAS": { name: "Toallas sanitarias", factor: 1 },
  "PROTECTORES": { name: "Protectores diarios", factor: 1 },
  "PANITOS HUMEDOS": { name: "Toallitas húmedas", factor: 1 },
  "JABON ADULTO": { name: "Jabón de barra", factor: 1 },
  "JABON BEBE": { name: "Jabón para bebé", factor: 1 },
  "CREMA DENTAL ADULTO": { name: "Pasta dental", factor: 1 },
  "CREMA DENTAL NINOS": { name: "Pasta dental", factor: 1 },
  "KIT DENTAL": { name: "Kits dentales", factor: 1 },
  "TALCO": { name: "Talco", factor: 1 },
  "ACEITE PARA BEBE": { name: "Aceite para bebé", factor: 1 },
  "TAMPONES": { name: "Tampones", factor: 1 },
  "CEPILLO DE DIENTES X8": { name: "Cepillo de dientes", factor: 8, assumption: "paquete de 8" },
  "CEPILLO DE DIENTES X2": { name: "Cepillo de dientes", factor: 2, assumption: "paquete de 2" },
  "CEPILLO DE DIENTES X1": { name: "Cepillo de dientes", factor: 1 },
  "CEPILLO DE DIENTES X3": { name: "Cepillo de dientes", factor: 3, assumption: "paquete de 3" },
  "CEPILLO DE DIENTES NINO X1": { name: "Cepillo de dientes", factor: 1 },
  "PAPEL HIGIENICO X12": { name: "Papel higiénico", factor: 1 },
  "PAPEL HIGIENICO X18": { name: "Papel higiénico", factor: 1 },
  "PAPEL HIGIENICO X30": { name: "Papel higiénico", factor: 1 },
  "PAPEL HIGIENICO X4": { name: "Papel higiénico", factor: 1 },
  "PAPEL HIGIENICO X1": { name: "Papel higiénico", factor: 1 },
  "PAPEL HIGIENICO X2": { name: "Papel higiénico", factor: 1 },
  "DESODORANTE": { name: "Desodorante", factor: 1 },
  "MAQUINAS DE AFEITAR": { name: "Máquina de afeitar", factor: 1 },
  "SERVILLETAS": { skip: true, reason: "sin equivalente en catálogo" },
  "CREMA ANTIPANALITIS": { name: "Crema antipañalitis", factor: 1 },
  "PROTECTOR SOLAR": { name: "Bloqueador solar", factor: 1 },
  "CONCENTRADO PARA PERRO": { name: "Croquetas para perro", factor: 1 / 20, assumption: "saco estándar ~20 kg" },
  "CONCENTRADO PARA GATOS": { name: "Croquetas para gato", factor: 1 / 20, assumption: "saco estándar ~20 kg" },
  "COMIDA HUMEDA GATO": { name: "Alimento húmedo para mascota", factor: 1 },
  "COMIDA HUMEDA PERRO": { name: "Alimento húmedo para mascota", factor: 1 },
  "COCAS PARA MASCOTAS": { name: "Comedero para mascota", factor: 1 },
};

// ── reconciliación de las 7 mezclas de unidad reales (SALIDAS registró
// una unidad que INGRESO nunca respaldó para ese producto -- error de
// digitación, no de inventario real). Pedido explícito: "analiza las
// unidades y productos y únelos para que tenga sentido". ──────────────
function reconcile(ingreso, stock) {
  const notes = [];
  const salida = {};
  for (const key of new Set([...Object.keys(ingreso), ...Object.keys(stock)])) {
    salida[key] = (ingreso[key] || 0) - (stock[key] || 0);
  }
  const cap = (product, unit, computed, ingresoQty) => {
    if (computed > ingresoQty + 1e-9) {
      notes.push(`${product} ${unit}: salida implícita ${computed.toFixed(3)} > ingreso ${ingresoQty.toFixed(3)} -> topada en ${ingresoQty.toFixed(3)}, faltante ${(computed - ingresoQty).toFixed(3)} sin explicar`);
      return ingresoQty;
    }
    return computed;
  };
  const fold = (fromKey, toKey) => {
    const extra = salida[fromKey] || 0;
    delete salida[fromKey];
    if (extra) salida[toKey] = (salida[toKey] || 0) + extra;
    return extra;
  };
  const key = (p, u) => `${p}|${u}`;

  salida[key("AZUCAR", "KG")] = cap("AZUCAR", "KG", salida[key("AZUCAR", "KG")], ingreso[key("AZUCAR", "KG")]);

  fold(key("DETERGENTE", "UNIDADES"), key("DETERGENTE", "LITROS"));
  salida[key("DETERGENTE", "LITROS")] = cap("DETERGENTE", "LITROS", salida[key("DETERGENTE", "LITROS")], ingreso[key("DETERGENTE", "LITROS")]);

  fold(key("JABON DE MANOS", "UNIDADES"), key("JABON DE MANOS", "LITROS"));
  salida[key("JABON DE MANOS", "LITROS")] = cap("JABON DE MANOS", "LITROS", salida[key("JABON DE MANOS", "LITROS")], ingreso[key("JABON DE MANOS", "LITROS")]);

  fold(key("KIT DENTAL", "UNIDADES"), key("KIT DENTAL", "PAQUETES"));
  salida[key("KIT DENTAL", "PAQUETES")] = cap("KIT DENTAL", "PAQUETES", salida[key("KIT DENTAL", "PAQUETES")], ingreso[key("KIT DENTAL", "PAQUETES")]);

  const jabonLozaKey = key("JABON DE LOZA", "UNIDADES");
  if (salida[jabonLozaKey]) {
    notes.push(`JABON DE LOZA UNIDADES: ${salida[jabonLozaKey].toFixed(3)} salida sin respaldo de ingreso en esa unidad (KG intacto) -> excluida del reparto`);
    delete salida[jabonLozaKey];
  }

  fold(key("MAQUINAS DE AFEITAR", "UNIDADES"), key("MAQUINAS DE AFEITAR", "PAQUETES"));
  salida[key("MAQUINAS DE AFEITAR", "PAQUETES")] = cap("MAQUINAS DE AFEITAR", "PAQUETES", salida[key("MAQUINAS DE AFEITAR", "PAQUETES")], ingreso[key("MAQUINAS DE AFEITAR", "PAQUETES")]);

  if (salida[key("SHAMPOO ADULTOS", "UNIDADES")]) {
    notes.push(`SHAMPOO ADULTOS UNIDADES: ${salida[key("SHAMPOO ADULTOS", "UNIDADES")].toFixed(3)} es físicamente imposible contra el ingreso (9.85 L) -> excluida del reparto`);
    delete salida[key("SHAMPOO ADULTOS", "UNIDADES")];
  }

  return { salida, notes };
}

function mergeRows(rows) {
  const d = {};
  for (const [p, u, q] of rows) {
    const k = `${p}|${u}`;
    d[k] = (d[k] || 0) + q;
  }
  return d;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

async function main() {
  const pb = new PocketBase(PB_URL);
  await pb.collection("users").authWithPassword(OPERATOR_EMAIL, OPERATOR_PASSWORD);
  const operatorId = pb.authStore.record.id;
  console.log(`Conectado a ${PB_URL} como ${OPERATOR_EMAIL}${DRY_RUN ? " [--dry-run]" : ""}\n`);

  const [products, units] = await Promise.all([
    pb.collection("products").getFullList({ fields: "id,name,default_unit_id" }),
    pb.collection("units").getFullList({ fields: "id,code" }),
  ]);
  const productByName = new Map(products.map((p) => [p.name, p]));
  const unitIdByCode = new Map(units.map((u) => [u.code, u.id]));

  const beneficiaries = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "beneficiarios-mercado-segundo-informe.json"), "utf8")
  );
  if (beneficiaries.length !== N_BENEFICIARIES) {
    console.error(`Se esperaban ${N_BENEFICIARIES} beneficiarios, hay ${beneficiaries.length}.`);
    process.exit(1);
  }

  // ── 1) INGRESO merged -> stock disponible por producto de catálogo ──
  const ingresoMerged = mergeRows(INGRESO_RAW);
  const ingresoByProduct = new Map(); // catalogName -> quantity
  const ingresoSkipped = [];
  for (const [k, qty] of Object.entries(ingresoMerged)) {
    const [sheetName] = k.split("|");
    const map = PRODUCT_MAP[sheetName];
    if (!map || map.skip) { ingresoSkipped.push(`${sheetName} (${qty})${map?.reason ? ` -- ${map.reason}` : ""}`); continue; }
    const product = productByName.get(map.name);
    if (!product) { ingresoSkipped.push(`${sheetName} -> "${map.name}" NO EXISTE EN EL CATÁLOGO`); continue; }
    const converted = qty * map.factor;
    ingresoByProduct.set(map.name, (ingresoByProduct.get(map.name) || 0) + converted);
  }

  // ── 2) SALIDA reconciliada -> reparto por beneficiario ──────────────
  const stockMerged = mergeRows(STOCK_RAW);
  const { salida, notes } = reconcile(ingresoMerged, stockMerged);
  const salidaByProduct = new Map(); // catalogName -> quantity total
  const salidaSkipped = [];
  for (const [k, qty] of Object.entries(salida)) {
    if (Math.abs(qty) < 1e-6) continue;
    const [sheetName] = k.split("|");
    const map = PRODUCT_MAP[sheetName];
    if (!map || map.skip) { salidaSkipped.push(`${sheetName} (${qty.toFixed(3)})${map?.reason ? ` -- ${map.reason}` : ""}`); continue; }
    const product = productByName.get(map.name);
    if (!product) { salidaSkipped.push(`${sheetName} -> "${map.name}" NO EXISTE EN EL CATÁLOGO`); continue; }
    const converted = qty * map.factor;
    salidaByProduct.set(map.name, (salidaByProduct.get(map.name) || 0) + converted);
  }

  console.log("=".repeat(70));
  console.log("REPORTE DE RECONCILIACIÓN");
  console.log("=".repeat(70));
  console.log("\nNotas de unidades mezcladas en SALIDAS:");
  for (const n of notes) console.log("  -", n);
  console.log(`\nProductos de INGRESO sin mapear al catálogo (${ingresoSkipped.length}):`);
  for (const s of ingresoSkipped) console.log("  -", s);
  console.log(`\nProductos de SALIDA sin mapear al catálogo (${salidaSkipped.length}):`);
  for (const s of salidaSkipped) console.log("  -", s);

  console.log(`\nINGRESO -> ${ingresoByProduct.size} productos de catálogo, total de filas de hoja: ${Object.keys(ingresoMerged).length}`);
  console.log(`SALIDA -> ${salidaByProduct.size} productos de catálogo con reparto real`);
  console.log("\nReparto por beneficiario (total / 30):");
  for (const [name, total] of [...salidaByProduct.entries()].sort()) {
    console.log(`  ${name.padEnd(28)} total ${round3(total).toString().padStart(10)}  |  c/u ${round3(total / N_BENEFICIARIES)}`);
  }

  if (DRY_RUN) {
    console.log(`\n${"=".repeat(70)}\nDRY-RUN: nada se escribió. Revisa el reporte de arriba antes de correr sin --dry-run.\n${"=".repeat(70)}`);
    return;
  }

  // ── 3) Donación única con el INGRESO completo (respaldo del stock actual) ──
  let donation = { code: "(omitida, --skip-donation)" };
  let donationItemErrors = 0;
  if (!SKIP_DONATION) {
    console.log("\n== Creando donación de respaldo (INGRESO completo) ==");
    donation = await pb.collection("donations").create({
      donor_type: "anonimo",
      donor_name: "",
      receipt_date: new Date().toISOString().replace("T", " "),
      operator_id: operatorId,
      status: "clasificada",
      notes: 'Respaldo del inventario registrado en Google Sheets ("INVENTARIO INTERNO", hoja INGRESO) al 24 de agosto de 2026, pedido explícito de Juan Manuel tras el vaciado de datos de esa misma noche. Sin donante específico por artículo -- mismo criterio que la carga histórica del 21 de agosto.',
    });
    console.log(`  Donación ${donation.code} creada (${donation.id})`);
    for (const [name, qty] of ingresoByProduct.entries()) {
      const product = productByName.get(name);
      try {
        await pb.collection("donation_items").create({
          donation_id: donation.id,
          product_id: product.id,
          unit_id: product.default_unit_id,
          quantity: round3(qty),
          classification_status: "available",
          notes: `Respaldo de INGRESO (Google Sheets), 24 ago 2026.`,
        });
      } catch (err) {
        donationItemErrors++;
        console.error(`  ERROR ${name} x${round3(qty)}: ${err?.response?.message || err.message}`);
      }
    }
    console.log(`  ${ingresoByProduct.size - donationItemErrors} artículos creados, ${donationItemErrors} errores`);
  } else {
    console.log("\n== Donación de respaldo omitida (--skip-donation, ya existe DON-000001) ==");
  }

  // ── 4) 30 solicitudes + aprobación + despacho, cada una con el reparto igual ──
  console.log("\n== Creando solicitudes + despachos, uno por beneficiario ==");
  let requestsOk = 0, requestErrors = [];
  for (const b of beneficiaries) {
    try {
      const request = await pb.collection("requests").create({
        requester_name: b.name,
        requester_phone: b.phone || "",
        requester_institution: "",
        destination: `${b.address}${b.barrio ? " - " + b.barrio : ""}`,
        beneficiary_count: 1,
        priority: "media",
        status: "pendiente",
        operator_id: operatorId,
        notes: `Segunda entrega de mercados (censo "Segundo Informe Mercado"), 24 ago 2026. Reparto equitativo entre los ${N_BENEFICIARIES} beneficiarios de la ruta de entrega -- no se sabe con certeza qué le llegó a cada uno, así que se distribuyó por igual para que el registro quede justificado. Documento: ${b.doc || "no registrado en la hoja"}.`,
      });

      for (const [name, total] of salidaByProduct.entries()) {
        const product = productByName.get(name);
        const share = round3(total / N_BENEFICIARIES);
        if (share < 0.01) continue; // el esquema exige quantity_requested >= 0.01
        await pb.collection("request_items").create({
          request_id: request.id,
          product_id: product.id,
          unit_id: product.default_unit_id,
          quantity_requested: share,
          status: "pendiente",
        });
      }

      await fetch(pb.buildURL(`/api/requests/${request.id}/approve`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
        body: "{}",
      }).then(async (r) => {
        if (!r.ok) throw new Error(`approve ${r.status}: ${JSON.stringify(await r.json().catch(() => ({})))}`);
      });

      const dispatch = await pb.collection("dispatches").create({
        request_id: request.id,
        driver_name: "Por confirmar",
        driver_phone: "",
        vehicle_plate: "",
        brigade: "Segunda entrega de mercados",
        destination: request.destination,
        dispatch_date: new Date().toISOString().replace("T", " "),
        operator_id: operatorId,
        notes: "Camión ya salió el 24 ago 2026 -- despacho pendiente de confirmar entrega.",
      });
      await pb.collection("requests").update(request.id, { status: "despachada" });

      requestsOk++;
      console.log(`  ${request.code} (${b.name}) -> despacho ${dispatch.code || dispatch.id} OK`);
    } catch (err) {
      const detail = err?.response ? JSON.stringify(err.response) : (err?.message || String(err));
      requestErrors.push({ name: b.name, error: detail });
      console.error(`  ERROR con ${b.name}: ${detail}`);
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  console.log(`\n${"=".repeat(70)}\nRESUMEN\n${"=".repeat(70)}`);
  console.log(`Donación de respaldo: ${donation.code}, ${ingresoByProduct.size - donationItemErrors} artículos`);
  console.log(`Solicitudes+despachos: ${requestsOk}/${N_BENEFICIARIES} OK, ${requestErrors.length} con error`);
  for (const e of requestErrors) console.log(`  - ${e.name}: ${e.error}`);
}

main().catch((err) => {
  console.error("Falló:", err?.response ?? err);
  process.exit(1);
});
