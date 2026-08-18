"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Tema claro", Icon: Sun },
  { value: "system", label: "Tema del sistema", Icon: SunMoon },
  { value: "dark", label: "Tema oscuro", Icon: Moon },
];

/*
 * Segmentado de tres, no un solo botón que alterna: "según el sistema"
 * es una opción real (la que ya trae el proyecto por defecto vía
 * `prefers-color-scheme`), no solo un punto de paso entre claro y
 * oscuro. Guarda la elección en localStorage — `applyTheme` en
 * `src/lib/theme.ts` — y el layout raíz la aplica antes de pintar para
 * que no haya parpadeo del tema por defecto.
 */
export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme | null>(null);

  useEffect(() => {
    setThemeState(getStoredTheme());
  }, []);

  function choose(value: Theme) {
    applyTheme(value);
    setThemeState(value);
  }

  // Antes de montar no se sabe qué había en localStorage; no se
  // renderiza nada marcado como activo para no mostrar un estado falso.
  if (theme === null) {
    return <div className="h-8 w-[5.75rem]" aria-hidden="true" />;
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema de color"
      className="flex items-center gap-0.5 rounded border border-(--rule) bg-(--surface-2) p-0.5"
    >
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => choose(value)}
          className={
            theme === value
              ? "flex h-7 w-7 items-center justify-center rounded bg-unal-green-dark text-white"
              : "flex h-7 w-7 items-center justify-center rounded text-(--muted) hover:text-(--ink)"
          }
        >
          <Icon size={15} strokeWidth={2.25} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
