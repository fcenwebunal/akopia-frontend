"use client";

// Los cuatro niveles y su color son parte del significado, no una
// decisión de tema — se quedan fijos en claro/oscuro (a diferencia de
// --surface/--ink) porque una prioridad "crítica" tiene que leerse roja
// sin importar el tema, igual que un semáforo.
const PRIORITY_LEVELS = [
  { value: "baja", label: "Baja", activeClass: "border-gray-400 bg-gray-400 text-black" },
  { value: "media", label: "Media", activeClass: "border-(--rule) bg-white text-black" },
  { value: "alta", label: "Alta", activeClass: "border-unal-yellow bg-unal-yellow text-black" },
  { value: "critica", label: "Crítica", activeClass: "border-unal-red bg-unal-red text-white" },
] as const;

export function PriorityToggle({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const current = PRIORITY_LEVELS.find((level) => level.value === value) ?? PRIORITY_LEVELS[1];

  return (
    <div>
      <div role="radiogroup" aria-label="Prioridad" className="flex overflow-hidden rounded border border-(--rule)">
        {PRIORITY_LEVELS.map((level, index) => {
          const active = level.value === value;
          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(level.value)}
              className={`flex-1 border-(--rule) py-2 text-sm font-bold transition-colors ${
                index > 0 ? "border-l" : ""
              } ${active ? level.activeClass : "bg-(--surface) text-(--muted) hover:bg-(--surface-2)"}`}
            >
              {level.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-xs text-(--muted)">
        Prioridad: <span className="font-bold text-(--ink)">{current.label}</span>
      </p>
    </div>
  );
}
