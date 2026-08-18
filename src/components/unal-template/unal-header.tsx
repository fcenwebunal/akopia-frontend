import type { AppMenuItem } from "./menu-config";

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
export function UnalHeader({ menuItems = [] }: Readonly<{ menuItems?: AppMenuItem[] }>) {
  return (
    <>
      {/* Panel de servicios */}
      <div id="services">
        <div className="indicator d-none d-md-block"></div>
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

              <div className="collapse btn-group languageMenu d-none d-md-block">
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
          <div className="site-url" id="subdominio">
            <a href={`https://${SITE_URL}/`}>{SITE_URL}</a>
          </div>

          <div className="buscador" id="buscador">
            <div
              className="gcse-searchbox-only"
              data-resultsurl="https://unal.edu.co/resultados-de-la-busqueda/"
              data-newwindow="true"
            ></div>
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
            <div className="buscador" id="container_buscador_mobil"></div>
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
