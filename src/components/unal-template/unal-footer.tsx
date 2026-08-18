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
  { label: "Mapa del sitio", href: "#" },
  { label: "Redes Sociales", href: "https://redessociales.unal.edu.co" },
  { label: "FAQ", href: "#" },
  { label: "Quejas y reclamos", href: "https://quejasyreclamos.unal.edu.co/" },
  { label: "Atención en línea", href: "https://unal.edu.co/atencion-en-linea/" },
  { label: "Encuesta", href: "https://unal.edu.co/encuesta/" },
  { label: "Contáctenos", href: "https://unal.edu.co/contactenos" },
  { label: "Estadísticas", href: "https://estadisticas.unal.edu.co/" },
  { label: "Glosario", href: "#" },
];

function updateDate() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yy = String(now.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
}

/*
 * Pie de página fijo de la plantilla (directriz B3): enlaces de Gobierno
 * en Línea completos, sello de Colombia, logos institucionales y
 * copyright — nada de esto se modifica. Lo único propio de AKOPIA es el
 * párrafo de contacto, con la dirección real del centro de acopio.
 */
export function UnalFooter() {
  return (
    <footer className="clear container-fluid">
      <div className="row">
        <nav className="col-lg-3 col-md-3 col-sm-4 col-6 gobiernoLinea">
          {GOBIERNO_LINEA_1.map((link) => (
            <a key={link.label} href={link.href} target="_top">
              {link.label}
            </a>
          ))}
        </nav>
        <nav className="col-lg-3 col-md-3 col-sm-4 col-6 gobiernoLinea">
          {GOBIERNO_LINEA_2.map((link) => (
            <a key={link.label} href={link.href} target="_top">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="col-lg-4 col-md-4 col-sm-4 col-12 footer-info">
          <div className="row footer-info-spacing">
            <p className="col-lg-6 col-md-12 col-sm-12 col-6 contacto">
              <b>Contacto página web:</b>
              <br />
              Campus La Nubia
              <br />
              Universidad Nacional de Colombia, sede Manizales
              <br />
              Manizales, Caldas, Colombia
            </p>
            <p className="col-lg-6 col-md-12 col-sm-12 col-6 derechos">
              <a href="https://unal.edu.co/archivos/user_upload/docs/legal.pdf" target="_blank" rel="noreferrer">
                &copy; Copyright 2019
              </a>
              <br />
              Algunos derechos reservados.
              <br />
              <a title="Comuníquese con el administrador de este sitio web" href="mailto:correo@unal.edu.co">
                correo@unal.edu.co
              </a>
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
