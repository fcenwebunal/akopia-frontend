"use client";

import { useState } from "react";
import { formatQuantityPrecise } from "@/lib/format";

/*
 * Reemplaza <input type="number"> para pesos y cantidades. En Windows
 * con configuración regional en español, la tecla decimal del teclado
 * numérico escribe coma — un input nativo type="number" en modo
 * período la rechaza en silencio, el valor queda vacío/en 0 y parece
 * que la app "no deja poner decimales". Este campo es type="text":
 * acepta coma o punto y los normaliza al convertir a número, sin
 * depender de la configuración regional del navegador.
 *
 * La resincronización con `value` (p. ej. cuando los botones +/- lo
 * cambian desde afuera) se hace ajustando el estado durante el propio
 * render, no en un useEffect — es el patrón que react.dev documenta
 * para "ajustar estado cuando cambia una prop": evita el
 * renderizado en cascada que un setState dentro de un efecto
 * provoca, y es justo lo que aquí hace falta, porque solo debe
 * disparar cuando `value` cambia por fuera, nunca en cada tecla.
 */
export function DecimalInput({
  id,
  value,
  onChange,
  className,
  placeholder,
}: {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(formatDecimal(value));
  const [lastValue, setLastValue] = useState(value);

  if (value !== lastValue) {
    setLastValue(value);
    if (parseDecimal(text) !== value) {
      setText(formatDecimal(value));
    }
  }

  return (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      onChange={(event) => {
        const raw = event.target.value;
        if (raw !== "" && !/^\d*[.,]?\d*$/.test(raw)) {
          return;
        }
        setText(raw);
        const parsed = parseDecimal(raw);
        if (!Number.isNaN(parsed)) {
          onChange(parsed);
        }
      }}
      className={className}
    />
  );
}

export function parseDecimal(text: string): number {
  return Number(text.replace(",", "."));
}

function formatDecimal(value: number): string {
  return Number.isFinite(value) ? formatQuantityPrecise(value) : "";
}
