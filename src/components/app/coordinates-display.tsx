"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { formatCoordinates, googleMapsUrl } from "@/lib/coordinates";

/*
 * Puramente presentacional: recibe `lat`/`lng` y no sabe de dónde
 * salieron (un despacho, más adelante quizás otra cosa) — es lo que
 * necesita el conductor en el momento de salir a repartir, nada más.
 */
export function CoordinatesDisplay({ lat, lng }: { lat: number; lng: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatCoordinates(lat, lng));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin permiso del portapapeles (poco común, pero pasa en algunos
      // navegadores móviles fuera de HTTPS): el enlace de Maps sigue
      // funcionando igual, así que no hace falta bloquear nada.
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="rounded bg-(--surface-2) px-2 py-1 font-mono text-xs text-(--ink-2)">
        {formatCoordinates(lat, lng)}
      </span>
      <button
        type="button"
        onClick={copy}
        className="flex items-center gap-1 rounded border border-(--rule) px-2.5 py-1 text-xs font-bold hover:bg-(--surface-2)"
      >
        {copied ? (
          <>
            <Check size={12} aria-hidden="true" />
            Copiado
          </>
        ) : (
          <>
            <Copy size={12} aria-hidden="true" />
            Copiar
          </>
        )}
      </button>
      <a
        href={googleMapsUrl(lat, lng)}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 rounded border border-(--rule) px-2.5 py-1 text-xs font-bold text-unal-green-dark hover:bg-(--surface-2)"
      >
        <ExternalLink size={12} aria-hidden="true" />
        Abrir en Google Maps
      </a>
    </div>
  );
}
