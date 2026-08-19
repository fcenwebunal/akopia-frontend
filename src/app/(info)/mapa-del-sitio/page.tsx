import Link from "next/link";
import type { Metadata } from "next";
import { HomeNavButton } from "@/components/unal-template/home-nav-button";

export const metadata: Metadata = {
  title: "Mapa del sitio",
  description:
    "Todas las secciones de AKOPIA y cómo se conectan entre sí, del recibo de una donación hasta su entrega.",
};

interface SiteLink {
  label: string;
  href: string;
  description: string;
}

interface SiteSection {
  title: string;
  note?: string;
  links: SiteLink[];
}

const PUBLICO: SiteSection = {
  title: "Público",
  note: "Sin necesidad de iniciar sesión.",
  links: [
    { label: "Portada", href: "/", description: "Presentación del centro de acopio y lo que hace falta ahora mismo." },
    { label: "Iniciar sesión", href: "/login", description: "Acceso para quienes operan la bodega." },
    { label: "Registrarse", href: "/registro", description: "Crear una cuenta — un administrador debe activarla antes de poder entrar." },
  ],
};

const APP: SiteSection = {
  title: "La aplicación",
  note: "Requiere una cuenta activa.",
  links: [
    { label: "Panel", href: "/panel", description: "Resumen del día: qué falta clasificar, cuántas solicitudes esperan, qué se va a despachar." },
  ],
};

const OPERACION: SiteSection = {
  title: "Operación — el ciclo de una donación",
  links: [
    { label: "Donaciones", href: "/panel/donaciones", description: "Todo lo que ha llegado, con su estado de clasificación." },
    { label: "Registrar donación", href: "/panel/donaciones/nueva", description: "Recepción: quién dona, qué llegó y cuánto." },
    { label: "Clasificar una donación", href: "/panel/donaciones", description: "Cada artículo recibido se decide entre disponible o en revisión (abrir cualquier donación de la lista)." },
    { label: "Solicitudes", href: "/panel/solicitudes", description: "Pedidos de ayuda, aprobados, pendientes o rechazados." },
    { label: "Nueva solicitud", href: "/panel/solicitudes/nueva", description: "Registrar qué necesita alguien, aunque hoy no haya existencia suficiente." },
    { label: "Productos faltantes", href: "/panel/solicitudes/faltantes", description: "Lo que la comunidad pide y todavía no se puede cubrir del todo." },
    { label: "Despachos", href: "/panel/despachos", description: "Salidas de bodega ya en camino o entregadas." },
    { label: "Nuevo despacho", href: "/panel/despachos/nueva", description: "Convertir una solicitud aprobada en una salida real." },
  ],
};

const INVENTARIO: SiteSection = {
  title: "Inventario",
  links: [
    { label: "Inventario", href: "/panel/inventario", description: "Saldo disponible, reservado y en revisión de cada producto, por ubicación." },
    { label: "Ubicaciones", href: "/panel/ubicaciones", description: "Los estantes y espacios de la bodega, con foto y descripción." },
  ],
};

const ADMINISTRACION: SiteSection = {
  title: "Administración",
  note: "Solo para administradores.",
  links: [
    { label: "Usuarios", href: "/panel/usuarios", description: "Activar cuentas nuevas y administrar roles." },
    { label: "Historial", href: "/panel/historial", description: "El libro completo de movimientos de inventario — quién, qué, cuándo y por qué." },
    { label: "Respaldos", href: "/panel/respaldos", description: "Copias de seguridad de la base de datos, bajo contraseña." },
  ],
};

const AYUDA: SiteSection = {
  title: "Ayuda",
  links: [
    { label: "Mapa del sitio", href: "/mapa-del-sitio", description: "Esta página." },
    { label: "FAQ", href: "/faq", description: "Preguntas frecuentes de donantes, solicitantes y operadores." },
    { label: "Glosario", href: "/glosario", description: "Términos propios del centro de acopio explicados en una línea." },
    { label: "Acerca de este sitio web", href: "/acerca-de-este-sitio", description: "Qué es AKOPIA, quién lo mantiene y con qué se construyó." },
  ],
};

const SECTIONS = [PUBLICO, APP, OPERACION, INVENTARIO, ADMINISTRACION, AYUDA];

const FLOW_STEPS = [
  { title: "Recepción", detail: "Alguien dona. Se registra quién es y qué trajo." },
  { title: "Clasificación", detail: "Cada artículo se revisa: pasa a disponible o queda en revisión." },
  { title: "Inventario", detail: "El saldo disponible sube — pero nunca se edita a mano, siempre es consecuencia de un movimiento registrado." },
  { title: "Solicitud", detail: "Alguien pide ayuda. Queda registrada exista o no el stock para cubrirla." },
  { title: "Reserva", detail: "Al aprobar la solicitud, el producto queda apartado — ya no se le puede ofrecer a alguien más." },
  { title: "Despacho", detail: "Lo reservado sale de la bodega rumbo a su destino." },
  { title: "Entrega", detail: "Se confirma que llegó. El movimiento de salida se cierra." },
];

export default function MapaDelSitioPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <HomeNavButton />
      <p className="text-sm font-bold text-unal-green-dark">Ayuda</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Mapa del sitio</h1>
      <p className="mt-4 text-(--ink-2)">
        AKOPIA es el sistema del centro de acopio de la Facultad de Ciencias Exactas y
        Naturales, sede Manizales: recibe donaciones, las clasifica, las guarda y las
        entrega, con un registro completo de cada movimiento. Esta página resume qué hay
        en cada sección y cómo se conecta todo, para que cualquiera pueda ubicarse rápido.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-bold">Cómo se mueve una donación</h2>
        <p className="mt-2 text-(--ink-2)">
          El recorrido completo, de principio a fin. Cada paso deja su propio rastro: nunca
          se cambia un saldo a mano, siempre es la consecuencia de un movimiento registrado
          — quién, qué, cuánto y cuándo.
        </p>
        <ol className="mt-6 space-y-4">
          {FLOW_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-unal-green-dark font-bold text-white">
                {i + 1}
              </span>
              <div>
                <p className="font-bold">{step.title}</p>
                <p className="text-sm text-(--ink-2)">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-10 border-t border-(--rule) pt-8">
          <h2 className="text-xl font-bold">{section.title}</h2>
          {section.note ? (
            <p className="mt-1 text-sm text-(--muted)">{section.note}</p>
          ) : null}
          <ul className="mt-4 space-y-3">
            {section.links.map((link) => (
              <li key={link.href + link.label}>
                <Link href={link.href} className="font-bold text-unal-green-dark underline">
                  {link.label}
                </Link>
                <p className="text-sm text-(--ink-2)">{link.description}</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
