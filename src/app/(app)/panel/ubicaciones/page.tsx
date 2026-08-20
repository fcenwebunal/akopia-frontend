"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { ArrowRight, Ban, PackageSearch, Plus, ShieldAlert } from "lucide-react";
import { currentUser, pb } from "@/lib/pb";
import { hasAnyRole } from "@/lib/roles";
import { loadLocations, locationLabel, type Location } from "@/lib/locations";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine } from "@/components/ui/spinner";
import { PhotoTile } from "@/components/app/photo-tile";
import { LocationAddForm } from "@/components/app/location-add-form";

/*
 * Igual que el explorador de catálogo: crear una ubicación y cambiarle
 * la foto después son de los roles que interactúan con inventario
 * (migración 045 del backend: admin, coordinación, transporte y
 * distribución, voluntariado, salida) — comunicaciones queda fuera,
 * decisión explícita de Juan Manuel. Antes de los roles múltiples esto
 * era "cualquier sesión activa"; ya no.
 */
const INVENTORY_ROLES: Parameters<typeof hasAnyRole>[1] = [
  "admin",
  "coordinacion",
  "transporte_distribucion",
  "voluntariado",
  "salida",
];

export default function UbicacionesPage() {
  const operator = currentUser();
  const canManageLocations = hasAnyRole(operator?.role, INVENTORY_ROLES);

  const [version, setVersion] = useState(0);
  const [adding, setAdding] = useState(false);
  const [photoOverrides, setPhotoOverrides] = useState<Record<string, string>>({});

  const fetchLocations = useCallback(async () => {
    const locations = await loadLocations();
    return { locations, version };
  }, [version]);

  const { data, error } = useAsyncData(fetchLocations);

  async function savePhoto(id: string, url: string) {
    setPhotoOverrides((current) => ({ ...current, [id]: url }));
    try {
      await pb.collection("locations").update(id, { photo_url: url });
    } catch {
      // Igual que en el catálogo: la casilla ya muestra la foto nueva;
      // si el guardado falló, la próxima carga la revierte sola.
    }
  }

  if (error) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {error}
      </p>
    );
  }

  if (!data) {
    return <LoadingLine />;
  }

  return (
    <div>
      <Link href="/panel/inventario" className="text-sm font-bold text-unal-green-dark">
        ← Inventario
      </Link>

      <h1 className="mt-2 text-2xl font-black tracking-tight">Ubicaciones</h1>
      <p className="mt-1 text-(--muted)">
        Dónde vive cada cosa en la bodega — zona, estante y posición.
      </p>

      {/*
        No son ubicaciones reales — son estados de inventario que todavía no
        tienen (o ya no deberían tener) un sitio físico asignado. Van como
        enlaces a las secciones que ya existen en Inventario, no como
        casillas seleccionables: no son destino de ninguna reubicación.
      */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link
          href="/panel/inventario#por-ubicar"
          className="flex items-center gap-3 rounded border-2 border-dashed border-unal-yellow bg-(--surface) p-4 hover:border-unal-orange"
        >
          <PackageSearch size={24} className="shrink-0 text-unal-orange" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-bold">Por Ubicar</p>
            <p className="text-xs text-(--muted)">Aptos para entregar, sin ubicación final todavía</p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-(--muted)" aria-hidden="true" />
        </Link>

        <Link
          href="/panel/inventario#en-revision"
          className="flex items-center gap-3 rounded border-2 border-dashed border-unal-red bg-(--surface) p-4 hover:border-unal-red"
        >
          <ShieldAlert size={24} className="shrink-0 text-unal-red" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-bold">En Revisión</p>
            <p className="text-xs text-(--muted)">Retenidos hasta que se decida si pasan a disponible o se rechazan</p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-(--muted)" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {data.locations.map((location) => (
          <PhotoTile
            key={location.id}
            label={locationLabel(location)}
            sublabel={location.description}
            photoUrl={photoOverrides[location.id] ?? location.photo_url}
            recordId={location.id}
            kind="locations"
            onUpload={canManageLocations ? (id, url) => savePhoto(id, url) : undefined}
          />
        ))}

        {canManageLocations ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex aspect-square flex-col items-center justify-center gap-1 rounded border-2 border-dashed border-(--rule) text-(--muted) hover:border-unal-green-dark hover:text-unal-green-dark"
          >
            <Plus size={22} strokeWidth={2.5} aria-hidden="true" />
            <span className="text-xs font-bold">Agregar</span>
          </button>
        ) : null}
      </div>

      {/*
        Al final a propósito, separada de las ubicaciones reales de
        arriba: no es un sitio donde algo espera una decisión, es el
        registro de lo que ya se decidió descartar. Tampoco es
        seleccionable en ningún selector de destino — rechazar sale del
        inventario, no se reubica hacia aquí.
      */}
      <Link
        href="/panel/inventario#rechazados"
        className="mt-6 flex items-center gap-3 rounded border-2 border-dashed border-(--rule) bg-(--surface) p-4 hover:border-(--ink-2)"
      >
        <Ban size={24} className="shrink-0 text-(--muted)" aria-hidden="true" />
        <div className="flex-1">
          <p className="font-bold">Rechazados</p>
          <p className="text-xs text-(--muted)">Lo que salió del inventario tras la revisión</p>
        </div>
        <ArrowRight size={18} className="shrink-0 text-(--muted)" aria-hidden="true" />
      </Link>

      {adding ? (
        <LocationAddForm
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false);
            setVersion((v) => v + 1);
          }}
        />
      ) : null}
    </div>
  );
}
