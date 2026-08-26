#!/usr/bin/env node
/*
 * Rehace el reparto de la "segunda entrega de mercados" (import-salidas-
 * beneficiarios.mjs, 24 ago 2026) con cantidades que tengan sentido físico.
 * Pedido explícito de Juan Manuel, 25/26 ago 2026, tras notar cosas como
 * "0.267 cepillos de dientes" o "1.767 paquetes de toallitas húmedas" por
 * persona -- kg y litros sí se pueden repartir en fracciones (pesar 59 g
 * de pan es normal), un cepillo de dientes o un paquete no.
 *
 * Confirmado con Juan Manuel antes de correr esto (`AskUserQuestion`):
 *   - El reparto físico a las familias NO había pasado todavía (el camión
 *     salió el 24, pero la entrega persona por persona seguía pendiente)
 *     -- por eso tiene sentido corregir las cantidades ahora, no solo el
 *     papeleo.
 *   - Para un producto discreto donde ni 1 unidad completa alcanza para
 *     las 30 personas (ej. 8 kits dentales), se le da 1 unidad completa a
 *     algunas personas elegidas al azar -- las demás no reciben ese
 *     producto esta vez. Sigue siendo "equitativo" en el sentido de que
 *     nadie recibe una fracción físicamente imposible.
 *
 * MÉTODO:
 *   - Kilogramo/Litro (medidas continuas): igual que el script original,
 *     total/30 redondeado a 3 decimales -- repartir en fracciones tiene
 *     sentido real ahí.
 *   - Cualquier otra unidad (paquete, unidad, botella, lata, caja...):
 *     total entero ÷ 30 con Math.floor -- la base es igual para las 30
 *     personas, y el sobrante (total - base*30) se reparte como 1 unidad
 *     extra a esa cantidad de personas, elegidas al azar. Si la base da 0
 *     (menos de 30 unidades en total), se le da 1 unidad completa a
 *     `total` personas al azar, 0 al resto.
 *
 * Ejecución: cancela las 30 solicitudes/despachos anteriores (libera sus
 * reservas) y crea 30 solicitudes nuevas con las cantidades recalculadas,
 * mismos beneficiarios y destino que ya se usaron. Nada se borra sin
 * dejar rastro: las solicitudes viejas quedan "canceladas" (con motivo),
 * no desaparecen: es una lo mismo, la eliminación de los despachos
 * viejos usa la ruta de "eliminar con motivo" ya existente.
 *
 * Uso:
 *   node scripts/redo-segunda-entrega-cantidades-sensatas.mjs --dry-run
 *   node scripts/redo-segunda-entrega-cantidades-sensatas.mjs
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

const N_BENEFICIARIES = 30;
const BRIGADE = "Segunda entrega de mercados";

// ── Copiado sin cambios de import-salidas-beneficiarios.mjs (24 ago) --
// misma fuente, mismos supuestos ya verificados entonces, para que el
// total por producto sea exactamente el mismo que ya se aprobó. ────────
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

function reconcile(ingreso, stock) {
  const notes = [];
  const salida = {};
  for (const key of new Set([...Object.keys(ingreso), ...Object.keys(stock)])) {
    salida[key] = (ingreso[key] || 0) - (stock[key] || 0);
  }
  const cap = (product, unit, computed, ingresoQty) => {
    if (computed > ingresoQty + 1e-9) {
      notes.push(`${product} ${unit}: salida implícita ${computed.toFixed(3)} > ingreso ${ingresoQty.toFixed(3)} -> topada en ${ingresoQty.toFixed(3)}`);
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
  if (salida[jabonLozaKey]) { delete salida[jabonLozaKey]; }

  fold(key("MAQUINAS DE AFEITAR", "UNIDADES"), key("MAQUINAS DE AFEITAR", "PAQUETES"));
  salida[key("MAQUINAS DE AFEITAR", "PAQUETES")] = cap("MAQUINAS DE AFEITAR", "PAQUETES", salida[key("MAQUINAS DE AFEITAR", "PAQUETES")], ingreso[key("MAQUINAS DE AFEITAR", "PAQUETES")]);

  if (salida[key("SHAMPOO ADULTOS", "UNIDADES")]) { delete salida[key("SHAMPOO ADULTOS", "UNIDADES")]; }

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

// Fisher-Yates -- para elegir al azar quién recibe la unidad de más (o
// quién recibe la única unidad, cuando ni 1 alcanza para las 30).
function shuffledIndices(n) {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const CONTINUOUS_UNITS = new Set(["KILOGRAMO", "LITRO"]);

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
  const unitCodeById = new Map(units.map((u) => [u.id, u.code]));

  const beneficiaries = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "beneficiarios-mercado-segundo-informe.json"), "utf8")
  );
  if (beneficiaries.length !== N_BENEFICIARIES) {
    console.error(`Se esperaban ${N_BENEFICIARIES} beneficiarios, hay ${beneficiaries.length}.`);
    process.exit(1);
  }

  // ── 1) Recalcular la SALIDA total real por producto (idéntico al 24 ago) ──
  const ingresoMerged = mergeRows(INGRESO_RAW);
  const stockMerged = mergeRows(STOCK_RAW);
  const { salida } = reconcile(ingresoMerged, stockMerged);

  const salidaByProduct = new Map();
  for (const [k, qty] of Object.entries(salida)) {
    if (Math.abs(qty) < 1e-6) continue;
    const [sheetName] = k.split("|");
    const map = PRODUCT_MAP[sheetName];
    if (!map || map.skip) continue;
    const product = productByName.get(map.name);
    if (!product) continue;
    const converted = qty * map.factor;
    salidaByProduct.set(map.name, (salidaByProduct.get(map.name) || 0) + converted);
  }

  // ── 2) Asignación por persona: continua (kg/L) vs. discreta (entera) ──
  const allocations = new Map(); // productName -> array de 30 cantidades
  const report = [];
  for (const [name, total] of salidaByProduct.entries()) {
    const product = productByName.get(name);
    const unitCode = unitCodeById.get(product.default_unit_id);
    const isContinuous = CONTINUOUS_UNITS.has(unitCode);

    if (isContinuous) {
      const share = round3(total / N_BENEFICIARIES);
      if (share < 0.01) { report.push({ name, unitCode, kind: "kg/L, excluido (<0.01)", detail: `total=${round3(total)}` }); continue; }
      allocations.set(name, Array(N_BENEFICIARIES).fill(share));
      report.push({ name, unitCode, kind: "kg/L", detail: `${share} c/u (total ${round3(total)})` });
      continue;
    }

    const totalWhole = Math.round(total);
    if (totalWhole <= 0) { report.push({ name, unitCode, kind: "discreto, excluido (0 unidades)", detail: `total real=${round3(total)}` }); continue; }

    const base = Math.floor(totalWhole / N_BENEFICIARIES);
    const arr = Array(N_BENEFICIARIES).fill(base);

    if (base === 0) {
      const winners = shuffledIndices(N_BENEFICIARIES).slice(0, totalWhole);
      for (const i of winners) arr[i] = 1;
      report.push({ name, unitCode, kind: "discreto, escaso", detail: `1 unidad a ${totalWhole}/30 personas al azar (total real=${round3(total)})` });
    } else {
      const remainder = totalWhole - base * N_BENEFICIARIES;
      const winners = shuffledIndices(N_BENEFICIARIES).slice(0, remainder);
      for (const i of winners) arr[i] += 1;
      report.push({ name, unitCode, kind: "discreto", detail: `${base} c/u, +1 extra a ${remainder}/30 personas al azar (total real=${round3(total)}, redondeado de ${total})` });
    }
    allocations.set(name, arr);
  }

  console.log("=".repeat(78));
  console.log("REPARTO RECALCULADO, POR PRODUCTO");
  console.log("=".repeat(78));
  for (const r of report) {
    console.log(`  ${r.name.padEnd(28)} [${r.unitCode.padEnd(10)}] ${r.kind.padEnd(28)} ${r.detail}`);
  }

  if (DRY_RUN) {
    console.log(`\n${"=".repeat(78)}\nDRY-RUN: nada se escribió. ${allocations.size} productos con reparto real.\n${"=".repeat(78)}`);
    return;
  }

  // ── 3) Ubicar las 30 solicitudes/despachos anteriores, en el mismo orden ──
  const oldDispatches = await pb.collection("dispatches").getFullList({
    filter: `brigade = "${BRIGADE}"`,
    sort: "created",
    expand: "request_id",
  });
  if (oldDispatches.length !== N_BENEFICIARIES) {
    console.error(`Se esperaban ${N_BENEFICIARIES} despachos anteriores de "${BRIGADE}", hay ${oldDispatches.length}. Abortando.`);
    process.exit(1);
  }

  // ── 4) Cancelar + eliminar lo anterior, de a una persona a la vez ──
  console.log("\n== Liberando las 30 solicitudes/despachos anteriores ==");
  for (let i = 0; i < oldDispatches.length; i++) {
    const oldDispatch = oldDispatches[i];
    const oldRequest = oldDispatch.expand?.request_id;
    if (!oldRequest || oldRequest.requester_name !== beneficiaries[i].name) {
      console.error(`Desajuste de orden en la posición ${i}: esperaba "${beneficiaries[i].name}", encontré "${oldRequest?.requester_name}". Abortando.`);
      process.exit(1);
    }

    await fetch(pb.buildURL(`/api/records/dispatches/${oldDispatch.id}/delete`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
      body: JSON.stringify({ reason: "Reemplazado por una solicitud con cantidades recalculadas (enteras/sensatas)" }),
    }).then(async (r) => { if (!r.ok) throw new Error(`delete dispatch ${r.status}: ${JSON.stringify(await r.json().catch(() => ({})))}`); });

    await fetch(pb.buildURL(`/api/requests/${oldRequest.id}/cancel`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
      body: JSON.stringify({ reason: "Recalculado: cantidades por persona con sentido físico (enteras para productos discretos)" }),
    }).then(async (r) => { if (!r.ok) throw new Error(`cancel request ${r.status}: ${JSON.stringify(await r.json().catch(() => ({})))}`); });

    console.log(`  [${i + 1}/30] liberado: ${beneficiaries[i].name}`);
  }

  // ── 5) Crear las 30 solicitudes nuevas con las cantidades recalculadas ──
  console.log("\n== Creando solicitudes + despachos con las cantidades nuevas ==");
  let requestsOk = 0;
  const requestErrors = [];
  for (let i = 0; i < beneficiaries.length; i++) {
    const b = beneficiaries[i];
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
        notes: `Segunda entrega de mercados (censo "Segundo Informe Mercado"), recalculada el 26 ago 2026 con cantidades enteras/sensatas para productos discretos -- reemplaza la solicitud original del 24 ago. Documento: ${b.doc || "no registrado en la hoja"}.`,
      });

      for (const [name, arr] of allocations.entries()) {
        const share = arr[i];
        if (!(share > 0)) continue;
        const product = productByName.get(name);
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
        brigade: BRIGADE,
        destination: request.destination,
        dispatch_date: new Date().toISOString().replace("T", " "),
        operator_id: operatorId,
        notes: "Recalculado el 26 ago 2026 -- despacho pendiente de confirmar entrega.",
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

  console.log(`\n${"=".repeat(78)}\nRESUMEN\n${"=".repeat(78)}`);
  console.log(`Solicitudes recreadas: ${requestsOk}/${N_BENEFICIARIES} OK, ${requestErrors.length} con error`);
  for (const e of requestErrors) console.log(`  - ${e.name}: ${e.error}`);
}

main().catch((err) => {
  console.error("Falló:", err?.response ?? err);
  process.exit(1);
});
