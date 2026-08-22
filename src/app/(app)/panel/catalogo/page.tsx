"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Camera, Loader2, Plus } from "lucide-react";
import { currentUser, pb } from "@/lib/pb";
import { hasAnyRole } from "@/lib/roles";
import { normalize } from "@/lib/catalog";
import { uploadPhoto, UploadError, type PhotoKind } from "@/lib/cloudinary";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { EditRecordButton, DeleteRecordButton, type EditableField } from "@/components/app/record-actions";
import { CatalogAddForm } from "@/components/app/catalog-add-form";
import { LocationAddForm } from "@/components/app/location-add-form";

interface Group {
  id: string;
  name: string;
  description: string;
  photo_url?: string;
  active?: boolean;
}
interface Category {
  id: string;
  name: string;
  description: string;
  group_id: string;
  default_unit_id?: string;
  photo_url?: string;
  active?: boolean;
}
interface ProductRow {
  id: string;
  name: string;
  description: string;
  category_id: string;
  default_unit_id: string;
  min_stock_alert?: number;
  requires_batch?: boolean;
  requires_expiry?: boolean;
  requires_quarantine?: boolean;
  is_fragile?: boolean;
  is_hazardous?: boolean;
  photo_url?: string;
  active?: boolean;
  expand?: { category_id?: { name?: string } };
}
interface LocationRow {
  id: string;
  zone: string;
  shelf?: string;
  position?: string;
  description?: string;
  capacity_m3?: number;
  is_cold_chain?: boolean;
  photo_url?: string;
  active?: boolean;
}
interface Unit {
  id: string;
  code: string;
  name: string;
  active?: boolean;
}

type SectionKey = "groups" | "categories" | "products" | "locations";

const SECTION_LABELS: Record<SectionKey, string> = {
  groups: "Grupos",
  categories: "Categorías",
  products: "Productos",
  locations: "Ubicaciones",
};

const ADD_LABELS: Record<SectionKey, string> = {
  groups: "Agregar grupo",
  categories: "Agregar categoría",
  products: "Agregar producto",
  locations: "Agregar ubicación",
};

// Colores derivados del nombre, no al azar: la misma referencia siempre
// cae en el mismo color, para que la cuadrícula no "parpadee" entre
// recargas mientras un registro no tiene foto.
const PALETTE = [
  "bg-unal-green-soft text-unal-green-dark",
  "bg-unal-aqua/15 text-unal-aqua",
  "bg-unal-orange/15 text-unal-orange",
  "bg-unal-yellow/20 text-[#8a6d00]",
  "bg-unal-red/10 text-unal-red",
];

