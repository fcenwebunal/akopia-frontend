"use client";

import { useEffect } from "react";
import { AccessibilityPanel } from "./accessibility-panel";
import type { AppMenuItem } from "./menu-config";
import { UnalFooter } from "./unal-footer";
import { UnalHeader } from "./unal-header";

/*
 * Único contenedor `.unal-chrome`: varias reglas del CSS escopeado
 * (`.unal-chrome main.detalle`, `.unal-chrome footer`) exigen que
 * header, contenido y footer compartan el mismo ancestro — no uno por
 * componente. Los tres momentos (portada, login/registro, app) usan
 * este mismo cascarón; lo que cambia es `menuItems` (vacío fuera de la
 * app, por la directriz B3 de no enlazar a "Inicio" en el menú) y
 * `boxed` (la portada es una campaña de ancho completo, las páginas
 * internas sí llevan el margen de `.detalle`).
 *
 * `{children}` va envuelto en `.akopia-content`: scripts/scope-unal-
 * template-css.mjs le agrega a CADA selector de la plantilla
 * `:not(.akopia-content, .akopia-content *)`, así que ninguna regla de
 * Bootstrap/unal.css puede aplicar ahí dentro sin importar nombre de
 * clase o especificidad — es la frontera real entre "cromo de la
 * plantilla" y "contenido real de la app", nunca se toca el diseño del
 * segundo.
 */
export function UnalShell({
  menuItems = [],
  boxed = true,
  children,
}: Readonly<{
  menuItems?: AppMenuItem[];
  boxed?: boolean;
  children: React.ReactNode;
}>) {
  useEffect(() => {
    const header = document.getElementById("unalTop");
    // "#contenido" (<main>) empieza justo después de todo lo que va
    // antes en el flujo normal — header y la franja siempre visible del
    // panel de accesibilidad (que ya incluye <AccountBar>, flotando a
    // su izquierda) — así que su posición ya contabiliza ambas sin
    // tener que sumar sus alturas a mano.
    const content = document.getElementById("contenido");
    if (!header || !content) return;

    // CSS custom properties escritas directo en el DOM, no un
    // useState: el menú móvil vive dentro de #unalTop, así que abrirlo
    // (Bootstrap le agrega "show" por fuera de React) cambia la altura
    // del header y dispara este observer. Si esto pasara por setState,
    // el re-render resultante reconciliaría <UnalHeader> contra su JSX
    // (que nunca declaró "show") y React borraría esa clase al vuelo —
    // el menú se veía abrir y cerrarse en el mismo clic.
    const update = () => {
      document.documentElement.style.setProperty(
        "--akopia-header-height",
        `${header.getBoundingClientRect().height}px`,
      );
      document.documentElement.style.setProperty(
        "--akopia-content-top",
        `${content.getBoundingClientRect().top}px`,
      );
    };
    update();

    const observer = new ResizeObserver(update);
    observer.observe(header);
    observer.observe(content);
    return () => observer.disconnect();
  }, [menuItems]);

  return (
    // bg-(--surface): el header y el footer ya pintan su propio fondo
    // opaco de punta a punta, así que esto no los toca — pero cualquier
    // hueco transparente entre ellos (la fila de accesibilidad/cuenta,
    // los márgenes laterales de `.detalle`) mostraba, sin esto, lo que
    // hubiera detrás del body en vez del blanco del contenido, dejando
    // franjas grises sueltas de distintos tonos.
    <div className="unal-chrome flex min-h-screen flex-col bg-(--surface)">
      <UnalHeader menuItems={menuItems} />
      <AccessibilityPanel />
      {/*
        La clase `detalle` se mantiene siempre presente: accesibilidad.js
        busca `document.getElementsByClassName("detalle")[0]` al abrir
        el panel y lanza si no la encuentra. Para la portada (boxed
        =false) solo se anula el margen que trae esa clase, por estilo
        en línea — nada le gana en especificidad a la regla escopeada.

        `text-(--ink) font-sans bg-(--surface)` reafirma los tokens de
        la app justo en la frontera con el contenido: `body{color:...;
        background-color:#fff}` de Bootstrap quedó sin escopear a
        propósito (ver scope-unal-template-css.mjs) porque el panel de
        accesibilidad necesita `body` real para el zoom/contraste. El
        color de texto se hereda hacia dentro del árbol si no se
        reafirma; el fondo ni siquiera hereda (no es una propiedad
        heredable) — simplemente se ve *a través* de cualquier hijo que
        no pinte el suyo propio. Sin este refuerzo, el modo oscuro deja
        el contenido con fondo blanco fijo y texto claro: casi ilegible.
      */}
      <main
        className="detalle flex-1 bg-(--surface) font-sans text-(--ink)"
        id="contenido"
        style={boxed ? undefined : { margin: 0 }}
      >
        <div className="akopia-content">{children}</div>
      </main>
      <UnalFooter />
    </div>
  );
}
