"use client";

import { pb } from "./pb";

export interface Unit {
  id: string;
  code: string;
  name: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string;
  default_unit_id: string;
  requires_expiry: boolean;
  requires_batch: boolean;
  requires_quarantine: boolean;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  group_id: string;
}

export interface Group {
  id: string;
  name: string;
}

export interface Catalog {
  groups: Group[];
  categories: Category[];
  products: Product[];
  units: Record<string, Unit>;
}

/*
 * El catálogo entero son 189 registros y no cambia durante una recepción.
 * Traerlo una vez y filtrar en memoria hace que buscar y navegar sean
 * instantáneos: en bodega la señal es mala justo donde se descarga, y una
 * petición por pulsación haría la captura inusable.
 */
export async function loadCatalog(): Promise<Catalog> {
  const [groups, categories, products, units] = await Promise.all([
    pb.collection("groups").getFullList<Group>({ sort: "name" }),
    pb.collection("categories").getFullList<Category>({ sort: "name" }),
    pb.collection("products").getFullList<Product>({ sort: "name" }),
    pb.collection("units").getFullList<Unit>({ sort: "name" }),
  ]);

  const unitsById: Record<string, Unit> = {};
  for (const unit of units) {
    unitsById[unit.id] = unit;
  }

  return {
    groups,
    categories,
    products: products.filter((product) => product.active !== false),
    units: unitsById,
  };
}

// Sin acentos ni mayúsculas: quien captura de pie no escribe tildes.
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function searchProducts(
  catalog: Catalog,
  query: string,
  limit = 20
): Product[] {
  const needle = normalize(query.trim());
  if (needle.length < 2) {
    return [];
  }

  const categoryNames: Record<string, string> = {};
  for (const category of catalog.categories) {
    categoryNames[category.id] = normalize(category.name);
  }

  // Los que empiezan por el término van primero: al escribir "len" se
  // busca "lentejas", no "aceite de lentisco".
  const starts: Product[] = [];
  const contains: Product[] = [];

  for (const product of catalog.products) {
    const name = normalize(product.name);

    if (name.startsWith(needle)) {
      starts.push(product);
    } else if (
      name.includes(needle) ||
      (categoryNames[product.category_id] ?? "").includes(needle)
    ) {
      contains.push(product);
    }
  }

  return [...starts, ...contains].slice(0, limit);
}

export function unitLabel(catalog: Catalog, unitId: string): string {
  const unit = catalog.units[unitId];
  if (!unit) {
    return "";
  }
  return unit.code || unit.name;
}
