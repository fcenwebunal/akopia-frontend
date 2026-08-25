"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import Image from "next/image";
import { errorMessage, pb } from "@/lib/pb";
import type { Catalog, Category, Group, Product, Unit } from "@/lib/catalog";
import { findDuplicateByName } from "@/lib/catalog";
import { uploadPhoto, UploadError, type PhotoKind } from "@/lib/cloudinary";
import { Spinner } from "@/components/ui/spinner";
import { Toggle } from "@/components/ui/toggle";

type AddKind = "group" | "category" | "product";

const KIND_LABELS: Record<AddKind, string> = {
  group: "grupo",
  category: "categoría",
  product: "producto",
};

const PHOTO_KINDS: Record<AddKind, PhotoKind> = {
  group: "groups",
  category: "categories",
  product: "products",
};

/*
 * Un solo formulario para los tres niveles del catálogo, porque las tres
 * altas comparten la misma forma: un nombre, dentro de un padre fijo por
 * el contexto en que se abrió (el grupo que se estaba explorando, la
 * categoría que se estaba explorando), y algunos campos propios del
 * nivel.
 *
 * Dos capas contra duplicados: se avisa aquí mismo, sin red, si el
 * nombre ya existe entre los hermanos (mismo grupo para categorías,
 * misma categoría para productos) — y si aun así dos administradores
 * chocan al mismo tiempo, el índice único del backend (migraciones
 * 002-004) lo bloquea igual; ese mensaje también se traduce aquí.
 *
 * La foto es obligatoria en los tres niveles — se sube antes de crear,
 * igual que en `LocationAddForm`, y sin ella el botón "Crear" ni se
 * intenta.
 *
 * `groupId`/`categoryId` son el padre fijo cuando se abre desde dentro
 * del explorador jerárquico (`ProductPicker`, ya parado en ese grupo o
 * categoría). Cuando se abre desde `/panel/catalogo` — sin ese
 * contexto — se omiten y el formulario ofrece su propio selector.
 */
