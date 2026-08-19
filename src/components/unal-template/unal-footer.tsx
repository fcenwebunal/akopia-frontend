import Link from "next/link";

const GOBIERNO_LINEA_1 = [
  { label: "Régimen Legal", href: "https://legal.unal.edu.co" },
  { label: "Talento humano", href: "https://personal.unal.edu.co" },
  { label: "Contratación", href: "https://portaladquisiciones.unal.edu.co/" },
  { label: "Ofertas de empleo", href: "https://personal.unal.edu.co" },
  { label: "Rendición de cuentas", href: "https://launalcuenta.unal.edu.co/" },
  { label: "Concurso docente", href: "https://docentes.unal.edu.co/concurso-profesoral/" },
  { label: "Pago Virtual", href: "https://pagovirtual.unal.edu.co/" },
  { label: "Control interno", href: "https://controlinterno.unal.edu.co/" },
  { label: "Calidad", href: "http://siga.unal.edu.co" },
  { label: "Buzón de notificaciones", href: "https://unal.edu.co/buzon-de-notificaciones/" },
];

const GOBIERNO_LINEA_2 = [
  { label: "Correo institucional", href: "https://smartkey.xertica.com/cloudkey/a/unal.edu.co/user/login" },
  { label: "Mapa del sitio", href: "/mapa-del-sitio" },
  { label: "Redes Sociales", href: "https://redessociales.unal.edu.co" },
  { label: "FAQ", href: "/faq" },
  { label: "Quejas y reclamos", href: "https://quejasyreclamos.unal.edu.co/" },
  { label: "Atención en línea", href: "https://unal.edu.co/atencion-en-linea/" },
  { label: "Encuesta", href: "https://unal.edu.co/encuesta/" },
  { label: "Contáctenos", href: "https://unal.edu.co/contactenos" },
  { label: "Estadísticas", href: "https://estadisticas.unal.edu.co/" },
  { label: "Glosario", href: "/glosario" },
];

function isInternal(href: string) {
  return href.startsWith("/");
}

function updateDate() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/*
 * Pie de página fijo de la plantilla (directriz B3): enlaces de Gobierno
 * en Línea, sello de Colombia, logos institucionales y copyright — los
 * términos identificadores no se tocan (la directriz lo prohíbe), solo
 * el contenido: "Mapa del sitio", "FAQ", "Glosario" y "Acerca de este
 * sitio web" ahora enlazan a páginas reales de AKOPIA (antes eran "#"),
 * y el párrafo de contacto/derechos lleva los datos reales del centro
 * de acopio en vez de los genéricos de sede Bogotá que traía la
 * plantilla.
 */
export function UnalFooter() {
  return (
    <footer className="clear container-fluid">
      {/*
        padding-bottom:0 — el CSS de la plantilla trae `padding:15px 0
        25px 0` (y lo repite igual en su propio media query de móvil,
        `body footer{padding:15px 0 25px}`, sin ámbito a propósito por
        empezar con "body"). Esos 25px de aire debajo del último
        contenido dejaban una franja vacía notoria al final de la
        página — pedido explícito de quitarla. El `:not(...)` iguala
        la especificidad de la regla original para ganar por orden de
        aparición, ya que este `<style>` se imprime después de las
        hojas de la plantilla en el documento.
      */}
      <style>{`
        .unal-chrome footer:not(.akopia-content, .akopia-content *) {
          padding-bottom: 0;
        }
      `}</style>
      <div className="row">
        <nav className="col-lg-3 col-md-3 col-sm-4 col-6 gobiernoLinea">
          {GOBIERNO_LINEA_1.map((link) => (
            <a key={link.label} href={link.href} target="_top">
              {link.label}
            </a>
          ))}
        </nav>
        <nav className="col-lg-3 col-md-3 col-sm-4 col-6 gobiernoLinea">
          {GOBIERNO_LINEA_2.map((link) =>
            isInternal(link.href) ? (
              <Link key={link.label} href={link.href}>
                {link.label}
              </Link>
            ) : (
              <a key={link.label} href={link.href} target="_top">
                {link.label}
              </a>
            )
          )}
        </nav>
        <div className="col-lg-4 col-md-4 col-sm-4 col-12 footer-info">
          <div className="row footer-info-spacing">
            <p className="col-lg-6 col-md-12 col-sm-12 col-6 contacto">
              <b>Contacto página web:</b>
              <br />
              Carrera 27 # 64-60
              <br />
              01 8000 916956
              <br />
              Manizales, Caldas - Colombia
              <br />
              (57+6) 8879300 Ext. 50423
            </p>
            <p className="col-lg-6 col-md-12 col-sm-12 col-6 derechos">
              <a href="https://unal.edu.co/archivos/user_upload/docs/legal.pdf" target="_blank" rel="noreferrer">
                &copy; Copyright 2019
              </a>
              <br />
              Algunos derechos reservados.
              <br />
              <a href="https://fcen.unal.edu.co" target="_blank" rel="noreferrer">
                fcen.unal.edu.co
              </a>
              <br />
              <a title="Comuníquese con el administrador de este sitio web" href="mailto:sfcen_man@unal.edu.co">
                sfcen_man@unal.edu.co
              </a>
              <br />
              <Link href="/acerca-de-este-sitio">Acerca de este sitio web</Link>
              <br />
              Actualización: {updateDate()}
            </p>
          </div>
        </div>
        <div className="col-lg-2 col-md-2 col-sm-12 col-12 logos">
          <div className="row px-3">
            <div className="col-lg-6 col-md-12 col-sm-6 col-6 no-padding">
              <div className="row mx-1">
                <a className="col-md-12 col-sm-6 col-6" href="https://orgullo.unal.edu.co">
                  <img
                    className="hidden-print"
                    alt="Orgullo UN"
                    src="/unal-template/images/log_orgullo.png"
                    width={78}
                    height={21}
                  />
                  <img
                    className="d-none d-print-block"
                    alt="Orgullo UN"
                    src="/unal-template/images/log_orgullo_black.png"
                    width={94}
                    height={37}
                  />
                </a>
                <a className="col-md-12 col-sm-6 col-6 imgAgencia" href="https://agenciadenoticias.unal.edu.co">
                  <img
                    className="hidden-print"
                    alt="Agencia de Noticias"
                    src="/unal-template/images/log_agenc.png"
                    width={94}
                    height={25}
                  />
                  <img
                    className="d-none d-print-block"
                    alt="Agencia de Noticias"
                    src="/unal-template/images/log_agenc_black.png"
                    width={94}
                    height={37}
                  />
                </a>
              </div>
            </div>
            <div className="col-lg-6 col-md-12 col-sm-6 col-6 no-padding">
              <div className="row mx-1">
                <a className="col-md-12 col-sm-6 col-6" href="https://www.gov.co/">
                  <img alt="Portal Único del Estado Colombiano" src="/unal-template/images/log_gobiern.png" width={67} height={51} />
                </a>
                <a className="col-md-12 col-sm-6 col-6" href="http://www.contaduria.gov.co/">
                  <img alt="Contaduría General de la República" src="/unal-template/images/log_contra.png" width={67} height={51} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
