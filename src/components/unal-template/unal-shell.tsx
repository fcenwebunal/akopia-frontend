import { AccessibilityPanel } from "./accessibility-panel";
import { AccountBar } from "./account-bar";
import { Breadcrumb } from "./breadcrumb";
import type { AppMenuItem } from "./menu-config";
import { UnalFooter } from "./unal-footer";
import { UnalHeader } from "./unal-header";

/*
 * Único contenedor `.unal-chrome`: varias reglas del CSS escopeado
 * (`.unal-chrome main.detalle`, `.unal-chrome footer`, la miga de pan)
 * exigen que header, contenido y footer compartan el mismo ancestro —
 * no uno por componente. Los tres momentos (portada, login/registro,
 * app) usan este mismo cascarón; lo que cambia es `menuItems` (vacío
 * fuera de la app, por la directriz B3 de no enlazar a "Inicio" en el
 * menú) y `boxed` (la portada es una campaña de ancho completo, las
 * páginas internas sí llevan el margen de `.detalle`).
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
  return (
    <div className="unal-chrome flex min-h-screen flex-col">
      <UnalHeader menuItems={menuItems} />
      <AccessibilityPanel />
      <AccountBar />
      {/*
        La clase `detalle` se mantiene siempre presente: accesibilidad.js
        busca `document.getElementsByClassName("detalle")[0]` al abrir
        el panel y lanza si no la encuentra. Para la portada (boxed
        =false) solo se anula el margen que trae esa clase, por estilo
        en línea — nada le gana en especificidad a la regla escopeada.

        `text-(--ink) font-sans` reafirma los tokens de la app justo en
        la frontera con el contenido: `body{color:...}` de Bootstrap
        quedó sin escopear a propósito (ver scope-unal-template-css.mjs)
        porque el panel de accesibilidad necesita `body` real para el
        zoom/contraste, pero eso significa que ese color fijo (sin
        noción de tema) se hereda hacia dentro del árbol. Sin este
        refuerzo, el modo oscuro deja el texto casi invisible: hereda
        el `#212529` de Bootstrap en vez del token `--ink` de la app.
      */}
      <main
        className="detalle flex-1 font-sans text-(--ink)"
        id="contenido"
        style={boxed ? undefined : { margin: 0 }}
      >
        <Breadcrumb />
        {children}
      </main>
      <UnalFooter />
    </div>
  );
}
