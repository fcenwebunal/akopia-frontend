"use client";

import { useRef, useState } from "react";
import { Camera } from "lucide-react";
import Image from "next/image";
import { errorMessage, pb } from "@/lib/pb";
import { uploadPhoto, UploadError } from "@/lib/cloudinary";
import type { Location } from "@/lib/locations";
import { Spinner } from "@/components/ui/spinner";

/*
 * A diferencia de grupo/categoría/producto, la foto se sube ANTES de
 * crear el registro, no después con la cámara de `PhotoTile`: quien
 * crea una ubicación puede ser un operador, pero `locations.updateRule`
 * sigue siendo solo admin (igual que el resto del catálogo), así que un
 * operador no podría volver a esta ubicación más tarde a ponerle foto.
 * La única ventana en la que un operador controla `photo_url` es al
 * crear, y por eso aquí sí va incluida en el mismo `create`.
 */
export function LocationAddForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: (record: Location) => void;
}) {
  const [zone, setZone] = useState("");
  const [shelf, setShelf] = useState("");
  const [position, setPosition] = useState("");
  const [description, setDescription] = useState("");
  const [capacity, setCapacity] = useState("");
  const [coldChain, setColdChain] = useState(false);
  const [photoUrl, setPhotoUrl] = useState("");

  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const url = await uploadPhoto(file, "locations");
      setPhotoUrl(url);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setError(null);

    const trimmedZone = zone.trim();
    if (trimmedZone.length < 1) {
      setError("La zona es obligatoria.");
      return;
    }

    if (!photoUrl) {
      setError("Sube una foto antes de crear.");
      return;
    }

    setSaving(true);

    try {
      const record = await pb.collection("locations").create<Location>({
        zone: trimmedZone,
        shelf: shelf.trim(),
        position: position.trim(),
        description,
        capacity_m3: capacity ? Number(capacity) : 0,
        is_cold_chain: coldChain,
        photo_url: photoUrl,
        active: true,
      });

      onCreated(record);
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, { code?: string }> } })
        ?.response?.data;
      if (data?.zone?.code === "validation_not_unique" || data?.position?.code) {
        setError("Ya existe una ubicación con esa zona, estante y posición.");
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
        <h2 className="text-lg font-bold">Nueva ubicación</h2>

        <div className="mt-4">
          <span className="mb-1 block text-center text-sm font-bold">
            Foto <span className="text-unal-red">*</span>
          </span>
        </div>
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-(--rule) bg-(--surface-2) text-(--muted) hover:border-unal-green-dark disabled:opacity-60"
          >
            {photoUrl ? (
              <Image src={photoUrl} alt="" width={112} height={112} className="h-full w-full object-cover" />
            ) : uploading ? (
              <Spinner />
            ) : (
              <span className="flex flex-col items-center gap-1 text-xs font-bold">
                <Camera size={20} aria-hidden="true" />
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

        <div className="mt-4">
          <label htmlFor="loc-zona" className="mb-1 block text-sm font-bold">
            Zona <span className="text-unal-red">*</span>
          </label>
          <input
            id="loc-zona"
            value={zone}
            onChange={(event) => setZone(event.target.value)}
            placeholder="Bodega A"
            autoFocus
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="loc-estante" className="mb-1 block text-sm font-bold">
              Estante <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="loc-estante"
              value={shelf}
              onChange={(event) => setShelf(event.target.value)}
              placeholder="E1"
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
          <div>
            <label htmlFor="loc-posicion" className="mb-1 block text-sm font-bold">
              Posición <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="loc-posicion"
              value={position}
              onChange={(event) => setPosition(event.target.value)}
              placeholder="P3"
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
        </div>

        <div className="mt-3">
          <label htmlFor="loc-desc" className="mb-1 block text-sm font-bold">
            Descripción <span className="font-normal text-(--muted)">(opcional)</span>
          </label>
          <input
            id="loc-desc"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Junto a la puerta de carga"
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="loc-capacidad" className="mb-1 block text-sm font-bold">
              Capacidad m³ <span className="font-normal text-(--muted)">(opcional)</span>
            </label>
            <input
              id="loc-capacidad"
              type="number"
              inputMode="decimal"
              min={0}
              value={capacity}
              onChange={(event) => setCapacity(event.target.value)}
              className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />
          </div>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={coldChain}
                onChange={(event) => setColdChain(event.target.checked)}
                className="h-4 w-4"
              />
              Cadena de frío
            </label>
          </div>
        </div>

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
