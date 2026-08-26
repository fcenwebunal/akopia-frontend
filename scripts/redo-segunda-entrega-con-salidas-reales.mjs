#!/usr/bin/env node
/*
 * SEGUNDA versión del rehecho de la "segunda entrega de mercados" (la
 * primera fue redo-segunda-entrega-cantidades-sensatas.mjs, 25/26 ago
 * 2026). Rechazada explícitamente por Juan Manuel: "quiero que solucionemos
 * ese problema de raíz, limpia esos registros y reestructura nuevamente
 * cada donación ... la idea es que la repartición sea en valores enteros y
 * que se guarden los beneficiarios de la donación además de respaldar lo
 * que salió en salidas de google sheets ... con un sentido logístico real
 * no netamente matemático."
 *
 * QUÉ CAMBIA respecto al intento anterior: en vez de repartir el total de
 * cada producto en partes iguales (con un sorteo al azar para la unidad
 * sobrante), esta versión usa los 22 bloques REALES de la pestaña SALIDAS
 * -- cada bloque es la bolsa real que una familia recibió el 24 de agosto,
 * con sus cantidades tal cual se registraron, no un promedio.
 *
 * HALLAZGO CLAVE (verificado con dos heurísticas de segmentación distintas
 * que coinciden en el mismo resultado, y con una relectura fresca de la
 * hoja para descartar un error de transcripción): la pestaña SALIDAS solo
 * tiene 22 bloques por familia, no 30 -- y la suma de esos 22 bloques NO
 * cubre el total real que salió (INGRESO-STOCK) para los alimentos básicos
 * (arroz, pasta, harina, frijol, lenteja, sal): falta una porción
 * sustancial (30-45%) que salió de bodega pero nunca quedó anotada bolsa
 * por bolsa. No hay forma de saber a quién le tocó esa porción faltante.
 *
 * DISEÑO adoptado en consecuencia:
 *   - Los primeros 22 beneficiarios (por orden de parada) reciben el
 *     bloque real correspondiente, tal cual se registró -- sin tocar sus
 *     cantidades (más allá de convertir la unidad de la hoja a la unidad
 *     del catálogo, ej. kg de sardina -> latas).
 *   - Lo que falta para llegar al total real (`INGRESO-STOCK`, el mismo
 *     número ya usado y aprobado el 24 de agosto) se reparte como un
 *     COMPLEMENTO PAREJO entre las 30 personas completas -- no solo entre
 *     las 8 sin bloque. Repartir ese resto solo entre 8 personas los deja
 *     con cantidades muy por encima de cualquier familia real (ej. 4.3 kg
 *     de arroz por persona, cuando la bolsa real más grande registrada fue
 *     2.5 kg) -- el mismo tipo de número "poco creíble" que se pidió
 *     evitar, solo que trasladado a otras 8 personas en vez de repartido al
 *     azar. Un complemento parejo sobre las 30 mantiene a todos en el rango
 *     de lo que las bolsas reales muestran.
 *   - Ese complemento, en unidades discretas, se reparte en ORDEN DE
 *     ENTREGA (parada 1, 2, 3...), no al azar -- así se explica y se audita
 *     sin depender de una semilla aleatoria.
 *   - Kilogramos/litros siguen siendo fraccionarios (pesar 0.5 kg de arroz
 *     es normal); el requisito de valores enteros aplica a lo discreto
 *     (paquetes, unidades, latas).
 *
 * "Respaldar lo que salió en salidas de Google Sheets": los 22 bloques
 * reales quedan guardados aparte, tal cual, en
 * scripts/data/salidas-bloques-reales.json (extract-salidas-bloques.mjs),
 * antes de que este script los toque o los convierta a unidades de
 * catálogo -- ver ese archivo para la fuente exacta y la fecha de lectura.
 *
 * Uso:
 *   node scripts/redo-segunda-entrega-con-salidas-reales.mjs --dry-run
 *   node scripts/redo-segunda-entrega-con-salidas-reales.mjs
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
const N_WITH_BLOCK = 22;
const BRIGADE = "Segunda entrega de mercados";

// ── Copiado verbatim de import-salidas-beneficiarios.mjs / redo-...-sensatas.mjs (mismo total ya aprobado el 24 ago) ──
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
  "AGUA": { name: "Agua embotellada 500ml", factor: 1 },
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
  "PASTA": { name: "Pasta", factor: 1 },
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
  const salida = {};
  for (const key of new Set([...Object.keys(ingreso), ...Object.keys(stock)])) {
    salida[key] = (ingreso[key] || 0) - (stock[key] || 0);
  }
  const cap = (product, unit, computed, ingresoQty) => (computed > ingresoQty + 1e-9 ? ingresoQty : computed);
  const fold = (fromKey, toKey) => {
    const extra = salida[fromKey] || 0;
    delete salida[fromKey];
    if (extra) salida[toKey] = (salida[toKey] || 0) + extra;
  };
  const key = (p, u) => `${p}|${u}`;

  salida[key("AZUCAR", "KG")] = cap("AZUCAR", "KG", salida[key("AZUCAR", "KG")], ingreso[key("AZUCAR", "KG")]);
  fold(key("DETERGENTE", "UNIDADES"), key("DETERGENTE", "LITROS"));
  salida[key("DETERGENTE", "LITROS")] = cap("DETERGENTE", "LITROS", salida[key("DETERGENTE", "LITROS")], ingreso[key("DETERGENTE", "LITROS")]);
  fold(key("JABON DE MANOS", "UNIDADES"), key("JABON DE MANOS", "LITROS"));
  salida[key("JABON DE MANOS", "LITROS")] = cap("JABON DE MANOS", "LITROS", salida[key("JABON DE MANOS", "LITROS")], ingreso[key("JABON DE MANOS", "LITROS")]);
  fold(key("KIT DENTAL", "UNIDADES"), key("KIT DENTAL", "PAQUETES"));
  salida[key("KIT DENTAL", "PAQUETES")] = cap("KIT DENTAL", "PAQUETES", salida[key("KIT DENTAL", "PAQUETES")], ingreso[key("KIT DENTAL", "PAQUETES")]);
  if (salida[key("JABON DE LOZA", "UNIDADES")]) delete salida[key("JABON DE LOZA", "UNIDADES")];
  fold(key("MAQUINAS DE AFEITAR", "UNIDADES"), key("MAQUINAS DE AFEITAR", "PAQUETES"));
  salida[key("MAQUINAS DE AFEITAR", "PAQUETES")] = cap("MAQUINAS DE AFEITAR", "PAQUETES", salida[key("MAQUINAS DE AFEITAR", "PAQUETES")], ingreso[key("MAQUINAS DE AFEITAR", "PAQUETES")]);
  if (salida[key("SHAMPOO ADULTOS", "UNIDADES")]) delete salida[key("SHAMPOO ADULTOS", "UNIDADES")];

  return salida;
}

function mergeRows(rows) {
  const d = {};
  for (const [p, u, q] of rows) { const k = `${p}|${u}`; d[k] = (d[k] || 0) + q; }
  return d;
}
function round3(n) { return Math.round(n * 1000) / 1000; }

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

  const backup = JSON.parse(
    fs.readFileSync(path.join(__dirname, "data", "salidas-bloques-reales.json"), "utf8")
  );
  const blocks = backup.bloques;
  if (blocks.length !== N_WITH_BLOCK) {
    console.error(`Se esperaban ${N_WITH_BLOCK} bloques reales, hay ${blocks.length}.`);
    process.exit(1);
  }

  const ingresoMerged = mergeRows(INGRESO_RAW);
  const stockMerged = mergeRows(STOCK_RAW);
  const salida = reconcile(ingresoMerged, stockMerged);

  // Valor por bloque real, por nombre de producto de la hoja (0 si no aparece en ese bloque).
  const blockValueBySheetName = new Map();
  for (const sheetName of Object.keys(PRODUCT_MAP)) {
    const perBlock = blocks.map((b) => {
      const row = b.find((r) => r.product === sheetName);
      return row ? row.qty : 0;
    });
    blockValueBySheetName.set(sheetName, perBlock);
  }

  // allocations: productCatalogName -> array de 30 cantidades (unidades de catálogo)
  const allocations = new Map();
  const report = [];

  for (const [sheetName, map] of Object.entries(PRODUCT_MAP)) {
    if (map.skip) continue;
    const product = productByName.get(map.name);
    if (!product) { report.push({ sheetName, kind: "SIN PRODUCTO EN CATALOGO", detail: map.name }); continue; }
    const unitCode = unitCodeById.get(product.default_unit_id);
    const isContinuous = CONTINUOUS_UNITS.has(unitCode);

    const ingKey = Object.keys(ingresoMerged).find((k) => k.startsWith(sheetName + "|"));
    const totalSheetUnit = ingKey ? (salida[ingKey] ?? 0) : 0;
    if (Math.abs(totalSheetUnit) < 1e-6) { report.push({ sheetName, kind: "sin salida real (0)", detail: "" }); continue; }

    const perBlockSheet = blockValueBySheetName.get(sheetName);
    const arr = Array(N_BENEFICIARIES).fill(0);

    // El "resto" (lo que salió de verdad menos lo que ya está en los 22 bloques
    // reales) se reparte entre las 30 personas COMPLETAS, como un complemento
    // parejo encima de lo que cada quien ya tenga -- no solo entre las 8 sin
    // bloque. Repartirlo solo entre 8 infla sus cantidades muy por encima de
    // cualquier familia real (ej. 4.3 kg de arroz por persona cuando la bolsa
    // real más grande registrada fue 2.5 kg) -- exactamente el tipo de número
    // "poco creíble" que Juan Manuel pidió evitar, solo que trasladado a otras
    // 8 personas en vez de repartido al azar. Un complemento parejo sobre las
    // 30 mantiene a todos en el rango de lo que las bolsas reales muestran.
    if (isContinuous) {
      let sumAssigned = 0;
      for (let i = 0; i < N_WITH_BLOCK; i++) {
        const v = round3(perBlockSheet[i] * map.factor);
        arr[i] = v;
        sumAssigned += v;
      }
      const totalCatalog = round3(totalSheetUnit * map.factor);
      const leftover = Math.max(0, round3(totalCatalog - sumAssigned));
      const share = round3(leftover / N_BENEFICIARIES);
      if (share >= 0.001) {
        for (let i = 0; i < N_BENEFICIARIES; i++) arr[i] = round3(arr[i] + share);
      }
      report.push({
        sheetName, kind: "kg/L (bloques + complemento parejo)",
        detail: `total=${totalCatalog} | 22 bloques suman ${round3(sumAssigned)} | resto ${round3(leftover)} repartido entre las 30 (+${share} c/u)`,
      });
    } else {
      // Discreto: los 22 bloques van redondeados al entero más cercano; el resto
      // (entero) se reparte parejo entre las 30 -- base pareja + 1 extra a las
      // primeras N personas en orden de entrega, sin azar.
      let sumAssignedInt = 0;
      for (let i = 0; i < N_WITH_BLOCK; i++) {
        const v = Math.round(perBlockSheet[i] * map.factor);
        arr[i] = v;
        sumAssignedInt += v;
      }
      const totalCatalogInt = Math.round(totalSheetUnit * map.factor);
      const leftoverInt = Math.max(0, totalCatalogInt - sumAssignedInt);

      if (leftoverInt > 0) {
        const base = Math.floor(leftoverInt / N_BENEFICIARIES);
        const remainder = leftoverInt - base * N_BENEFICIARIES;
        for (let i = 0; i < N_BENEFICIARIES; i++) arr[i] += base;
        for (let i = 0; i < remainder; i++) arr[i] += 1;
        report.push({
          sheetName, kind: "discreto (bloques + complemento parejo)",
          detail: `total=${totalCatalogInt} | 22 bloques suman ${sumAssignedInt} | resto ${leftoverInt}: +${base} c/u, +1 extra a las primeras ${remainder}/30 en orden de entrega`,
        });
      } else {
        report.push({
          sheetName, kind: "discreto (solo bloques)",
          detail: `total=${totalCatalogInt} | 22 bloques suman ${sumAssignedInt} | sin resto que repartir`,
        });
      }
    }

    // Acumula por si dos sheetNames distintos mapean al mismo producto de catálogo (ej. CREMA DENTAL ADULTO/NINOS -> Pasta dental)
    if (!allocations.has(map.name)) allocations.set(map.name, Array(N_BENEFICIARIES).fill(0));
    const acc = allocations.get(map.name);
    for (let i = 0; i < N_BENEFICIARIES; i++) acc[i] = isContinuous ? round3(acc[i] + arr[i]) : acc[i] + arr[i];
  }

  console.log("=".repeat(90));
  console.log("REPARTO RECALCULADO CON BLOQUES REALES DE SALIDAS, POR PRODUCTO DE LA HOJA");
  console.log("=".repeat(90));
  for (const r of report) console.log(`  ${r.sheetName.padEnd(24)} ${r.kind.padEnd(34)} ${r.detail}`);

  console.log(`\n${"=".repeat(90)}\nTOTAL POR PERSONA (primeras filas de muestra)\n${"=".repeat(90)}`);
  for (let i = 0; i < N_BENEFICIARIES; i++) {
    const items = [...allocations.entries()].filter(([, arr]) => arr[i] > 0);
    const tag = i < N_WITH_BLOCK ? "[bloque real + complemento]" : "[solo complemento]";
    console.log(`  ${(i + 1).toString().padStart(2)}. ${beneficiaries[i].name.padEnd(32)} ${tag} ${items.length} productos`);
  }

  if (DRY_RUN) {
    console.log(`\n${"=".repeat(90)}\nDRY-RUN: nada se escribió. ${allocations.size} productos con reparto real.\n${"=".repeat(90)}`);
    return;
  }

  // ── Ubicar y liberar las 30 solicitudes/despachos anteriores (segundo intento, ya aprobado el 25/26 ago) ──
  const oldDispatches = await pb.collection("dispatches").getFullList({
    filter: `brigade = "${BRIGADE}"`,
    sort: "created",
    expand: "request_id",
  });
  // Empareja por requester_name, no por posición: un rehecho anterior corrigió
  // a mano un caso fuera del flujo normal (Leonardo Emilio López pinzón, Pan
  // dulce, 25/26 ago) y su despacho quedó creado al final -- el orden de
  // `created` ya no coincide con el orden de beneficiarios.json. También
  // hace la liberación reanudable: si esta corrida se detiene a mitad de
  // camino, una segunda corrida se salta a quien ya no tenga despacho vivo.
  const oldDispatchByName = new Map(
    oldDispatches.map((d) => [d.expand?.request_id?.requester_name, d])
  );
  if (oldDispatchByName.size !== oldDispatches.length) {
    console.error(`Hay nombres de solicitante duplicados entre los despachos de "${BRIGADE}". Abortando.`);
    process.exit(1);
  }

  console.log(`\n== Liberando solicitudes/despachos anteriores (${oldDispatches.length} vivos de ${N_BENEFICIARIES}) ==`);
  for (let i = 0; i < beneficiaries.length; i++) {
    const b = beneficiaries[i];
    const oldDispatch = oldDispatchByName.get(b.name);
    if (!oldDispatch) {
      console.log(`  [${i + 1}/30] ya liberado antes: ${b.name}`);
      continue;
    }
    const oldRequest = oldDispatch.expand?.request_id;

    await fetch(pb.buildURL(`/api/records/dispatches/${oldDispatch.id}/delete`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
      body: JSON.stringify({ reason: "Reemplazado por una solicitud reconstruida con los bloques reales de SALIDAS" }),
    }).then(async (r) => { if (!r.ok) throw new Error(`delete dispatch ${r.status}: ${JSON.stringify(await r.json().catch(() => ({})))}`); });

    await fetch(pb.buildURL(`/api/requests/${oldRequest.id}/cancel`), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: pb.authStore.token },
      body: JSON.stringify({ reason: "Reconstruido con los bloques reales de SALIDAS (segundo rehecho), no con reparto matemático uniforme" }),
    }).then(async (r) => { if (!r.ok) throw new Error(`cancel request ${r.status}: ${JSON.stringify(await r.json().catch(() => ({})))}`); });

    console.log(`  [${i + 1}/30] liberado: ${b.name}`);
  }

  console.log("\n== Creando solicitudes + despachos con los bloques reales ==");
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
        notes: i < N_WITH_BLOCK
          ? `Segunda entrega de mercados (censo "Segundo Informe Mercado"), reconstruida el 26 ago 2026 con el bloque real registrado en SALIDAS de Google Sheets (bolsa ${i + 1} de 22, tal cual se anotó el 24 ago) más un complemento parejo de lo que salió sin bolsa individual registrada -- reemplaza la solicitud anterior. Documento: ${b.doc || "no registrado en la hoja"}.`
          : `Segunda entrega de mercados (censo "Segundo Informe Mercado"), reconstruida el 26 ago 2026: sin bloque individual registrado en SALIDAS (solo hay 22 bloques para 30 beneficiarios) -- recibe el mismo complemento parejo de lo que salió sin bolsa asignada que reciben los demás. Documento: ${b.doc || "no registrado en la hoja"}.`,
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
      }).then(async (r) => { if (!r.ok) throw new Error(`approve ${r.status}: ${JSON.stringify(await r.json().catch(() => ({})))}`); });

      const dispatch = await pb.collection("dispatches").create({
        request_id: request.id,
        driver_name: "Por confirmar",
        driver_phone: "",
        vehicle_plate: "",
        brigade: BRIGADE,
        destination: request.destination,
        dispatch_date: new Date().toISOString().replace("T", " "),
        operator_id: operatorId,
        notes: "Reconstruido el 26 ago 2026 con los bloques reales de SALIDAS -- despacho pendiente de confirmar entrega.",
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

  console.log(`\n${"=".repeat(90)}\nRESUMEN\n${"=".repeat(90)}`);
  console.log(`Solicitudes recreadas: ${requestsOk}/${N_BENEFICIARIES} OK, ${requestErrors.length} con error`);
  for (const e of requestErrors) console.log(`  - ${e.name}: ${e.error}`);
}

main().catch((err) => {
  console.error("Falló:", err?.response ?? err);
  process.exit(1);
});
