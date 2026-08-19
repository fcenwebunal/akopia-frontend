"use client";

import { useEffect, useState } from "react";
import { applyTheme, getStoredTheme, type Theme } from "@/lib/theme";
import { AccountBar } from "./account-bar";

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
 *
 * `top`: `.tx-unal-accesibilidad{top:103px}` en el CSS de la plantilla
 * es un valor fijo, calculado para la altura del cabezote de ejemplo
 * de Unimedios — con el menú propio de AKOPIA la altura real de
 * #unalTop varía por página (vacío en portada/login, hasta 4 grupos +
 * Sedes en la app), así que ese valor fijo dejaba el panel flotando en
 * medio del propio cabezote. <UnalShell> mide la altura real con
 * ResizeObserver y la escribe en `--akopia-header-height` (variable
 * CSS en el DOM, no una prop de React vía useState): si esto disparara
 * un re-render de este componente, React reconciliaría el estilo en
 * línea de `#panel-accesibilidad` (`display:none` en el JSX) contra su
 * estado real manipulado por accesibilidad.js, cerrándolo de golpe
 * cada vez que el header cambia de alto — el mismo bug que tenía el
 * menú móvil.
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
    <div
      className="tx-unal-accesibilidad"
      style={{ top: "var(--akopia-header-height, 103px)" }}
    >
      {/*
        La plantilla posiciona #pestania-accesibilidad en móvil con
        `right:43px` sobre un `::before` desplazado -35px — números
        calculados para el cabezote de ejemplo de Unimedios. En AKOPIA
        el contenedor real (`.tx-unal-accesibilidad`, position:static)
        no es el ancestro posicionado más cercano — es <body> — así que
        ese `right:43px` termina resolviéndose contra un ancho que no
        es el del viewport de forma predecible, y la pestaña quedaba
        lejos del botón de hamburguesa (#btn_hamburguer, 54×54, pegado
        al borde derecho) en vez de junto a él.

        Se reemplaza por un botón cuadrado del mismo tamaño (54×54),
        pegado justo a la izquierda del hamburguesa (`right:54px`), con
        el ícono como fondo propio en vez del truco del `::before`
        desplazado — más simple y ya no depende de ese cálculo frágil.
      */}
      <style>{`
        @media (max-width: 767px) {
          .unal-chrome #pestania-accesibilidad:not(.akopia-content, .akopia-content *) {
            top: 0;
            right: 54px;
            left: auto;
            width: 54px;
            height: 54px;
            /*
              margin-right:40px viene de la regla base (desktop) de la
              plantilla y no está condicionada a ningún ancho — sin
              este reset se sumaba al right:54px de arriba y volvía
              a alejar el botón del hamburguesa.
            */
            margin-right: 0;
            background-color: transparent;
            background-image: url(/unal-template/images/access-icon.png);
            background-repeat: no-repeat;
            background-position: center;
            background-size: 28px 28px;
          }
          .unal-chrome #pestania-accesibilidad:not(.akopia-content, .akopia-content *)::before {
            content: none;
          }
          /*
            padding-top, no margin-top: la franja mide exactamente lo
            que mide <AccountBar> (35px por su propio style inline) —
            sin esto, "Cerrar sesión" queda pegado contra el cabezote,
            mientras que a la derecha ya tiene el aire de pr-4 (1rem)
            propio de <AccountBar>. Este padding lo iguala arriba.
            Nada de aire abajo a propósito: el contenido de cada
            pantalla ya trae su propio título pegado a la izquierda,
            sin nada que se sienta apretado contra la franja de cuenta.
          */
          .unal-chrome .tx-unal-accesibilidad:not(.akopia-content, .akopia-content *) {
            padding-top: 1rem;
          }
        }
        @media (min-width: 768px) {
          /*
            Mismo motivo que el padding-top de móvil pero al revés: en
            escritorio la franja de cuenta también mide justo lo que
            mide <AccountBar> (35px), así que el contenido real de la
            pantalla (botones, tarjetas) queda pegado contra ella. Aquí
            sí hace falta aire abajo — no hay un título a la izquierda
            que ya separe visualmente, como pasa en móvil.
          */
          .unal-chrome .tx-unal-accesibilidad:not(.akopia-content, .akopia-content *) {
            padding-bottom: 1.5rem;
          }
        }
      `}</style>
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
      {/*
        <AccountBar> va DESPUÉS de la pestaña en el DOM, no antes: los
        `float` del mismo lado se apilan en orden de aparición — el
        primero llega hasta el borde, el siguiente se acomoda contra
        él. Con la pestaña primero (float:right, de la plantilla) y
        esto también en float:right, queda pegado a su izquierda. Al
        revés (como estaba) cada uno se iba a su extremo del todo,
        dejando un hueco enorme en medio — no era lo pedido: "junto al
        botón", no "en la esquina opuesta de la pantalla".
      */}
      <AccountBar />
    </div>
  );
}
