import Image from "next/image";

/*
 * Pie institucional. Los enlaces de Gobierno en Línea son obligatorios
 * en todo sitio del dominio unal.edu.co y apuntan siempre a los
 * portales centrales, nunca a copias locales.
 */

const GOVERNMENT_LINKS = [
  { label: "Régimen Legal", href: "https://legal.unal.edu.co" },
  { label: "Talento humano", href: "https://personal.unal.edu.co" },
  { label: "Contratación", href: "https://portaladquisiciones.unal.edu.co/" },
  { label: "Rendición de cuentas", href: "https://launalcuenta.unal.edu.co/" },
  { label: "Control interno", href: "https://controlinterno.unal.edu.co/" },
  { label: "Calidad", href: "http://siga.unal.edu.co" },
];

const SERVICE_LINKS = [
  { label: "Quejas y reclamos", href: "https://quejasyreclamos.unal.edu.co/" },
  { label: "Atención en línea", href: "https://unal.edu.co/atencion-en-linea/" },
  { label: "Contáctenos", href: "https://unal.edu.co/contactenos" },
  { label: "Redes sociales", href: "https://redessociales.unal.edu.co" },
  { label: "Mapa del sitio", href: "https://unal.edu.co/mapa-del-sitio/" },
];

export function InstitutionalFooter() {
  return (
    <footer className="mt-auto border-t-4 border-unal-green bg-(--surface-2)">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <nav aria-label="Gobierno en línea">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-(--muted)">
            Gobierno en línea
          </h2>
          <ul className="space-y-2 text-sm">
            {GOVERNMENT_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-unal-green-dark hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Servicios">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-(--muted)">
            Servicios
          </h2>
          <ul className="space-y-2 text-sm">
            {SERVICE_LINKS.map((link) => (
              <li key={link.href}>
                <a href={link.href} className="hover:text-unal-green-dark hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="text-sm leading-relaxed text-(--ink-2)">
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-(--muted)">
            Contacto
          </h2>
          <address className="not-italic">
            Universidad Nacional de Colombia
            <br />
            Sede Manizales
            <br />
            Campus La Nubia, Manizales, Caldas
            <br />
            Colombia
          </address>
        </div>

        <div className="text-sm leading-relaxed text-(--ink-2)">
          <Image
            src="/unal/sello-colombia.png"
            alt="Escudo de la República de Colombia"
            width={56}
            height={56}
            className="mb-3 h-14 w-auto"
          />
          <p>
            <a
              href="https://unal.edu.co/archivos/user_upload/docs/legal.pdf"
              className="hover:underline"
            >
              © Copyright
            </a>
            <br />
            Algunos derechos reservados.
          </p>
        </div>
      </div>

      <div className="border-t border-(--rule) px-5 py-4">
        <p className="mx-auto max-w-6xl text-center text-xs text-(--muted)">
          AKOPIA · Facultad de Ciencias Exactas y Naturales · Universidad
          Nacional de Colombia, sede Manizales
        </p>
      </div>
    </footer>
  );
}
