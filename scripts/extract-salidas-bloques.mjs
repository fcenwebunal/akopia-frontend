#!/usr/bin/env node
/*
 * Extrae y respalda los bloques reales de la pestaña SALIDAS de "INVENTARIO
 * INTERNO" (Google Sheets) -- cada bloque es la bolsa de mercado real que
 * recibió una familia, registrada fila por fila el 24 de agosto. Pedido
 * explícito de Juan Manuel, 25/26 ago 2026: "respaldar lo que salió en
 * salidas de google sheets" antes de reconstruir el reparto de la segunda
 * entrega.
 *
 * La hoja NO tiene una columna de nombre por fila -- solo el producto y la
 * cantidad, agrupados visualmente por familia (cada bloque repite el mismo
 * patrón de ~13 alimentos). El límite de un bloque se detecta reiniciando
 * cada vez que un producto YA presente en el bloque en curso vuelve a
 * aparecer (señal de que empezó la bolsa de la siguiente familia). Probado
 * con dos heurísticas independientes (conteo de "ARROZ" como inicio, y este
 * reinicio por duplicado) -- ambas coinciden en 22 bloques, así que no es
 * un artefacto de la transcripción.
 *
 * Fuente: fileId 1yz_ndyrO_tlF6WBVsEc_fdrtaP8zAruD_hnLsvZDjUE, pestaña
 * SALIDAS, releída fresca el 26 ago 2026 vía el conector de Google Drive
 * (no la transcripción manual de una sesión anterior).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Filas reales de la pestaña SALIDAS (solo la sección de alimentos, en
// bloques por familia -- la sección de aseo, sin desglose por familia, se
// maneja aparte). Copiadas verbatim de la relectura fresca del 26 ago 2026.
const SALIDAS_FOOD_ROWS = [
["ARROZ",2.5],["LENTEJAS",0.5],["FRIJOL",0.5],["SAL",0.5],["PASTA",0.5],["SARDINA",0.4],["ATUN",0.25],["HARINA",0.5],["LECHE EN POLVO",0.2],["CHOCOLATE",0.12],["AZUCAR",1],["GALLETAS",0.091],["PANELA",0.45],
["ARROZ",2.5],["LENTEJAS",0.5],["FRIJOL",0.5],["SAL",0.5],["AZUCAR",0.5],["LECHE EN POLVO",0.38],["HARINA",0.8],["PASTA",0.5],["ATUN",0.25],["SARDINA",0.425],["PANELA",0.4],["CHOCOLATE",0.2],["GALLETAS",0.091],
["ARROZ",2.5],["LENTEJAS",0.5],["SAL",0.5],["AZUCAR",0.454],["LECHE EN POLVO",0.35],["HARINA",0.8],["SARDINA",0.4],["ATUN",0.25],["PANELA",0.5],["PASTA",0.525],["GALLETAS",0.091],["ACEITE",2.2],["CHOCOLATE",0.12],
["SARDINA",0.4],["LECHE EN POLVO",0.35],["AZUCAR",0.5],["SAL",0.5],["CHOCOLATE",0.12],["GALLETAS",0.091],["PANELA",0.5],["ARROZ",2.5],["LENTEJAS",0.5],["FRIJOL",0.5],["PASTA",0.5],["ATUN",0.24],
["ARROZ",2.5],["LENTEJAS",0.5],["FRIJOL",0.5],["SAL",0.5],["AZUCAR",0.5],["LECHE EN POLVO",0.35],["SARDINA",0.4],["ATUN",0.24],["PASTA",0.525],["PANELA",0.835],["CHOCOLATE",0.2],["ACEITE",0.42],["HARINA",0.8],["GALLETAS",0.091],
["ARROZ",2.5],["LENTEJAS",0.5],["FRIJOL",0.5],["SAL",0.5],["AZUCAR",1],["LECHE EN POLVO",0.35],["HARINA",0.8],["PANELA",1],["ATUN",0.25],["SARDINA",0.425],["PASTA",0.5],["CHOCOLATE",0.23],["ACEITE",0.42],["PANADERIA",0.44],
["ARROZ",2.5],["LENTEJAS",0.5],["FRIJOL",0.5],["SAL",0.5],["AZUCAR",0.5],["HARINA",0.8],["SARDINA",0.225],["ATUN",0.24],["PASTA",0.5],["PANELA",1],["CHOCOLATE",0.5],["PANADERIA",0.44],["LECHE EN POLVO",0.35],["ACEITE",0.42],
["ARROZ",2.5],["LENTEJAS",0.5],["FRIJOL",0.8],["SAL",1],["AZUCAR",0.5],["HARINA",1],["LECHE EN POLVO",0.35],["PANELA",1],["ATUN",0.25],["SARDINA",0.225],["PASTA",0.5],["CHOCOLATE",0.5],["GALLETAS",0.12],["ACEITE",0.42],
["ARROZ",2],["MAIZ PIRA",0.5],["LENTEJAS",0.46],["FRIJOL",0.5],["SAL",0.8],["AZUCAR",0.5],["GALLETAS",0.12],["LECHE EN POLVO",0.6],["HARINA",1],["PANELA",1],["SARDINA",0.225],["ATUN",0.25],["PASTA",0.5],["CHOCOLATE",0.5],["ACEITE",0.42],
["ARROZ",2],["MAIZ PIRA",0.5],["LENTEJAS",0.46],["FRIJOL",0.5],["SAL",1],["AZUCAR",1],["LECHE EN POLVO",0.35],["HARINA",1],["PANELA",1],["SALCHICHA",0.15],["ATUN",0.17],["PASTA",0.55],["ACEITE",0.5],["SARDINA",0.225],["CHOCOLATE",0.5],["GALLETAS",0.12],
["ARROZ",2],["SAL",0.5],["AZUCAR",0.5],["LENTEJAS",0.5],["FRIJOL",0.5],["HARINA",1],["LECHE EN POLVO",0.35],["SARDINA",0.4],["PANELA",1],["CHOCOLATE",0.5],["ATUN",0.17],["SALCHICHA",0.15],["PASTA",0.5],["ACEITE",0.5],["GALLETAS",0.12],
["ARROZ",2],["ARVEJA",0.5],["FRIJOL",0.5],["SAL",1],["AZUCAR",0.5],["HARINA",1],["LECHE EN POLVO",0.35],["PANELA",1],["CHOCOLATE",0.5],["SARDINA",0.4],["ATUN",0.17],["VERDURAS EN LATA",0.3],["PASTA",0.55],["ACEITE",0.5],["GALLETAS",0.12],
["ARROZ",2],["MAIZ PIRA",0.5],["SAL",0.8],["AZUCAR",1],["HARINA",1],["LENTEJAS",0.5],["FRIJOL",1],["LECHE EN POLVO",0.12],["PANELA",1],["SARDINA",0.4],["ATUN",0.17],["CHOCOLATE",0.5],["SALCHICHA",0.15],["ACEITE",0.9],["PASTA",0.55],["GALLETAS",0.12],
["ARROZ",2],["LENTEJAS",1],["FRIJOL",0.5],["SAL",0.8],["AZUCAR",1],["LECHE EN POLVO",0.35],["HARINA",0.8],["CHOCOLATE",0.5],["ATUN",0.16],["SALCHICHA",0.15],["PASTA",0.55],["ACEITE",0.9],["GALLETAS",0.12],["SARDINA",0.225],["PANELA",1],
["ACEITE",0.9],["PASTA",0.55],["GALLETAS",0.12],["ARROZ",2],["MAIZ PIRA",0.5],["ARVEJA",0.5],["SAL",1],["AZUCAR",0.5],["HARINA",1],["AVENA",0.22],["PANELA",1],["SARDINA",0.4],["ATUN",0.25],["CHOCOLATE",0.5],["FRIJOLES EN LATA",0.3],
["PASTA",0.55],["ACEITE",0.9],["GALLETAS",0.12],["ARROZ",2],["LENTEJAS",0.5],["FRIJOL",0.5],["SAL",1],["AZUCAR",0.5],["LECHE EN POLVO",0.35],["HARINA",0.8],["SARDINA",0.225],["ATUN",0.16],["SALCHICHA",0.15],
["PASTA",0.55],["ACEITE",0.9],["GALLETAS",0.12],["ARROZ",2.5],["LENTEJAS",0.5],["FRIJOL",0.454],["LECHE EN POLVO",0.35],["HARINA",1],["SAL",1],["AZUCAR",1],["PANELA",1],["SARDINA",0.225],["ATUN",0.27],["SALCHICHA",0.15],
["PASTA",0.55],["ACEITE",0.9],["GALLETAS",0.12],["ARROZ",2],["VERDURAS EN LATA",0.57],["LENTEJAS",0.46],["FRIJOL",0.454],["LECHE EN POLVO",0.35],["HARINA",1],["AZUCAR",1],["SAL",0.8],["SARDINA",0.225],["ATUN",0.16],
["PASTA",0.525],["ACEITE",0.9],["GALLETAS",0.12],["ARROZ",1.862],["LENTEJAS",1],["HARINA",1],["AZUCAR",1],["SAL",0.8],["LECHE EN POLVO",1],["SARDINA",0.225],["ATUN",0.15],["SALCHICHA",0.15],
["PASTA",0.525],["ACEITE",0.9],["GALLETAS",0.12],["ARROZ",1.9],["LENTEJAS",0.454],["FRIJOL",1],["AVENA",0.22],["HARINA",1],["AZUCAR",1],["SAL",1],["SARDINA",0.225],["ATUN",0.14],["SALCHICHA",0.15],
["PASTA",0.55],["ACEITE",0.9],["GALLETAS",0.12],["ARROZ",2],["LENTEJAS",0.5],["FRIJOL",1],["HARINA",1],["SAL",1],["AVENA",0.22],["AZUCAR",1],["ATUN",0.14],["SARDINA",0.225],
["PASTA",0.525],["ACEITE",0.9],["SALCHICHA",0.15],["GALLETAS",0.072],["ARROZ",2],["ARVEJA",0.5],["FRIJOL",1],["PANELA",0.5],["SAL",1],["AVENA",0.22],
];

function segmentBlocks(rows) {
  const blocks = [];
  let current = [];
  let seen = new Set();
  for (const [product, qty] of rows) {
    if (seen.has(product)) {
      blocks.push(current);
      current = [];
      seen = new Set();
    }
    current.push({ product, qty });
    seen.add(product);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

const blocks = segmentBlocks(SALIDAS_FOOD_ROWS);

console.log(`Bloques detectados: ${blocks.length}`);
blocks.forEach((b, i) => console.log(`  Bloque ${i + 1}: ${b.length} filas`));

if (blocks.length !== 22) {
  console.error(`\nSe esperaban 22 bloques, se detectaron ${blocks.length}. Revisar antes de continuar.`);
  process.exit(1);
}

const outPath = path.join(__dirname, "data", "salidas-bloques-reales.json");
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      fuente: "INVENTARIO INTERNO, pestaña SALIDAS -- fileId 1yz_ndyrO_tlF6WBVsEc_fdrtaP8zAruD_hnLsvZDjUE",
      releido: "2026-08-26",
      nota: "Cada bloque es la bolsa real de una familia, en el orden en que aparece en la hoja. La hoja no tiene columna de nombre por fila -- la asignación a un beneficiario específico (por orden de parada) es una convención documentada en redo-segunda-entrega-con-salidas-reales.mjs, no un dato verificado de la hoja.",
      bloques: blocks,
    },
    null,
    2
  )
);
console.log(`\nGuardado en ${outPath}`);
