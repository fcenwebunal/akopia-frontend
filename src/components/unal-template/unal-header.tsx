import type { AppMenuItem } from "./menu-config";

// La clase `cls` (item_Aspirantes, item_Estudiantes, ...) no es
// decorativa: unal.css trae reglas de :hover/.active específicas para
// cada una (color de subrayado propio por perfil).
const PERFILES = [
  { label: "Aspirantes", href: "https://aspirantes.unal.edu.co", cls: "item_Aspirantes" },
  { label: "Estudiantes", href: "https://estudiantes.unal.edu.co", cls: "item_Estudiantes" },
  { label: "Egresados", href: "https://egresados.unal.edu.co", cls: "item_Egresados" },
  { label: "Docentes", href: "https://docentes.unal.edu.co", cls: "item_Docentes" },
  { label: "Administrativos", href: "https://administrativos.unal.edu.co", cls: "item_Administrativos" },
];

const SEDES = [
  { label: "Amazonia", href: "https://amazonia.unal.edu.co" },
  { label: "Bogotá", href: "https://bogota.unal.edu.co" },
  { label: "Caribe", href: "https://caribe.unal.edu.co" },
  { label: "De La Paz", href: "https://delapaz.unal.edu.co" },
  { label: "Manizales", href: "https://manizales.unal.edu.co" },
  { label: "Medellín", href: "https://medellin.unal.edu.co" },
  { label: "Orinoquia", href: "https://orinoquia.unal.edu.co" },
  { label: "Palmira", href: "https://palmira.unal.edu.co" },
  { label: "Tumaco", href: "https://tumaco-pacifico.unal.edu.co" },
];

const SERVICIOS = [
  {
    label: "Correo Electrónico",
    href: "https://smartkey.xertica.com/cloudkey/a/unal.edu.co/user/login",
    icon: "icnServEmail.png",
  },
  {
    label: "DINARA - SIA",
    href: "https://dninfoa.unal.edu.co",
    icon: "icnServSia.png",
  },
  {
    label: "Bibliotecas",
    href: "https://bibliotecas.unal.edu.co",
    icon: "icnServLibrary.png",
  },
  {
    label: "Convocatorias",
    href: "https://personal.unal.edu.co",
    icon: "icnServCall.png",
  },
  {
    label: "Identidad UNAL",
    href: "https://identidad.unal.edu.co",
    icon: "icnServIdentidad.png",
  },
];

// Subdominio propuesto para AKOPIA (directriz B1: sin guiones, sin www).
// El despliegue de hoy vive en otra URL provisional; este es el destino.
const SITE_URL = "acopio.manizales.unal.edu.co";

// A dónde apunta el enlace del subdominio MIENTRAS el subdominio real
// no exista (sin DNS ni TLS todavía) — el despliegue provisional en
// Vercel. Cambiar aquí cuando el subdominio institucional quede listo.
const PROVISIONAL_SITE_URL = "https://akopia.vercel.app/";

