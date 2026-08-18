"use client";

import { ArrowLeft } from "lucide-react";
import { useMemo, useState } from "react";
import type { Catalog, Category, Group, Product } from "@/lib/catalog";
import { searchProducts, unitLabel } from "@/lib/catalog";
import { pb } from "@/lib/pb";
import { PhotoTile } from "./photo-tile";

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
 *
 * El explorador se ve como un menú de restaurante: foto y nombre, no
 * solo texto. `isAdmin` decide si aparece el distintivo de cámara para
 * poner o cambiar esa foto — el resto solo la ve.
 */
export function ProductPicker({
  catalog,
  recent,
  onSelect,
  isAdmin = false,
}: {
  catalog: Catalog;
  recent: Product[];
  onSelect: (product: Product) => void;
  isAdmin?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);

  // Sobreescribe photo_url localmente al subir una foto, para que la
  // casilla cambie al instante sin recargar todo el catálogo.
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string>>({});

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

  async function savePhoto(
    collection: "groups" | "categories" | "products",
    id: string,
    url: string
  ) {
    setPhotoOverrides((current) => ({ ...current, [id]: url }));
    try {
      await pb.collection(collection).update(id, { photo_url: url });
    } catch {
      // La casilla ya muestra la foto nueva; si el guardado falló, la
      // próxima carga del catálogo la revierte sola. No vale la pena
      // bloquear la captura por esto — es una foto, no un movimiento
      // de inventario.
    }
  }

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
        <ProductGrid
          catalog={catalog}
          products={results}
          photoOverrides={photoOverrides}
          isAdmin={isAdmin}
          onUpload={(id, url) => savePhoto("products", id, url)}
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
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {recent.map((product) => (
              <PhotoTile
                key={product.id}
                label={product.name}
                sublabel={unitLabel(catalog, product.default_unit_id)}
                photoUrl={photoOverrides[product.id] ?? product.photo_url}
                recordId={product.id}
                kind="products"
                onSelect={() => onSelect(product)}
                onUpload={isAdmin ? (id, url) => savePhoto("products", id, url) : undefined}
              />
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
              <TileGrid<Group>
                items={catalog.groups}
                photoOverrides={photoOverrides}
                isAdmin={isAdmin}
                kind="groups"
                onUpload={(id, url) => savePhoto("groups", id, url)}
                disabledIf={(group) =>
                  catalog.categories.every((category) => category.group_id !== group.id)
                }
                sublabelFor={(group) => {
                  const count = catalog.categories.filter(
                    (category) => category.group_id === group.id
                  ).length;
                  return count === 0 ? "Vacío" : `${count} categorías`;
                }}
                onSelect={(group) => setGroupId(group.id)}
              />
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
                aria-label="Volver"
                className="mb-3 flex h-9 w-9 items-center justify-center rounded border border-(--rule) bg-(--surface) text-unal-green-dark hover:border-unal-green hover:bg-unal-green-soft"
              >
                <ArrowLeft size={18} strokeWidth={2.5} />
              </button>

              {!categoryId ? (
                <TileGrid<Category>
                  items={categories}
                  photoOverrides={photoOverrides}
                  isAdmin={isAdmin}
                  kind="categories"
                  onUpload={(id, url) => savePhoto("categories", id, url)}
                  onSelect={(category) => setCategoryId(category.id)}
                />
              ) : (
                <ProductGrid
                  catalog={catalog}
                  products={products}
                  photoOverrides={photoOverrides}
                  isAdmin={isAdmin}
                  onUpload={(id, url) => savePhoto("products", id, url)}
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

function TileGrid<T extends { id: string; name: string; photo_url?: string }>({
  items,
  photoOverrides,
  isAdmin,
  kind,
  onUpload,
  onSelect,
  disabledIf,
  sublabelFor,
}: {
  items: T[];
  photoOverrides: Record<string, string>;
  isAdmin: boolean;
  kind: "groups" | "categories";
  onUpload: (id: string, url: string) => void;
  onSelect: (item: T) => void;
  disabledIf?: (item: T) => boolean;
  sublabelFor?: (item: T) => string;
}) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
      {items.map((item) => {
        const disabled = disabledIf?.(item) ?? false;

        return (
          <PhotoTile
            key={item.id}
            label={item.name}
            sublabel={sublabelFor?.(item)}
            photoUrl={photoOverrides[item.id] ?? item.photo_url}
            recordId={item.id}
            kind={kind}
            disabled={disabled}
            onSelect={() => onSelect(item)}
            onUpload={isAdmin ? onUpload : undefined}
          />
        );
      })}
    </div>
  );
}

function ProductGrid({
  catalog,
  products,
  photoOverrides,
  isAdmin,
  onUpload,
  empty,
  onSelect,
}: {
  catalog: Catalog;
  products: Product[];
  photoOverrides: Record<string, string>;
  isAdmin: boolean;
  onUpload: (id: string, url: string) => void;
  empty: string;
  onSelect: (product: Product) => void;
}) {
  if (products.length === 0) {
    return <p className="mt-4 text-sm text-(--muted)">{empty}</p>;
  }

  return (
    <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
      {products.map((product) => (
        <PhotoTile
          key={product.id}
          label={product.name}
          sublabel={unitLabel(catalog, product.default_unit_id)}
          photoUrl={photoOverrides[product.id] ?? product.photo_url}
          recordId={product.id}
          kind="products"
          onSelect={() => onSelect(product)}
          onUpload={isAdmin ? onUpload : undefined}
        />
      ))}
    </div>
  );
}
