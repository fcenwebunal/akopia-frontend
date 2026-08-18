export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "akopia-theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

// "system" no escribe `data-theme`: globals.css ya resuelve ese caso
// con `@media (prefers-color-scheme: dark)`. Solo "light"/"dark" fuerzan
// el atributo que le gana a la preferencia del sistema.
export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;

  if (theme === "system") {
    document.documentElement.removeAttribute("data-theme");
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }
}

// Se inyecta como <script> antes de hidratar, para que el tema guardado
// se aplique antes del primer pintado — si no, se ve un parpadeo del
// tema por defecto seguido del elegido.
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var t = localStorage.getItem("${STORAGE_KEY}");
    if (t === "light" || t === "dark") {
      document.documentElement.setAttribute("data-theme", t);
    }
  } catch (e) {}
})();
`;