function colorFor(text: string): string {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

/*
 * La foto de la tarjeta: imagen o inicial de color, con una cámara para
 * cambiarla — solo si `canEdit` (registro activo, y la pantalla entera
 * ya está limitada a admin/coordinación). El backend deja tocar
 * `photo_url` a cualquier activo sin motivo obligatorio
 * (`06_catalog_photo_guard.pb.js`), a propósito distinto del resto de
 * los campos: es una foto, no un dato de negocio.
 */
function PhotoBox({
  photoUrl,
  name,
  kind,
  canEdit,
  onUploaded,
}: {
  photoUrl?: string;
  name: string;
  kind: PhotoKind;
  canEdit: boolean;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const url = await uploadPhoto(file, kind);
      onUploaded(url);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-(--rule) bg-(--surface-2)">
      {photoUrl ? (
        <Image src={photoUrl} alt="" width={200} height={200} className="h-full w-full object-cover" />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center text-3xl font-black ${colorFor(name)}`}
          aria-hidden="true"
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}

      {canEdit ? (
        <>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            aria-label={`Cambiar foto de ${name}`}
            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-60"
          >
            {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </>
      ) : null}

      {error ? (
        <p role="alert" className="absolute inset-x-0 bottom-0 bg-unal-red/90 px-1 py-0.5 text-[10px] font-bold text-white">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function CatalogCard({
  photoUrl,
  name,
  kind,
  canEditPhoto,
  onPhotoUploaded,
  tag,
  inactive,
  actions,
}: {
  photoUrl?: string;
  name: string;
  kind: PhotoKind;
  canEditPhoto: boolean;
  onPhotoUploaded: (url: string) => void;
  tag?: string;
  inactive?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-(--rule) bg-(--surface) p-3">
      <PhotoBox photoUrl={photoUrl} name={name} kind={kind} canEdit={canEditPhoto} onUploaded={onPhotoUploaded} />

      <div className="mt-2 min-w-0">
        <p className="truncate font-bold" title={name}>
          {name}
        </p>
        {tag ? (
          <p className="truncate text-xs text-(--muted)" title={tag}>
            {tag}
          </p>
        ) : null}
        {inactive ? (
          <span className="mt-1 inline-block rounded bg-(--surface-2) px-1.5 py-0.5 text-[11px] font-bold text-(--muted)">
            Desactivado
          </span>
        ) : null}
      </div>

      {actions ? <div className="mt-3 flex flex-col gap-2">{actions}</div> : null}
    </div>
  );
}

/*
 * "Eliminar" en catálogo nunca borra de verdad — pone active:false, con
 * motivo obligatorio y rastro en Historial (ver EDITABLE_RECORDS en
 * utils/config.js del backend). Por eso esta pantalla, a diferencia del
 * resto del catálogo, sí muestra también lo desactivado: sin eso no
 * habría forma de ver qué se dio de baja y por qué.
 */
export default function CatalogoPage() {
  const operator = currentUser();
  const [section, setSection] = useState<SectionKey>("products");
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);

  // Sobreescribe photo_url localmente al subir una foto, para que la
  // tarjeta cambie al instante sin recargar todo el catálogo.
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string>>({});

  const fetchAll = useCallback(async () => {
    const [groups, categories, products, locations, units] = await Promise.all([
      pb.collection("groups").getFullList<Group>({ sort: "name" }),
      pb.collection("categories").getFullList<Category>({ sort: "name" }),
      pb.collection("products").getFullList<ProductRow>({ sort: "name", expand: "category_id" }),
      pb.collection("locations").getFullList<LocationRow>({ sort: "zone" }),
      pb.collection("units").getFullList<Unit>({ sort: "name" }),
    ]);
    return { groups, categories, products, locations, units };
  }, []);

  const { data, error, reload } = useAsyncData(fetchAll);

  const canManage = hasAnyRole(operator?.role, ["admin", "coordinacion"]);

  const groupOptions = useMemo(
    () => (data?.groups ?? []).map((g) => ({ value: g.id, label: g.name })),
    [data]
  );
  const categoryOptions = useMemo(
    () => (data?.categories ?? []).map((c) => ({ value: c.id, label: c.name })),
    [data]
  );
  const unitOptions = useMemo(
    () => (data?.units ?? []).map((u) => ({ value: u.id, label: u.name })),
    [data]
  );

  async function updatePhoto(collection: SectionKey, id: string, url: string) {
    setPhotoOverrides((current) => ({ ...current, [id]: url }));
    try {
      await pb.collection(collection).update(id, { photo_url: url });
    } catch {
      // La tarjeta ya muestra la foto nueva; si el guardado falló, la
      // próxima recarga la revierte sola. No vale la pena bloquear la
      // pantalla por esto — es una foto, no un movimiento de inventario.
    }
  }

  if (!canManage) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es solo para administración y coordinación.
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {error}
      </p>
    );
  }

  if (!data) {
    return <LoadingLine label="Cargando catálogo…" />;
  }

  const q = normalize(search);
  const gridClass = "mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

  return (
    <div>
      <h1 className="text-2xl font-black tracking-tight">Catálogo</h1>
      <p className="mt-1 text-(--muted)">
        Editar y desactivar productos, categorías, grupos y ubicaciones — con
        motivo obligatorio. Nada se borra de verdad: lo que se desactiva deja
        de ofrecerse en formularios nuevos, pero lo que ya existe con eso no
        se toca.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {(Object.keys(SECTION_LABELS) as SectionKey[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setSection(key)}
            className={
              section === key
                ? "rounded bg-unal-green-dark px-3 py-2 text-sm font-bold text-white"
                : "rounded border border-(--rule) px-3 py-2 text-sm font-bold"
            }
          >
            {SECTION_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre…"
          className="min-w-0 flex-1 rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
        />
        <Button icon={Plus} onClick={() => setAdding(true)}>
          {ADD_LABELS[section]}
        </Button>
      </div>

      {section === "groups" ? (
        <div className={gridClass}>
          {data.groups
            .filter((g) => normalize(g.name).includes(q))
            .map((group) => (
              <CatalogCard
                key={group.id}
                name={group.name}
                photoUrl={photoOverrides[group.id] ?? group.photo_url}
                kind="groups"
                canEditPhoto={group.active !== false}
                onPhotoUploaded={(url) => updatePhoto("groups", group.id, url)}
                tag={group.description}
                inactive={group.active === false}
                actions={
                  group.active !== false ? (
                    <>
                      <EditRecordButton
                        collection="groups"
                        id={group.id}
                        onSaved={reload}
                        className="w-full justify-center"
                        fields={[
                          { name: "name", label: "Nombre" },
                          { name: "description", label: "Descripción", type: "textarea" },
                        ]}
                        values={{ name: group.name, description: group.description }}
                      />
                      <DeleteRecordButton
                        collection="groups"
                        id={group.id}
                        itemDescription={group.name}
                        onDeleted={reload}
                        className="w-full justify-center"
                      />
                    </>
                  ) : null
                }
              />
            ))}
        </div>
      ) : null}

      {section === "categories" ? (
        <div className={gridClass}>
          {data.categories
            .filter((c) => normalize(c.name).includes(q))
            .map((category) => (
              <CatalogCard
                key={category.id}
                name={category.name}
                photoUrl={photoOverrides[category.id] ?? category.photo_url}
                kind="categories"
                canEditPhoto={category.active !== false}
                onPhotoUploaded={(url) => updatePhoto("categories", category.id, url)}
                tag={data.groups.find((g) => g.id === category.group_id)?.name ?? "—"}
                inactive={category.active === false}
                actions={
                  category.active !== false ? (
                    <>
                      <EditRecordButton
                        collection="categories"
                        id={category.id}
                        onSaved={reload}
                        className="w-full justify-center"
                        fields={[
                          { name: "name", label: "Nombre" },
                          { name: "group_id", label: "Grupo", type: "select", options: groupOptions },
                          { name: "description", label: "Descripción", type: "textarea" },
                        ]}
                        values={{
                          name: category.name,
                          group_id: category.group_id,
                          description: category.description,
                        }}
                      />
                      <DeleteRecordButton
                        collection="categories"
                        id={category.id}
                        itemDescription={category.name}
                        onDeleted={reload}
                        className="w-full justify-center"
                      />
                    </>
                  ) : null
                }
              />
            ))}
        </div>
      ) : null}

      {section === "products" ? (
        <div className={gridClass}>
          {data.products
            .filter((p) => normalize(p.name).includes(q))
            .map((product) => {
              const fields: EditableField[] = [
                { name: "name", label: "Nombre" },
                { name: "category_id", label: "Categoría", type: "select", options: categoryOptions },
                { name: "default_unit_id", label: "Unidad", type: "select", options: unitOptions },
                { name: "description", label: "Descripción", type: "textarea" },
                { name: "min_stock_alert", label: "Alerta de stock mínimo", type: "number" },
                { name: "requires_batch", label: "Requiere lote", type: "checkbox" },
                { name: "requires_expiry", label: "Requiere vencimiento", type: "checkbox" },
                { name: "requires_quarantine", label: "Requiere revisión al recibir", type: "checkbox" },
                { name: "is_fragile", label: "Frágil", type: "checkbox" },
                { name: "is_hazardous", label: "Peligroso", type: "checkbox" },
              ];
              return (
                <CatalogCard
                  key={product.id}
                  name={product.name}
                  photoUrl={photoOverrides[product.id] ?? product.photo_url}
                  kind="products"
                  canEditPhoto={product.active !== false}
                  onPhotoUploaded={(url) => updatePhoto("products", product.id, url)}
                  tag={product.expand?.category_id?.name ?? "—"}
                  inactive={product.active === false}
                  actions={
                    product.active !== false ? (
                      <>
                        <EditRecordButton
                          collection="products"
                          id={product.id}
                          onSaved={reload}
                          className="w-full justify-center"
                          fields={fields}
                          values={{
                            name: product.name,
                            category_id: product.category_id,
                            default_unit_id: product.default_unit_id,
                            description: product.description,
                            min_stock_alert: product.min_stock_alert ?? 0,
                            requires_batch: Boolean(product.requires_batch),
                            requires_expiry: Boolean(product.requires_expiry),
                            requires_quarantine: Boolean(product.requires_quarantine),
                            is_fragile: Boolean(product.is_fragile),
                            is_hazardous: Boolean(product.is_hazardous),
                          }}
                        />
                        <DeleteRecordButton
                          collection="products"
                          id={product.id}
                          itemDescription={product.name}
                          onDeleted={reload}
                          className="w-full justify-center"
                        />
                      </>
                    ) : null
                  }
                />
              );
            })}
        </div>
      ) : null}

      {section === "locations" ? (
        <div className={gridClass}>
          {data.locations
            .filter((l) => normalize([l.zone, l.shelf, l.position].filter(Boolean).join(" ")).includes(q))
            .map((location) => {
              const label = [location.zone, location.shelf, location.position].filter(Boolean).join("-");
              return (
                <CatalogCard
                  key={location.id}
                  name={label}
                  photoUrl={photoOverrides[location.id] ?? location.photo_url}
                  kind="locations"
                  canEditPhoto={location.active !== false}
                  onPhotoUploaded={(url) => updatePhoto("locations", location.id, url)}
                  tag={location.description}
                  inactive={location.active === false}
                  actions={
                    location.active !== false ? (
                      <>
                        <EditRecordButton
                          collection="locations"
                          id={location.id}
                          onSaved={reload}
                          className="w-full justify-center"
                          fields={[
                            { name: "zone", label: "Zona" },
                            { name: "shelf", label: "Estante" },
                            { name: "position", label: "Posición" },
                            { name: "description", label: "Descripción", type: "textarea" },
                            { name: "capacity_m3", label: "Capacidad (m³)", type: "number" },
                            { name: "is_cold_chain", label: "Cadena de frío", type: "checkbox" },
                          ]}
                          values={{
                            zone: location.zone,
                            shelf: location.shelf ?? "",
                            position: location.position ?? "",
                            description: location.description ?? "",
                            capacity_m3: location.capacity_m3 ?? 0,
                            is_cold_chain: Boolean(location.is_cold_chain),
                          }}
                        />
                        <DeleteRecordButton
                          collection="locations"
                          id={location.id}
                          itemDescription={label}
                          onDeleted={reload}
                          className="w-full justify-center"
                        />
                      </>
                    ) : null
                  }
                />
              );
            })}
        </div>
      ) : null}

      {adding && data && section !== "locations" ? (
        <CatalogAddForm
          kind={section === "groups" ? "group" : section === "categories" ? "category" : "product"}
          catalog={{
            groups: data.groups,
            categories: data.categories,
            products: data.products.map((p) => ({
              ...p,
              requires_batch: Boolean(p.requires_batch),
              requires_expiry: Boolean(p.requires_expiry),
              requires_quarantine: Boolean(p.requires_quarantine),
              active: p.active !== false,
            })),
            units: Object.fromEntries(data.units.map((u) => [u.id, u])),
          }}
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            reload();
          }}
        />
      ) : null}

      {adding && section === "locations" ? (
        <LocationAddForm
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}
