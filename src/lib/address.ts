// Nomenclatura urbana colombiana: tipo de vía + número + "# placa" +
// complemento. Se guarda estructurado (backend, migración 043 de
// akopia-backend) y también como texto compuesto en `destination`, que
// es lo que el resto del sistema (listas, mapas, notificaciones) sigue
// leyendo — ningún cambio ahí.

export const STREET_TYPES = [
  { value: "calle", label: "Calle" },
  { value: "carrera", label: "Carrera" },
  { value: "avenida", label: "Avenida" },
  { value: "avenida_calle", label: "Avenida Calle" },
  { value: "avenida_carrera", label: "Avenida Carrera" },
  { value: "diagonal", label: "Diagonal" },
  { value: "transversal", label: "Transversal" },
  { value: "autopista", label: "Autopista" },
  { value: "kilometro", label: "Kilómetro" },
  { value: "otro", label: "Otro" },
] as const;

export type StreetType = (typeof STREET_TYPES)[number]["value"];

const STREET_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  STREET_TYPES.map((t) => [t.value, t.label])
);

export interface StructuredAddress {
  streetType: string;
  streetNumber: string;
  streetPlate: string;
  complement: string;
}

export const EMPTY_STRUCTURED_ADDRESS: StructuredAddress = {
  streetType: "",
  streetNumber: "",
  streetPlate: "",
  complement: "",
};

// El texto que se guarda en `destination` y se manda a geocodificar.
// Sin tipo de vía o sin número no hay suficiente para componer una
// dirección con nomenclatura — se deja solo el complemento (veredas,
// sitios sin nomenclatura formal, donde el complemento ES la dirección).
export function composeAddress(addr: StructuredAddress): string {
  const streetType = addr.streetType.trim();
  const streetNumber = addr.streetNumber.trim();
  const streetPlate = addr.streetPlate.trim();
  const complement = addr.complement.trim();

  if (!streetType || !streetNumber) return complement;

  const label = STREET_TYPE_LABELS[streetType] ?? streetType;
  let text = `${label} ${streetNumber}`;
  if (streetPlate) text += ` # ${streetPlate}`;
  if (complement) text += `, ${complement}`;
  return text;
}

const STREET_TYPE_PATTERNS: [RegExp, StreetType][] = [
  [/^avenida\s*calle\b\.?|^av\.?\s*cl\.?\b/i, "avenida_calle"],
  [/^avenida\s*carrera\b\.?|^av\.?\s*cra\.?\b/i, "avenida_carrera"],
  [/^(carrera|cra|kr)\b\.?/i, "carrera"],
  [/^(calle|cl)\b\.?/i, "calle"],
  [/^(avenida|av)\b\.?/i, "avenida"],
  [/^(diagonal|dg)\b\.?/i, "diagonal"],
  [/^(transversal|tv)\b\.?/i, "transversal"],
  [/^auto(?:pista)?\b\.?/i, "autopista"],
  [/^(kil[oó]metro|km)\b\.?/i, "kilometro"],
];

/*
 * Ningún geocodificador devuelve tipo de vía/número/placa separados para
 * una dirección colombiana — Mapbox entrega un solo texto. Esto es un
 * intento razonable de descomponerlo por expresión regular, no una
 * garantía: siempre queda como valor de partida editable en el
 * formulario, nunca como el dato final sin que alguien lo confirme.
 *
 * Revisa TODOS los segmentos separados por coma, no solo el primero:
 * el `display_name` de Nominatim antepone el nombre del sitio/POI antes
 * de la vía cuando el resultado tiene uno ("Casa, 85-32, Carrera 13,
 * ...") — quedarse solo con el primer segmento perdía la vía entera en
 * ese caso, justo cuando sí traía un número de placa aprovechable.
 */
export function parseAddress(raw: string): Partial<StructuredAddress> {
  const segments = raw
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    for (const [pattern, type] of STREET_TYPE_PATTERNS) {
      const match = pattern.exec(segment);
      if (!match) continue;

      const rest = segment.slice(match[0].length).trim();
      const numberMatch = /^(\d+\w*)\s*(?:#|n[uú]mero|no\.?)?\s*([\d\w]+(?:\s*-\s*[\d\w]+)?)?/i.exec(rest);
      if (!numberMatch) return { streetType: type };

      return {
        streetType: type,
        streetNumber: numberMatch[1] ?? "",
        streetPlate: (numberMatch[2] ?? "").replace(/\s+/g, ""),
      };
    }
  }

  return {};
}

/*
 * Cuando el geocodificador sí trae la vía y el número de casa por
 * separado (`address.road` / `address.house_number` de Nominatim), es
 * más confiable que volver a parsear el `display_name` completo: se usa
 * `house_number` directo como placa (el dato real, no una reconstrucción
 * por regex) y solo se aplica `parseAddress` sobre el nombre de la vía
 * —mucho más corto y predecible que el `display_name` entero— para
 * separar tipo y número.
 */
export function structuredFromParts(
  road: string | undefined,
  houseNumber: string | undefined
): Partial<StructuredAddress> {
  if (!road) return {};
  const parsed = parseAddress(road);
  if (!parsed.streetType) return {};

  return {
    ...parsed,
    streetPlate: houseNumber ? houseNumber.replace(/\s+/g, "") : parsed.streetPlate,
  };
}
