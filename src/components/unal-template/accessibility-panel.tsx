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

export function AccessibilityPanel({
  overlay = false,
}: Readonly<{
  /*
   * Solo la portada (`boxed=false` en <UnalShell>) la pide: en vez de
   * su propia fila con el fondo de --surface asomando por detrás
   * (blanco en claro, casi invisible; casi negro en oscuro — la
   * "franja negra" que Juan Manuel reportó), la franja de cuenta
   * flota transparente sobre la imagen de portada, como cualquier
   * barra de acciones superpuesta a un hero. /login y /panel no lo
   * piden — ahí no hay imagen de fondo con la que se vea bien
   * superpuesto, y el contenido real (formularios, tarjetas) necesita
   * su propio espacio, no una franja flotando encima.
   */
  overlay?: boolean;
}>) {
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
      className={overlay ? "tx-unal-accesibilidad tx-unal-accesibilidad--overlay" : "tx-unal-accesibilidad"}
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
            /*
              Bug real, no cosmético: el texto "Panel de Accesibilidad"
              sigue ahí (solo color:transparent, no display:none — el
              lector de pantalla lo necesita), pero en una caja de 54px
              de ancho se envuelve en varias líneas. Con overflow
              visible (el valor por defecto), ese texto invisible se
              desbordaba varios px por debajo de la caja — invisible a
              la vista pero seguía interceptando el clic de lo que
              hubiera justo ahí debajo, que resultó ser "Cerrar sesión".
              overflow:hidden lo recorta exactamente a los 54×54 del
              botón, sin afectar el texto que sí necesita el lector de
              pantalla (sigue en el DOM, solo ya no se pinta ni se
              puede clicar fuera de la caja).
            */
            overflow: hidden;
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
        /*
          overlay (solo portada): en vez de ocupar su propia fila —con
          el fondo de --surface asomando por detrás de la transparencia
          de .tx-unal-accesibilidad, la "franja negra" reportada— este
          contenedor pasa a altura 0. Sin clearfix, un contenedor con
          hijos flotados y sin más contenido colapsa a 0 de alto de
          por sí; aquí se declara a propósito, no es un bug. Los hijos
          (la pestaña de accesibilidad, la franja de cuenta, ambos
          float:right) se siguen pintando en el mismo lugar de
          siempre, ya que "overflow" por defecto es visible — pero
          <main> ya no reserva espacio para ellos y arranca justo
          después del cabezote, con la imagen de portada empezando de
          una vez. El resultado visual es la franja flotando encima
          del contenido, sin fondo propio, exactamente lo pedido.

          z-index: 3, atrapado entre dos cosas reales. Tiene que ganarle
          al contenido de la propia portada — sus secciones usan
          z-[1]/z-[2] para las capas decorativas de fondo (ver
          (landing)/page.tsx), así que con 2 (el primer valor que se
          probó) un botón como "Iniciar sesión" quedaba por DEBAJO de
          esas capas y ya no se podía tocar. Pero tampoco puede
          ganarle al z-index:4 que unal-header.tsx le pone a #unalTop
          mientras el menú móvil está abierto — con el 5 que tenía al
          principio, la franja de cuenta le ganaba al menú expandido y
          aparecía encima de él en vez de tapada, con su texto cruzado
          sobre las opciones del menú. 3 es el único número que
          resuelve ambos casos a la vez. Los tres bugs (5, luego 2, ya
          corregidos) se encontraron probando de verdad cada
          combinación con Playwright — sesión activa + menú abierto,
          sesión inactiva + clic en "Iniciar sesión" — no calculando
          los números de antemano.

          Sin position:absolute a propósito: #pestania-accesibilidad
          en móvil ya depende de que su ancestro posicionado más
          cercano sea .unal-chrome (o <body>) para calcular su
          right:54px — si este contenedor pasara a position:absolute,
          se volvería ESE el ancestro, y la pestaña se recalcularía
          contra un top que ya no es el de la página sino el del
          cabezote, perdiendo el ajuste junto al botón de hamburguesa.
        */
        .unal-chrome .tx-unal-accesibilidad--overlay:not(.akopia-content, .akopia-content *) {
          height: 0;
          padding-top: 0;
          padding-bottom: 0;
          overflow: visible;
          z-index: 3;
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
