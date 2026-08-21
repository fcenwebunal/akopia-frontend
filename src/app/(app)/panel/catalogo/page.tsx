"use client";

import { useCallback, useMemo, useState } from "react";
import { currentUser, pb } from "@/lib/pb";
import { hasAnyRole } from "@/lib/roles";
import { normalize } from "@/lib/catalog";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";
import { EditRecordButton, DeleteRecordButton, type EditableField } from "@/components/app/record-actions";

interface Group {
  id: string;
  name: string;
  description: string;
  active?: boolean;
}
interface Category {
  id: string;
  name: string;
  description: string;
  group_id: string;
  default_unit_id?: string;
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
  active?: boolean;
}
interface Unit {
  id: string;
  code: string;
  name: string;
  active?: boolean;
}

type SectionKey = "groups" | "categories" | "products" | "locations";

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
        {(
          [
            ["groups", "Grupos"],
            ["categories", "Categorías"],
            ["products", "Productos"],
            ["locations", "Ubicaciones"],
          ] as [SectionKey, string][]
        ).map(([key, label]) => (
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
            {label}
          </button>
        ))}
      </div>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por nombre…"
        className="mt-3 w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
      />

      {section === "groups" ? (
        <ul className="mt-4 divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
          {data.groups
            .filter((g) => normalize(g.name).includes(q))
            .map((group) => (
              <li key={group.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {group.name}
                    {group.active === false ? (
                      <span className="ml-2 rounded bg-(--surface-2) px-2 py-0.5 text-xs font-bold text-(--muted)">
                        Desactivado
                      </span>
                    ) : null}
                  </p>
                  {group.description ? (
                    <p className="text-sm text-(--muted)">{group.description}</p>
                  ) : null}
                </div>
                {group.active !== false ? (
                  <>
                    <EditRecordButton
                      collection="groups"
                      id={group.id}
                      onSaved={reload}
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
                    />
                  </>
                ) : null}
              </li>
            ))}
        </ul>
      ) : null}

      {section === "categories" ? (
        <ul className="mt-4 divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
          {data.categories
            .filter((c) => normalize(c.name).includes(q))
            .map((category) => (
              <li key={category.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {category.name}
                    {category.active === false ? (
                      <span className="ml-2 rounded bg-(--surface-2) px-2 py-0.5 text-xs font-bold text-(--muted)">
                        Desactivada
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-(--muted)">
                    {data.groups.find((g) => g.id === category.group_id)?.name ?? "—"}
                  </p>
                </div>
                {category.active !== false ? (
                  <>
                    <EditRecordButton
                      collection="categories"
                      id={category.id}
                      onSaved={reload}
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
                    />
                  </>
                ) : null}
              </li>
            ))}
        </ul>
      ) : null}

      {section === "products" ? (
        <ul className="mt-4 divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
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
                <li key={product.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {product.name}
                      {product.active === false ? (
                        <span className="ml-2 rounded bg-(--surface-2) px-2 py-0.5 text-xs font-bold text-(--muted)">
                          Desactivado
                        </span>
                      ) : null}
                    </p>
                    <p className="text-sm text-(--muted)">
                      {product.expand?.category_id?.name ?? "—"}
                    </p>
                  </div>
                  {product.active !== false ? (
                    <>
                      <EditRecordButton
                        collection="products"
                        id={product.id}
                        onSaved={reload}
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
                      />
                    </>
                  ) : null}
                </li>
              );
            })}
        </ul>
      ) : null}

      {section === "locations" ? (
        <ul className="mt-4 divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
          {data.locations
            .filter((l) => normalize([l.zone, l.shelf, l.position].filter(Boolean).join(" ")).includes(q))
            .map((location) => (
              <li key={location.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {[location.zone, location.shelf, location.position].filter(Boolean).join("-")}
                    {location.active === false ? (
                      <span className="ml-2 rounded bg-(--surface-2) px-2 py-0.5 text-xs font-bold text-(--muted)">
                        Desactivada
                      </span>
                    ) : null}
                  </p>
                  {location.description ? (
                    <p className="text-sm text-(--muted)">{location.description}</p>
                  ) : null}
                </div>
                {location.active !== false ? (
                  <>
                    <EditRecordButton
                      collection="locations"
                      id={location.id}
                      onSaved={reload}
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
                      itemDescription={[location.zone, location.shelf, location.position]
                        .filter(Boolean)
                        .join("-")}
                      onDeleted={reload}
                    />
                  </>
                ) : null}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
