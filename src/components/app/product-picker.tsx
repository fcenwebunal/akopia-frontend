"use client";

import { useMemo, useState } from "react";
import type { Catalog, Product } from "@/lib/catalog";
import { searchProducts, unitLabel } from "@/lib/catalog";

/*
 * Tres caminos hacia el mismo sitio, por orden de velocidad:
 *
 *   1. Recientes  — un toque. En una remesa se repiten las mismas
 *                   referencias, así que es el camino más usado.
 *   2. Búsqueda   — tres letras.
 *   3. Jerarquía  — la red de seguridad para quien no sabe cómo se llama
 *                   lo que tiene en la mano.
 *
 * Con 123 productos la jerarquía es el camino lento (tres niveles para
 * elegir entre tres opciones), por eso no es el que se ve primero.
 */
export function ProductPicker({
  catalog,
  recent,
  onSelect,
}: {
  catalog: Catalog;
  recent: Product[];
  onSelect: (product: Product) => void;
}) {
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const results = useMemo(
    () => searchProducts(catalog, query),
    [catalog, query]
  );

  const browsing = groupId !== null;
  const searching = query.trim().length >= 2;

  const categories = useMemo(
    () => catalog.categories.filter((category) => category.group_id === groupId),
    [catalog.categories, groupId]
  );

  const products = useMemo(
    () => catalog.products.filter((product) => product.category_id === categoryId),
    [catalog.products, categoryId]
  );

  return (
    <div>
      <label htmlFor="buscar" className="sr-only">
        Buscar producto
      </label>
      <input
        id="buscar"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar producto…"
        autoComplete="off"
        className="w-full rounded border border-(--rule) bg-(--surface) px-4 py-3 text-base focus:border-unal-green-dark"
      />

      {searching ? (
        <ResultList
          catalog={catalog}
          products={results}
          empty="Ningún producto coincide."
          onSelect={(product) => {
            onSelect(product);
            setQuery("");
          }}
        />
      ) : null}

      {!searching && recent.length > 0 ? (
        <section className="mt-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-(--muted)">
            Recientes
          </h3>
          <div className="flex flex-wrap gap-2">
            {recent.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => onSelect(product)}
                className="rounded border border-(--rule) bg-(--surface) px-3 py-2 text-left text-sm font-bold hover:border-unal-green"
              >
                {product.name}
                <span className="ml-2 font-normal text-(--muted)">
                  {unitLabel(catalog, product.default_unit_id)}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {!searching ? (
        <section className="mt-4">
          {!browsing ? (
            <>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-(--muted)">
                Explorar por categoría
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {catalog.groups.map((group) => {
                  const count = catalog.categories.filter(
                    (category) => category.group_id === group.id
                  ).length;

                  return (
                    <button
                      key={group.id}
                      type="button"
                      disabled={count === 0}
                      onClick={() => setGroupId(group.id)}
                      className="rounded border border-(--rule) bg-(--surface) px-3 py-3 text-left text-sm font-bold hover:border-unal-green disabled:opacity-40"
                    >
                      {group.name}
                      {count === 0 ? (
                        <span className="ml-2 font-normal text-(--muted)">
                          (vacío)
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (categoryId) {
                    setCategoryId(null);
                  } else {
                    setGroupId(null);
                  }
                }}
                className="mb-3 text-sm font-bold text-unal-green-dark"
              >
                ← Volver
              </button>

              {!categoryId ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => setCategoryId(category.id)}
                      className="rounded border border-(--rule) bg-(--surface) px-3 py-3 text-left text-sm font-bold hover:border-unal-green"
                    >
                      {category.name}
                    </button>
                  ))}
                </div>
              ) : (
                <ResultList
                  catalog={catalog}
                  products={products}
                  empty="Esta categoría no tiene productos."
                  onSelect={onSelect}
                />
              )}
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

function ResultList({
  catalog,
  products,
  empty,
  onSelect,
}: {
  catalog: Catalog;
  products: Product[];
  empty: string;
  onSelect: (product: Product) => void;
}) {
  if (products.length === 0) {
    return <p className="mt-4 text-sm text-(--muted)">{empty}</p>;
  }

  return (
    <ul className="mt-3 divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
      {products.map((product) => (
        <li key={product.id}>
          <button
            type="button"
            onClick={() => onSelect(product)}
            className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-(--surface-2)"
          >
            <span className="font-medium">{product.name}</span>
            <span className="text-sm text-(--muted)">
              {unitLabel(catalog, product.default_unit_id)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