export function CatalogAddForm({
  kind,
  catalog,
  groupId,
  categoryId,
  onCancel,
  onCreated,
}: {
  kind: AddKind;
  catalog: Catalog;
  groupId?: string;
  categoryId?: string;
  onCancel: () => void;
  onCreated: (record: Group | Category | Product) => void;
}) {
  const [pickedParentId, setPickedParentId] = useState("");
  const effectiveGroupId = groupId ?? pickedParentId;
  const effectiveCategoryId = categoryId ?? pickedParentId;
  const parentCategory = catalog.categories.find((c) => c.id === effectiveCategoryId);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitId, setUnitId] = useState(
    kind === "product" ? parentCategory?.default_unit_id ?? "" : ""
  );
  const [requiresExpiry, setRequiresExpiry] = useState(false);
  const [requiresBatch, setRequiresBatch] = useState(false);
  const [requiresQuarantine, setRequiresQuarantine] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [minStockAlert, setMinStockAlert] = useState("");
  const [weightKg, setWeightKg] = useState("");

  const [photoUrl, setPhotoUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // "Unidad" va siempre primera (la más usada, por lejos, en el
  // catálogo); las unidades retiradas (active: false) siguen
  // resolviendo su nombre en el resto de la app, pero no se ofrecen
  // para productos nuevos.
  const units = Object.values(catalog.units)
    .filter((unit) => unit.active !== false)
    .sort((a, b) => {
      if (a.code === "UNIDAD") return -1;
      if (b.code === "UNIDAD") return 1;
      return a.name.localeCompare(b.name);
    });

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const url = await uploadPhoto(file, PHOTO_KINDS[kind]);
      setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  function siblings(): { name: string }[] {
    if (kind === "group") return catalog.groups;
    if (kind === "category") {
      return catalog.categories.filter((c) => c.group_id === effectiveGroupId);
    }
    return catalog.products.filter((p) => p.category_id === effectiveCategoryId);
  }

  async function save() {
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("El nombre debe tener al menos 2 letras.");
      return;
    }

    if (kind === "category" && !effectiveGroupId) {
      setError("Elige el grupo al que pertenece.");
      return;
    }
    if (kind === "product" && !effectiveCategoryId) {
      setError("Elige la categoría a la que pertenece.");
      return;
    }

    const duplicate = findDuplicateByName(siblings(), trimmed);
    if (duplicate) {
      setError(`Ya existe ${kindArticle(kind)} ${KIND_LABELS[kind]} con ese nombre aquí.`);
      return;
    }

    if (kind === "product" && !unitId) {
      setError("Elige la unidad en la que se mide este producto.");
      return;
    }

    if (!photoUrl) {
      setError("Sube una foto antes de crear.");
      return;
    }

    setSaving(true);

    try {
      let record: Group | Category | Product;

      if (kind === "group") {
        record = await pb.collection("groups").create<Group>({
          name: trimmed,
          description,
          photo_url: photoUrl,
          active: true,
        });
      } else if (kind === "category") {
        record = await pb.collection("categories").create<Category>({
          name: trimmed,
          group_id: effectiveGroupId,
          description,
          default_unit_id: unitId || null,
          photo_url: photoUrl,
          active: true,
        });
      } else {
        record = await pb.collection("products").create<Product>({
          name: trimmed,
          category_id: effectiveCategoryId,
          default_unit_id: unitId,
          description,
          weight_kg: weightKg ? Number(weightKg) : null,
          min_stock_alert: minStockAlert ? Number(minStockAlert) : null,
          requires_expiry: requiresExpiry,
          requires_batch: requiresBatch,
          requires_quarantine: requiresQuarantine,
          photo_url: photoUrl,
          active: true,
        });
      }

      onCreated(record);
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, { code?: string }> } })
        ?.response?.data;
      if (data?.name?.code === "validation_not_unique") {
        setError(`Ya existe ${kindArticle(kind)} ${KIND_LABELS[kind]} con ese nombre aquí.`);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end bg-black/40 sm:items-center sm:justify-center">
      <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-lg bg-(--surface) p-5 sm:max-w-sm sm:rounded-lg">
        <h2 className="text-lg font-bold">Nuevo{kind === "category" ? "a" : ""} {KIND_LABELS[kind]}</h2>
        {kind === "category" && groupId ? (
          <p className="text-sm text-(--muted)">
            En {catalog.groups.find((g) => g.id === groupId)?.name}
          </p>
        ) : null}
        {kind === "product" && categoryId ? (
          <p className="text-sm text-(--muted)">En {parentCategory?.name}</p>
        ) : null}

        {kind === "category" && !groupId ? (
          <div className="mt-4">
            <label htmlFor="ca-grupo" className="mb-1 block text-sm font-bold">
              Grupo
            </label>
            <select
              id="ca-grupo"
              value={pickedParentId}
              onChange={(event) => setPickedParentId(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              <option value="">Selecciona…</option>
              {catalog.groups
                .filter((g) => g.active !== false)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        {kind === "product" && !categoryId ? (
          <div className="mt-4">
            <label htmlFor="ca-categoria" className="mb-1 block text-sm font-bold">
              Categoría
            </label>
            <select
              id="ca-categoria"
              value={pickedParentId}
              onChange={(event) => {
                const newCategoryId = event.target.value;
                setPickedParentId(newCategoryId);
                if (!unitId) {
                  const category = catalog.categories.find((c) => c.id === newCategoryId);
                  if (category?.default_unit_id) setUnitId(category.default_unit_id);
                }
              }}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              <option value="">Selecciona…</option>
              {catalog.categories
                .filter((c) => c.active !== false)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {catalog.groups.find((g) => g.id === c.group_id)?.name ?? "?"}
                  </option>
                ))}
            </select>
          </div>
        ) : null}

        <div className="mt-4">
          <label htmlFor="ca-nombre" className="mb-1 block text-sm font-bold">
            Nombre
          </label>
          <input
            id="ca-nombre"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
        </div>

        <div className="mt-4">
          <span className="mb-1 block text-sm font-bold">
            Foto <span className="text-unal-red">*</span>
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-(--rule) bg-(--surface-2) text-(--muted) hover:border-unal-green-dark disabled:opacity-60"
          >
            {photoUrl ? (
              <Image src={photoUrl} alt="" width={96} height={96} className="h-full w-full object-cover" />
            ) : uploading ? (
              <Spinner />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs font-bold">
                <Camera size={18} aria-hidden="true" />
                Foto
              </span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {kind === "product" ? (
          <div className="mt-4">
            <label htmlFor="ca-unidad" className="mb-1 block text-sm font-bold">
              Se mide en
            </label>
            <select
              id="ca-unidad"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              <option value="">Selecciona…</option>
              {units.map((unit: Unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            {parentCategory?.default_unit_id ? (
              <p className="mt-1 text-xs text-(--muted)">
                Sugerida porque es la que usa el resto de {parentCategory.name}.
              </p>
            ) : null}
          </div>
        ) : null}

        {kind === "category" ? (
          <div className="mt-4">
            <label htmlFor="ca-unidad-cat" className="mb-1 block text-sm font-bold">
              Unidad habitual <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <select
              id="ca-unidad-cat"
              value={unitId}
              onChange={(event) => setUnitId(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            >
              <option value="">Sin definir</option>
              {units.map((unit: Unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-(--muted)">
              Se sugiere sola al crear un producto en esta categoría.
            </p>
          </div>
        ) : null}

        {kind === "product" ? (
          <fieldset className="mt-4">
            <legend className="mb-1 text-sm font-bold">Al recibirlo, pedir…</legend>
            <div className="space-y-2">
              <Toggle
                label="Fecha de vencimiento"
                checked={requiresExpiry}
                onChange={setRequiresExpiry}
              />
              <Toggle
                label="Código de lote"
                checked={requiresBatch}
                onChange={setRequiresBatch}
              />
              <Toggle
                label="Requiere revisión al recibir"
                checked={requiresQuarantine}
                onChange={setRequiresQuarantine}
              />
            </div>
          </fieldset>
        ) : null}

        {kind !== "group" ? (
          <button
            type="button"
            onClick={() => setShowMore((v) => !v)}
            className="mt-4 text-sm font-bold text-unal-green-dark"
          >
            {showMore ? "Menos detalles" : "Más detalles (opcional)"}
          </button>
        ) : null}

        {kind === "group" || showMore ? (
          <div className="mt-3 space-y-3">
            <div>
              <label htmlFor="ca-desc" className="mb-1 block text-sm font-bold">
                Descripción <span className="font-normal text-(--muted)">(opcional)</span>
              </label>
              <input
                id="ca-desc"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              />
            </div>

            {kind === "product" ? (
              <>
                <div>
                  <label htmlFor="ca-peso" className="mb-1 block text-sm font-bold">
                    Peso, en kg, de una unidad de medida{" "}
                    <span className="font-normal text-(--muted)">(opcional)</span>
                  </label>
                  <input
                    id="ca-peso"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    value={weightKg}
                    onChange={(event) => setWeightKg(event.target.value)}
                    className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                  />
                  <p className="mt-1 text-xs text-(--muted)">
                    Para que este producto cuente en los gráficos de kilos en inventario del panel.
                  </p>
                </div>

                <div>
                  <label htmlFor="ca-minimo" className="mb-1 block text-sm font-bold">
                    Alertar si el disponible baja de{" "}
                    <span className="font-normal text-(--muted)">(opcional)</span>
                  </label>
                  <input
                    id="ca-minimo"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={minStockAlert}
                    onChange={(event) => setMinStockAlert(event.target.value)}
                    className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                  />
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface-2) px-4 py-3 text-sm">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-(--rule) px-4 py-3 font-bold"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving || uploading}
            onClick={save}
            className="flex flex-1 items-center justify-center gap-2 rounded bg-unal-green-dark px-4 py-3 font-bold text-white disabled:opacity-50"
          >
            {saving ? <Spinner /> : null}
            {saving ? "Creando…" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

function kindArticle(kind: AddKind): string {
  return kind === "category" ? "una" : "un";
}