function MainMenuGroup({ item }: Readonly<{ item: AppMenuItem }>) {
  if (!item.children) {
    return (
      <div className="btn-group">
        <a href={item.href} className="btn btn-default">
          {item.label}
        </a>
      </div>
    );
  }

  return (
    <div className="btn-group">
      <div className="btn btn-default dropdown-toggle" data-toggle="dropdown">
        {item.label}
        <span className="caret"></span>
      </div>
      <ul className="dropdown-menu">
        {item.children.map((child) => (
          <li key={child.href}>
            <a className="dropdown-item" href={child.href}>
              {child.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/*
 * Cabezote de la plantilla institucional, con las áreas fijas (escudo,
 * sello, buscador, menú de sedes, panel de servicios) intactas y el
 * contenido propio de AKOPIA solo en el menú principal (`menuItems`) y
 * el título del sitio. Sin fila de "Perfiles" (eliminada, decisión del
 * 2026-08-18) y sin botones de sesión (viven en <AccountBar>, en el
 * área de contenido).
 */
export function UnalHeader({
  menuItems = [],
}: Readonly<{ menuItems?: AppMenuItem[] }>) {
  return (
    <>
      {/* Panel de servicios */}
      <div id="services">
        {/*
          `#services .indicator{top:150px}` en el CSS de la plantilla
          es, otra vez, un valor fijo pensado para la altura del
          cabezote de ejemplo — con el menú propio de AKOPIA la
          pestaña terminaba solapada sobre la franja de cuenta
          ("Salir" quedaba tapado). <UnalShell> mide la altura real con
          ResizeObserver y la escribe en `--akopia-content-top` (una
          variable CSS en el DOM, no una prop de React): así el estilo
          en línea de abajo es estático de un render a otro y nunca
          fuerza una reconciliación de este árbol — ver el comentario
          de <UnalShell> sobre por qué eso rompía el menú móvil.
        */}
        <div
          className="indicator d-none d-md-block"
          style={{ top: "var(--akopia-content-top, 150px)" }}
        ></div>
        <ul className="dropdown-menu" id="servicios">
          {SERVICIOS.map((s) => (
            <li key={s.href}>
              <a href={s.href} target="_blank" rel="noreferrer">
                <img
                  src={`/unal-template/images/${s.icon}`}
                  width={32}
                  height={32}
                  alt={s.label}
                />
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/*
        min-height responsivo, no un valor fijo en JS: el escudo es
        position:absolute (135px de alto) y no empuja la altura de
        #unalTop por su cuenta — depende de que el resto de filas
        (firstMenu + bs-navbar) sumen lo mismo, y con el contenido real
        de AKOPIA (menos ítems que el menú de ejemplo de la plantilla)
        no siempre llegan; sin reservar el espacio, el escudo se
        desborda sobre la fila de Accesibilidad/Cuenta.

        Un solo valor fijo para todos los anchos era el primer bug: en
        escritorio el escudo lo necesita, pero en móvil el propio CSS de
        la plantilla ya reduce el escudo a 54px de alto (ver
        `@media(max-width:767px) .logo`) — reservar el valor de
        escritorio igual dejaba hasta ~90px de una franja gris vacía
        debajo del botón de hamburguesa, sin ningún contenido real que
        la llenara.

        El valor de escritorio (100px) es el segundo ajuste: 145px era
        un margen de seguridad calculado a ojo para el escudo (135px),
        pero el contenido real (firstMenu + bs-navbar) mide ~103px, así
        que sobraba una franja gris visible de todos modos. 100px queda
        por debajo de esa altura real — el escudo sí se desborda por
        fuera del borde inferior de #unalTop en la práctica, pero ese
        sobrante es solo el margen transparente del propio archivo de
        imagen, invisible a simple vista. Verificado con Playwright en
        `/panel`, `/panel/donaciones/nueva` y `/panel/inventario`
        (el menú más cargado) sin recorte ni superposición. Ver
        `<style>` más abajo.

        background: #unalTop en sí no trae fondo propio en el CSS de la
        plantilla (cada fila pinta el suyo). Con el min-height, el
        sobrante que no llega a pintar ninguna fila se rellena — pero
        cuánto sobra varía por página: en el panel (4 grupos de menú +
        Sedes) el contenido real casi llena los 100px; en la portada
        (`menuItems` vacío, solo Sedes) el contenido real mide ~69px,
        dejando un sobrante bastante más ancho. Un solo color plano no
        podía quedar bien en los dos casos: contra el fondo real de
        #bs-navbar (`navigationBack.png`, un gris oscuro semitranspa-
        rente) un plano #666 se veía como un tercer tono metido en
        medio — no se notaba en modo claro (el sobrante es casi blanco
        de cualquier forma) pero saltaba a la vista en oscuro, que es
        justo cuando Juan Manuel lo reportó. Se usa la misma imagen que
        ya pinta #bs-navbar en vez de adivinar un color: así el
        sobrante, sea del tamaño que sea, continúa la misma textura de
        la fila de arriba en lugar de cortar en un tono distinto.
      */}
      <style>{`
        .unal-chrome #unalTop {
          background-image: url(/unal-template/images/navigationBack.png);
          background-color: rgb(102, 102, 102);
          min-height: 54px;
        }
        @media (min-width: 768px) {
          .unal-chrome #unalTop { min-height: 100px; }
        }
        /*
          Tailwind trae una utilidad ".collapse{visibility:collapse}"
          (para filas de tabla) con el mismo nombre exacto que la clase
          que exige el plugin de collapse de Bootstrap — no se puede
          renombrar, el JS de la plantilla la busca literal. El menú
          móvil sí abría (la clase "show" y el display quedaban
          correctos) pero Tailwind lo dejaba con visibility:collapse,
          invisible: parecía que "se cerraba solo". Como la utilidad de
          Tailwind vive en @layer utilities y esta regla no está en
          ninguna capa, gana siempre, sin necesitar !important.
        */
        .unal-chrome .collapse:not(.akopia-content, .akopia-content *) {
          visibility: visible;
        }
        /*
          .main_menu{height:54px} en el CSS de la plantilla es fijo, y
          #navbar_content vive dentro de ese contenedor en flujo normal
          — al abrir el menú, su contenido real (puede pasar de 200px)
          se desbordaba por fuera de esa caja de 54px sin que nada de
          lo que viene después en el documento (la franja de cuenta, el
          contenido) se enterara, así que el menú abierto quedaba por
          DEBAJO de esa franja en el orden de apilado (misma altura de
          z-index, pero ella va después en el HTML) — se veía cruzado
          con el texto de la cuenta.

          El comportamiento correcto de un menú desplegable móvil es al
          revés: debe superponerse ÉL sobre el contenido, no empujarlo.
          Se saca del flujo (position:absolute, ancla en #unalTop que
          ya es position:relative) y se le sube el z-index por encima
          de .tx-unal-accesibilidad (que trae 3 desde la plantilla)
          para que la franja de cuenta y el contenido de abajo queden
          tapados por el menú mientras está abierto, en vez de partidos
          a la mitad con él.
        */
        @media (max-width: 767px) {
          .unal-chrome #navbar_content.show:not(.akopia-content, .akopia-content *) {
            position: absolute;
            top: 54px;
            left: 0;
            width: 100%;
            z-index: 10;
            /*
              El fondo original es solo una imagen de textura
              (navigationBack_small.png), no siempre opaca de punta a
              punta — sin un color sólido detrás, la franja de cuenta
              (que sigue en su sitio, solo tapada por z-index) se
              alcanzaba a transparentar por los bordes.
            */
            background-color: #333;
          }
          /*
            .unal-chrome es flex (flex-col): por una regla propia de
            Flexbox, z-index se respeta en los hijos directos de un
            contenedor flex aunque sean position:static — así que
            .tx-unal-accesibilidad (z-index:3, de la plantilla) compite
            de verdad con #unalTop (z-index:3 también) por ser hijos
            directos, y al venir después en el HTML gana el empate. El
            z-index:10 de arriba en #navbar_content nunca alcanza a
            .tx-unal-accesibilidad porque no sale del techo que le pone
            su propio padre #unalTop — hay que subir el de #unalTop.

            ".collapsing" además de ".show": Bootstrap solo agrega
            "show" cuando termina la transición (~350ms) — mientras
            anima agrega "collapsing" y todavía no "show", así que sin
            esto la franja de cuenta volvía a ganar el empate de
            z-index durante toda la animación y se veía tapar el menú
            un instante antes de que este terminara de desplegarse.
          */
          .unal-chrome:has(#navbar_content.show, #navbar_content.collapsing) #unalTop:not(.akopia-content, .akopia-content *) {
            z-index: 4;
          }
        }
      `}</style>
      <header id="unalTop">
        <div className="logo">
          <a href="https://unal.edu.co">
            <svg width="93%" height="93%">
              <image
                xlinkHref="/unal-template/images/escudoUnal.svg"
                width="100%"
                height="100%"
                className="hidden-print"
              />
            </svg>
            <img
              src="/unal-template/images/escudoUnal_black.png"
              className="d-none d-print-block"
              alt="Escudo de la Universidad Nacional de Colombia"
            />
          </a>
        </div>

        <div className="seal">
          <img
            className="hidden-print"
            alt="Escudo de la República de Colombia"
            src="/unal-template/images/sealColombia.png"
            width={66}
            height={66}
          />
          <img
            className="d-none d-print-block"
            alt="Escudo de la República de Colombia"
            src="/unal-template/images/sealColombia_black.png"
            width={66}
            height={66}
          />
        </div>

        <div className="firstMenu d-none d-md-block">
          <div className="content-fluid">
            <nav className="navbar navbar-expand-md nav navbar-dark">
              {/*
                Fila de Perfiles, restaurada (decisión del 2026-08-18
                de quitarla, revertida el 19 de agosto — "fue una mala
                decisión en su momento"). `#navbarSupportedContent` es
                el mismo id que unal.css fuerza a
                `display:inline-block!important` en escritorio; sin él
                la fila no se mostraría aunque el contenido esté ahí.
                `target="_blank"`: igual que Sedes y las redes sociales
                — son subportales externos de la Universidad, no parte
                de AKOPIA, así que abren aparte en vez de sacar al
                usuario de la sesión actual.
              */}
              <div className="collapse navbar-collapse navbar-default" id="navbarSupportedContent">
                <nav id="profiles">
                  <ul className="mr-auto nav justify-content-end">
                    {PERFILES.map((p) => (
                      <li key={p.href} className={`nav-item ${p.cls}`}>
                        <a href={p.href} target="_blank" rel="noreferrer">
                          {p.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              </div>

              <ul className="socialLinks d-none d-md-block">
                <li>
                  <a
                    href="https://www.facebook.com/UNALOficial"
                    target="_blank"
                    rel="noreferrer"
                    className="facebook"
                    title="Página oficial en Facebook"
                  ></a>
                </li>
                <li>
                  <a
                    href="https://twitter.com/UNALOficial"
                    target="_blank"
                    rel="noreferrer"
                    className="twitter"
                    title="Cuenta oficial en Twitter"
                  ></a>
                </li>
                <li>
                  <a
                    href="https://www.youtube.com/channel/UCnE6Zj2llVxcvL5I38B0Ceg"
                    target="_blank"
                    rel="noreferrer"
                    className="youtube"
                    title="Canal oficial de Youtube"
                  ></a>
                </li>
              </ul>

              {/*
                Sin "collapse": Tailwind también trae una utilidad
                llamada exactamente ".collapse" (visibility:collapse,
                para filas de tabla), que colisiona con el ".collapse"
                de Bootstrap. No hace falta aquí — el despliegue del
                idioma ya lo maneja "dropdown-toggle", no "collapse".
              */}
              <div className="btn-group languageMenu d-none d-md-block">
                <div className="btn btn-default dropdown-toggle" data-toggle="dropdown">
                  es<span className="caret"></span>
                </div>
                <ul className="dropdown-menu dropdown-menu-right">
                  <li>
                    <a href="#">EN - English</a>
                  </li>
                  <li>
                    <a href="#">GUC - Wayuunaiki</a>
                  </li>
                  <li>
                    <a href="#">PBB - Nasa yuwe</a>
                  </li>
                </ul>
              </div>
            </nav>
          </div>
        </div>

        <div id="bs-navbar" className="navigation d-none d-md-block">
          {/*
            El subdominio real (§ CLAUDE.md) todavía no existe —
            acopio.manizales.unal.edu.co no tiene DNS ni certificado
            TLS emitido — así que el enlace apunta al despliegue
            provisional en Vercel mientras tanto (pedido explícito del
            19 de agosto: "más adelante lo cambiaremos al
            correspondiente"). Sin target="_blank": es la portada del
            sitio en el que ya se está, misma pestaña como cualquier
            enlace interno. El menú móvil clona este mismo HTML (ver
            unal.js prepare_content_menu), así que el enlace queda
            activo ahí también sin tocar nada más.
          */}
          <div className="site-url" id="subdominio">
            <a href={PROVISIONAL_SITE_URL}>{SITE_URL}</a>
          </div>

          {/*
            Puramente decorativo, a propósito (pedido explícito): antes
            había un widget real de Google Custom Search aquí, pero
            nunca se veía como el de unal.edu.co (su propio CSS externo
            no siempre cargaba a tiempo) y traía de paso su publicidad.
            Se reemplaza por un campo inerte que imita el diseño real
            — el contenedor `.buscador` (tamaño, radio, posición) sigue
            siendo el de la plantilla, sin tocar; solo cambia lo que
            va adentro. `readOnly` en vez de `disabled` para que no se
            vea "apagado": readOnly no permite escribir pero conserva
            la apariencia normal de un campo activo.
          */}
          <div className="buscador" id="buscador">
            <div style={{ position: "relative", width: "100%", height: "100%" }}>
              <input
                type="text"
                placeholder="Buscar en la Universidad"
                readOnly
                aria-hidden="true"
                tabIndex={-1}
                style={{
                  boxSizing: "border-box",
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: 5,
                  padding: "0 10px 0 32px",
                  fontSize: 13,
                  color: "#333",
                  backgroundColor: "#fff",
                }}
              />
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#777"
                strokeWidth={2.5}
                strokeLinecap="round"
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  pointerEvents: "none",
                }}
              >
                <circle cx="10.5" cy="10.5" r="6.5" />
                <line x1="20" y1="20" x2="15.5" y2="15.5" />
              </svg>
            </div>
          </div>

          <div className="navbar-dark mainMenu" id="main_menu_container">
            {menuItems.map((item) => (
              <MainMenuGroup key={item.label} item={item} />
            ))}

            <div className="btn-group menu_sedes">
              <div className="btn btn-default dropdown-toggle" data-toggle="dropdown">
                Sedes<span className="caret"></span>
              </div>
              <ul className="dropdown-menu" id="sedes">
                {SEDES.map((sede) => (
                  <li key={sede.href}>
                    <a className="dropdown-item" href={sede.href} target="_blank" rel="noreferrer">
                      {sede.label}
                    </a>
                    <span className="caret-right"></span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <nav className="navbar navbar-light light-blue lighten-4 main_menu">
          <a className="navbar-brand d-block d-md-none" href="#"></a>

          <button
            className="navbar-toggler collapsed d-block d-md-none"
            type="button"
            data-toggle="collapse"
            data-target="#navbar_content"
            aria-controls="navbar_content"
            aria-expanded="false"
            aria-label="Toggle navigation"
            id="btn_hamburguer"
          ></button>

          <div className="collapse navbar-collapse" id="navbar_content">
            <div className="site-url" id="container_subdominio_mobil"></div>
            {/*
              Sin #container_buscador_mobil: el buscador es decorativo
              (nunca funcionó, ver el comentario en #buscador arriba) y
              en el menú móvil, ya apretado, no aporta — pedido
              explícito de Juan Manuel. unal.js sigue intentando
              clonarlo ahí (`$("#container_buscador_mobil").html(...)`)
              pero un selector jQuery vacío no hace nada, así que basta
              con no tener el contenedor.
            */}
            <div id="container_mainmenu_mobil"></div>

            <div className="btn-group d-block d-md-none hidden-print">
              <div
                className="btn btn-default dropdown-toggle"
                data-toggle="collapse"
                data-target="#container_sedes_mobil"
                aria-controls="container_sedes_mobil"
              >
                Sedes<span className="caret"> </span>
              </div>
            </div>
            <div className="collapse" id="container_sedes_mobil"></div>
          </div>
        </nav>
      </header>
    </>
  );
}
