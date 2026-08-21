"use client";

import { useState } from "react";
import type { Unit } from "@/lib/catalog";

// Dos atributos de la unidad de medida, no del producto: el mismo
// producto puede llegar con talla o tamaño de empaque distintos según
// la donación, así que se capturan por cada artículo recibido, igual
// que el vencimiento o el lote — no una vez en el catálogo.

export function isGarmentUnit(unit: Unit | undefined): boolean {
  return unit?.code === "PRENDA";
}

export function isPackagedUnit(unit: Unit | undefined): boolean {
  return unit ? ["PAQUETE", "CAJA", "CUBETA"].includes(unit.code) : false;
}

const FIXED_SIZES = ["Única", "XS", "S", "M", "L", "XL", "XXL"];

export function SizeField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const startsNumeric = value !== "" && !FIXED_SIZES.includes(value);
  const [mode, setMode] = useState<string>(startsNumeric ? "numero" : value);
  const [numberText, setNumberText] = useState(startsNumeric ? value : "");

  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1 block text-sm font-bold">
        Talla
      </label>
      <select
        id={id}
        value={mode}
        onChange={(event) => {
          const next = event.target.value;
          setMode(next);
          onChange(next === "numero" ? numberText : next);
        }}
        className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
      >
        <option value="">Selecciona…</option>
        {FIXED_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
        <option value="numero">Numérica…</option>
      </select>
      {mode === "numero" ? (
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ej. 38, 40…"
          value={numberText}
          onChange={(event) => {
            setNumberText(event.target.value);
            onChange(event.target.value);
          }}
          className="mt-2 w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
        />
      ) : null}
    </div>
  );
}

export function PackageCountField({
  id,
  value,
  onChange,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1 block text-sm font-bold">
        Unidades por paquete
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        value={value}
        onChange={(event) => {
          const parsed = Math.round(Number(event.target.value));
          onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
        }}
        className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
      />
    </div>
  );
}
