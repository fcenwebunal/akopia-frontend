"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";

/*
 * Panel de accesibilidad de la plantilla, sin tocar su diseño ni su
 * mecánica (accesibilidad.js sigue intacto: tamaño de letra, contraste,
 * invertir colores, restablecer — las cuatro afectan toda la página a
 * propósito, no solo el cabezote, por eso esas reglas de `body`/`html`
 * quedaron sin scopear en scripts/scope-unal-template-css.mjs).
 *
 * Se agrega una quinta columna, "Tema", con el mismo estilo `.boton-panel`
 * de la plantilla, reutilizando applyTheme()/getStoredTheme() ya
 * existentes — es la pieza que Juan Manuel pidió mover aquí desde el
 * header propio de la app.
 */
const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "system", label: "Sistema" },
  { value: "dark", label: "Oscuro" },
];

export function AccessibilityPanel() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  function chooseTheme(value: Theme) {
    applyTheme(value);
    setTheme(value);
  }

  function reset() {
    window.defaultConfig?.();
    applyTheme("system");
    setTheme("system");
  }

  return (
    <div className="tx-unal-accesibilidad">
      <div
        id="panel-accesibilidad"
        style={{ display: "none" }}
        className="panel-content container-fluid"
      >
        <div className="row">
          <div className="col-md-12">
            <div className="row">
              <div className="col-md-3">
                <h4>Tamaño letra</h4>
                <button
                  className="boton-panel"
                  id="letra-disminuir"
                  type="button"
                  onClick={() => window.cambiarTamanioLetra?.("-")}
                >
                  A<sup>-</sup>
                </button>
                <button
                  className="boton-panel"
                  id="letra-aumentar"
                  type="button"
                  onClick={() => window.cambiarTamanioLetra?.("+")}
                >
                  A<sup>+</sup>
                </button>
                <input
                  disabled
                  className="letras-porcentaje"
                  id="letter-percent"
                  type="text"
                  defaultValue="100%"
                />
              </div>

              <div className="col-md-3">
                <h4>Cambiar Contrastes</h4>
                <button
                  className="boton-panel"
                  id="contraste-1"
                  type="button"
                  onClick={() => window.cambiarContrastes?.(1)}
                >
                  1
                </button>
                <button
                  className="boton-panel"
                  id="contraste-2"
                  type="button"
                  onClick={() => window.cambiarContrastes?.(2)}
                >
                  2
                </button>
                <button
                  className="boton-panel"
                  id="contrate-3"
                  type="button"
                  onClick={() => window.cambiarContrastes?.(3)}
                >
                  3
                </button>
              </div>

              <div className="col-md-3">
                <h4>Invertir colores</h4>
                <button
                  className="boton-panel"
                  id="inversor"
                  type="button"
                  onClick={() => window.invertirColores?.()}
                >
                  Aplicar
                </button>
              </div>

              <div className="col-md-3">
                <h4>Tema</h4>
                {THEME_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className="boton-panel"
                    aria-pressed={theme === option.value}
                    style={
                      theme === option.value
                        ? { backgroundColor: "#0763c8" }
                        : undefined
                    }
                    onClick={() => chooseTheme(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="col-md-3">
                <h4>Restablecer ajustes</h4>
                <button className="boton-panel" id="defaul-config" type="button" onClick={reset}>
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/*
        accesibilidad.js registra este clic vía `window.onload`, que en
        Next.js ya disparó para cuando el script carga (afterInteractive
        corre tras la hidratación) — el listener nunca llegaba a
        engancharse. Se invoca la misma función (sin tocar el archivo)
        desde React en su lugar.
      */}
      <div
        id="pestania-accesibilidad"
        role="button"
        tabIndex={0}
        onClick={() => window.accesstab?.()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") window.accesstab?.();
        }}
      >
        Panel de Accesibilidad
      </div>
    </div>
  );
}
