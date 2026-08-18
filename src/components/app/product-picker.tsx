"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Catalog, Category, Group, Product } from "@/lib/catalog";
import { searchProducts, unitLabel } from "@/lib/catalog";
import { pb } from "@/lib/pb";
import { CatalogAddForm } from "./catalog-add-form";
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
 * solo texto. La cámara para poner o cambiar la foto de una categoría o
 * un producto la ve cualquier activo desde el 18 de agosto (el backend
 * limita a un operador a tocar solo `photo_url`, nunca el resto del
 * registro — ver `06_catalog_photo_guard.pb.js`); la de un GRUPO sigue
 * siendo solo de `isAdmin`, no se pidió abrirla. La casilla "Agregar"
 * tampoco depende de `isAdmin`: admin y operador pueden ampliar el
 * catálogo por igual desde la migración 033.
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

  // Lo que se crea desde aquí se guarda aparte y se combina con `catalog`
  // al renderizar, para que aparezca al instante sin recargar el
  // catálogo entero (189 registros) por un solo elemento nuevo.
  const [addedGroups, setAddedGroups] = useState<Group[]>([]);
  const [addedCategories, setAddedCategories] = useState<Category[]>([]);
  const [addedProducts, setAddedProducts] = useState<Product[]>([]);
  const [addingKind, setAddingKind] = useState<"group" | "category" | "product" | null>(null);

  const effectiveCatalog = useMemo<Catalog>(
    () => ({
      groups: [...catalog.groups, ...addedGroups],
      categories: [...catalog.categories, ...addedCategories],
      products: [...catalog.products, ...addedProducts],
      units: catalog.units,
    }),
    [catalog, addedGroups, addedCategories, addedProducts]
  );

  const results = useMemo(
    () => searchProducts(effectiveCatalog, query),
    [effectiveCatalog, query]
  );

  const browsing = groupId !== null;
  const searching = query.trim().length >= 2;

  const categories = useMemo(
    () => effectiveCatalog.categories.filter((category) => category.group_id === groupId),
    [effectiveCatalog.categories, groupId]
  );

  const products = useMemo(
    () => effectiveCatalog.products.filter((product) => product.category_id === categoryId),
    [effectiveCatalog.products, categoryId]
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
          catalog={effectiveCatalog}
          products={results}
          photoOverrides={photoOverrides}
          canUpload
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
                sublabel={unitLabel(effectiveCatalog, product.default_unit_id)}
                photoUrl={photoOverrides[product.id] ?? product.photo_url}
                recordId={product.id}
                kind="products"
                onSelect={() => onSelect(product)}
                onUpload={(id, url) => savePhoto("products", id, url)}
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
                items={effectiveCatalog.groups}
                photoOverrides={photoOverrides}
                canUpload={isAdmin}
                kind="groups"
                onUpload={(id, url) => savePhoto("groups", id, url)}
                disabledIf={(group) =>
                  effectiveCatalog.categories.every((category) => category.group_id !== group.id)
                }
                sublabelFor={(group) => {
                  const count = effectiveCatalog.categories.filter(
                    (category) => category.group_id === group.id
                  ).length;
                  return count === 0 ? "Vacío" : `${count} categorías`;
                }}
                onSelect={(group) => setGroupId(group.id)}
                onAddNew={() => setAddingKind("group")}
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
                  canUpload
                  kind="categories"
                  onUpload={(id, url) => savePhoto("categories", id, url)}
                  onSelect={(category) => setCategoryId(category.id)}
                  onAddNew={() => setAddingKind("category")}
                />
              ) : (
                <ProductGrid
                  catalog={effectiveCatalog}
                  products={products}
                  photoOverrides={photoOverrides}
                  canUpload
                  onUpload={(id, url) => savePhoto("products", id, url)}
                  empty="Esta categoría no tiene productos."
                  onSelect={onSelect}
                  onAddNew={() => setAddingKind("product")}
                />
              )}
            </>
          )}
        </section>
      ) : null}

      {addingKind ? (
        <CatalogAddForm
          kind={addingKind}
          catalog={effectiveCatalog}
          groupId={groupId ?? undefined}
          categoryId={categoryId ?? undefined}
          onCancel={() => setAddingKind(null)}
          onCreated={(record) => {
            setAddingKind(null);
            if (addingKind === "group") {
              setAddedGroups((current) => [...current, record as Group]);
            } else if (addingKind === "category") {
              setAddedCategories((current) => [...current, record as Category]);
            } else {
              setAddedProducts((current) => [...current, record as Product]);
              onSelect(record as Product);
            }
          }}
        />
      ) : null}
    </div>
  );
}

function TileGrid<T extends { id: string; name: string; photo_url?: string }>({
  items,
  photoOverrides,
  canUpload,
  kind,
  onUpload,
  onSelect,
  disabledIf,
  sublabelFor,
  onAddNew,
}: {
  items: T[];
  photoOverrides: Record<string, string>;
  canUpload: boolean;
  kind: "groups" | "categories";
  onUpload: (id: string, url: string) => void;
  onSelect: (item: T) => void;
  disabledIf?: (item: T) => boolean;
  sublabelFor?: (item: T) => string;
  onAddNew?: () => void;
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
            onUpload={canUpload ? onUpload : undefined}
          />
        );
      })}
      {onAddNew ? <AddTile onClick={onAddNew} /> : null}
    </div>
  );
}

// Misma forma que una casilla de foto, para que "agregar" se vea como una
// más de la cuadrícula en vez de un botón aparte y fuera de lugar.
function AddTile({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-(--rule) text-(--muted) hover:border-unal-green-dark hover:text-unal-green-dark"
    >
      <Plus size={22} strokeWidth={2.5} />
      <span className="text-xs font-bold">Agregar</span>
    </button>
  );
}

function ProductGrid({
  catalog,
  products,
  photoOverrides,
  canUpload,
  onUpload,
  empty,
  onSelect,
  onAddNew,
}: {
  catalog: Catalog;
  products: Product[];
  photoOverrides: Record<string, string>;
  canUpload: boolean;
  onUpload: (id: string, url: string) => void;
  empty: string;
  onSelect: (product: Product) => void;
  onAddNew?: () => void;
}) {
  if (products.length === 0 && !onAddNew) {
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
          onUpload={canUpload ? onUpload : undefined}
        />
      ))}
      {onAddNew ? <AddTile onClick={onAddNew} /> : null}
    </div>
  );
}
