"use client";

import { Camera, Check, Loader2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { type PhotoKind, uploadPhoto, UploadError } from "@/lib/cloudinary";

// Colores derivados del nombre, no al azar: la misma categoría siempre
// cae en el mismo color, así que la cuadrícula no "parpadea" entre
// recargas mientras no tiene foto.
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
 * Una casilla estilo menú de restaurante: foto (o una inicial de color
 * mientras no la haya) y el nombre debajo. Se usa para grupos,
 * categorías y productos por igual.
 *
 * La propia casilla es el control de selección — no un <button> aparte
 * envolviéndola — porque también aloja el botón de cámara, y un botón
 * dentro de otro botón no es HTML válido: el navegador saca el interior
 * fuera del exterior al parsear, y el clic deja de funcionar donde se
 * espera. `role="button"` + manejo de teclado hacen el mismo papel de
 * accesibilidad sin anidar elementos interactivos.
 *
 * `onUpload` solo se pasa cuando quien mira es admin — es lo que decide
 * si aparece el distintivo de cámara para cambiar la foto.
 */
export function PhotoTile({
  label,
  sublabel,
  photoUrl,
  recordId,
  kind,
  onSelect,
  onUpload,
  disabled,
  selected,
}: {
  label: string;
  sublabel?: string;
  photoUrl?: string;
  recordId: string;
  kind: PhotoKind;
  onSelect?: () => void;
  onUpload?: (recordId: string, url: string) => void;
  disabled?: boolean;
  /** Anillo verde para marcar la casilla elegida — un selector de una
   * sola opción (p. ej. la ubicación destino de un traslado) en vez de
   * la navegación habitual de `onSelect`. */
  selected?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUpload) return;

    setUploading(true);
    setError(null);

    try {
      const url = await uploadPhoto(file, kind);
      onUpload(recordId, url);
    } catch (err) {
      setError(err instanceof UploadError ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect && !disabled ? 0 : undefined}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onSelect}
      onKeyDown={
        onSelect && !disabled
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={`relative text-left ${onSelect && !disabled ? "cursor-pointer" : ""} ${disabled ? "opacity-40" : ""}`}
    >
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-lg border bg-(--surface) ${
          selected ? "border-unal-green-dark ring-2 ring-unal-green-dark" : "border-(--rule)"
        }`}
      >
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt=""
            width={160}
            height={160}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center text-2xl font-black ${colorFor(label)}`}
            aria-hidden="true"
          >
            {label.charAt(0).toUpperCase()}
          </div>
        )}
        {selected ? (
          <span className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-unal-green-dark text-white">
            <Check size={12} strokeWidth={3} aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <p className="mt-1.5 text-sm font-bold leading-tight">{label}</p>
      {sublabel ? (
        <p className="text-xs leading-tight text-(--muted)">{sublabel}</p>
      ) : null}

      {onUpload ? (
        <>
          <button
            type="button"
            disabled={disabled || uploading}
            onClick={(event) => {
              // No debe también disparar onSelect del contenedor.
              event.stopPropagation();
              inputRef.current?.click();
            }}
            aria-label={`Cambiar foto de ${label}`}
            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onClick={(event) => event.stopPropagation()}
            onChange={handleFile}
            className="hidden"
          />
        </>
      ) : null}

      {error ? (
        <p role="alert" className="mt-1 text-xs text-unal-red">
          {error}
        </p>
      ) : null}
    </div>
  );
}
