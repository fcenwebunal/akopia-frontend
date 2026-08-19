import Image from "next/image";
import type { Metadata } from "next";
import { MissingWanted } from "@/components/landing/missing-wanted";
import { fetchPublicMissingProducts } from "@/lib/public-missing-products";

export const metadata: Metadata = {
  title: "Centro de Acopio · Unidos por Manizales",
};

const RECEIVING = [
  {
    icon: "/landing/icon_food.svg",
    alt: "Alimentos no perecederos",
    title: "Alimentos y líquidos no perecederos",
    body: "Enlatados, granos, cereales, agua embotellada y bebidas de larga duración.",
    iconClass: "h-[76px]",
  },
  {
    icon: "/landing/icon_bathroom.svg",
    alt: "Aseo personal",
    title: "Aseo personal y primeros auxilios",
    body: "Jabón, gel antibacterial, toallas higiénicas, medicamentos básicos y curaciones.",
    iconClass: "h-[92px]",
  },
  {
    icon: "/landing/icon_petfood.svg",
    alt: "Alimento para mascotas",
    title: "Alimento para mascotas",
    body: "Concentrado y alimento húmedo para perros y gatos afectados también.",
    iconClass: "h-16",
  },
  {
    icon: "/landing/icon_clothes.svg",
    alt: "Abrigo y equipamiento",
    title: "Abrigo y equipamiento",
    body: "Cobijas, abrigos, tapabocas, colchonetas y sábanas — todo nuevo, por favor.",
    iconClass: "h-[76px]",
  },
];

/*
 * Portada pública, diseñada como campaña de emergencia ("Unidos por
 * Manizales") — a propósito con su propia paleta y su propio look,
 * distintos de los tokens utilitarios que usa el resto de la app tras
 * el login. No participa del selector de tema claro/oscuro: es una
 * página de un solo vistazo, pensada para compartirse y leerse igual
 * siempre, no para vivir horas abierta como el panel de operación.
 *
 * Server Component: `getMissingProducts()` corre en el servidor, así
 * que la sección de faltantes llega ya resuelta en el primer render,
 * sin spinner ni parpadeo — y sigue funcionando para quien tenga
 * JavaScript deshabilitado.
 */
export default async function HomePage() {
  const missing = await fetchPublicMissingProducts();

  return (
    <div className="font-sans">
      {/* ---------- HERO ---------- */}
      <section
        className="relative overflow-hidden pb-16 sm:pb-[70px]"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(255,255,255,.4), transparent 55%), linear-gradient(180deg, #eaf6df 0%, #d7ecc4 60%, #fbfaf6 100%)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "repeating-conic-gradient(from 0deg at 50% -20%, rgba(63,122,62,.06) 0deg 6deg, transparent 6deg 12deg)",
          }}
          aria-hidden="true"
        />
        <div className="pointer-events-none absolute left-0 top-0 z-[1] w-screen opacity-[.28]" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/hands.svg" alt="" className="h-auto w-full" />
        </div>

        <div className="relative z-[2] mx-auto max-w-4xl px-6 pt-20 sm:pt-[120px]">
          <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-[#3f7a3e]">
            Comunidad académica UNAL · Sede Manizales
          </p>
          <h1
            className="mt-3 text-center font-serif font-bold italic leading-[1.08] text-[#1f4d2c]"
            style={{ fontSize: "clamp(2.4rem,6vw,4.2rem)" }}
          >
            Centro de
            <span
              className="block text-[#8fc93a]"
              style={{
                fontSize: "clamp(3.2rem,9vw,5.6rem)",
                WebkitTextStroke: "1px #1f4d2c",
                textShadow: "2px 2px 0 rgba(31,77,44,.15)",
              }}
            >
              Acopio
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-[600px] text-center text-[1.05rem] font-bold text-[#1f4d2c]">
            Unidos por Manizales — Solidaridad que mueve, comunidad que transforma
          </p>
          {/*
            La franja sale del borde izquierdo de la pantalla (sin
            esquina redondeada ahí) y solo redondea a la derecha —
            pedido explícito, con el texto quedando exactamente donde
            ya estaba. El contenedor relativo conserva el mismo
            `mx-auto max-w-[780px]` que antes tenía el óvalo completo,
            así que el texto (su único contenido en flujo normal) no
            se mueve ni un píxel. El fondo es un hijo aparte,
            absoluto, anclado por la derecha (`right-0`, mismo borde
            que tenía el óvalo) y estirado muy ancho hacia la
            izquierda — la `<section>` que lo envuelve ya tiene
            `overflow-hidden` para el fondo decorativo de las manos,
            así que ese sobrante se recorta solo en el borde real de
            la pantalla, sin necesidad de calcular el ancho exacto del
            viewport.

            El degradado original iba de un extremo al otro del óvalo
            (780px); estirar el mismo fondo a un ancho mucho mayor sin
            ajustar nada diluiría esa transición hasta verse casi
            plana. Los "stops" en `calc(100% - 780px)` mantienen el
            degradado real confinado a esos mismos 780px del borde
            derecho — todo lo que se extiende más allá hacia la
            izquierda queda solo con el tono sólido de inicio, que ya
            es el mismo color con el que arrancaba el degradado
            original.
          */}
          <div className="relative mx-auto mt-8 max-w-[780px]">
            <div
              aria-hidden="true"
              className="absolute inset-y-0 right-0 w-[200vw] rounded-r-full shadow-[0_10px_24px_rgba(31,77,44,0.25)]"
              style={{
                background:
                  "linear-gradient(to right, #1f4d2c 0%, #1f4d2c calc(100% - 780px), #3f7a3e 100%)",
              }}
            />
            <p className="relative px-7 py-4 text-center font-serif text-[1.05rem] font-bold italic text-white">
              El 10 de agosto, la tierra nos recordó lo frágiles que somos. También nos
              mostró lo fuerte que es una comunidad cuando se une.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- STORY ---------- */}
      <section className="relative overflow-hidden bg-[#fbfaf6] py-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/catedral_manizales.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-1/2 z-[1] w-[min(1100px,92vw)] translate-x-1/2 -translate-y-1/2 opacity-[.14] max-lg:opacity-10"
        />
        <div className="relative z-[2] mx-auto grid max-w-5xl items-center gap-10 px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
          <div>
            <p className="mb-4 text-[1.05rem] leading-relaxed text-[#2b3b2c]">
              El 10 de agosto, muchas familias lo perdieron casi todo. Hoy, unidos,
              podemos ayudarles a empezar de nuevo.
            </p>
            <p className="text-[1.05rem] leading-relaxed text-[#2b3b2c]">
              Como <strong className="text-[#1f4d2c]">comunidad académica UNAL</strong>,
              abrimos un centro de acopio y un punto de recepción de donaciones para
              llegar a quienes más lo necesitan. Cada mano que se suma, cada artículo
              que llega, hace la diferencia.
            </p>
          </div>
          <div className="rounded-[22px] border border-[#3f7a3e]/25 bg-[#eaf6df]/90 p-6 backdrop-blur-[2px]">
            <p className="text-[1.15rem] font-bold leading-snug text-[#1f4d2c]">
              Si eres docente, egresado, estudiante, contratista o administrativo UNAL,
              puedes ser parte de esta iniciativa como voluntario o como donante.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- QUÉ RECIBIMOS ---------- */}
      <section className="relative overflow-hidden bg-[#f4f1fb] py-16 sm:py-[72px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/flowers_1.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 -top-8 w-[190px] opacity-50"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/flowers_2.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-10 -right-8 w-[210px] opacity-50"
        />
        <div className="relative z-[1] mx-auto max-w-5xl px-6">
          <h2 className="text-center font-serif font-bold italic text-[#1f4d2c]" style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)" }}>
            ¿Qué estamos recibiendo?
          </h2>
          <p className="mx-auto mt-2 max-w-[520px] text-center text-[#555]">
            Cada donación cuenta. Estas son las categorías que puedes traer al punto de
            acopio.
          </p>

          <div className="mt-10 grid grid-cols-2 gap-5 lg:grid-cols-4">
            {RECEIVING.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-3.5 rounded-[18px] border border-black/5 bg-white p-6 shadow-[0_8px_24px_rgba(90,70,140,0.08)] transition-transform duration-200 hover:-translate-y-1.5 hover:shadow-[0_16px_30px_rgba(90,70,140,0.14)]"
              >
                <Image
                  src={item.icon}
                  alt={item.alt}
                  width={92}
                  height={92}
                  className={`${item.iconClass} w-auto object-contain object-left`}
                />
                <h3 className="font-sans text-[1.05rem] font-bold text-[#1f4d2c]">
                  {item.title}
                </h3>
                <p className="text-sm text-[#555]">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="relative mt-9 overflow-hidden rounded-2xl bg-[#1f4d2c] py-6 pl-28 pr-6 text-sm text-white sm:pl-[150px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/clotes.svg"
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -left-8 top-1/2 h-[130px] w-auto -translate-y-1/2 opacity-90 sm:-left-12 sm:h-[190px]"
            />
            <p>
              <b className="text-[#8fc93a]">Importante:</b> si deseas donar elementos de
              abrigo y equipamiento como cobijas, abrigos, tapabocas, colchonetas o
              sábanas, asegúrate de que sean nuevos.
            </p>
          </div>
        </div>
      </section>

      {/* ---------- LO QUE HACE FALTA (datos reales) ---------- */}
      <MissingWanted items={missing} />

      {/* ---------- HORARIO / LUGAR ---------- */}
      <section className="relative overflow-hidden bg-[#fbfaf6] py-16 sm:py-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/camion_y_personas.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/2 z-0 w-[min(1600px,140vw)] -translate-x-1/2 opacity-10"
        />
        <div className="relative z-[1] mx-auto grid max-w-5xl gap-6 px-6 md:grid-cols-2">
          <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#3f7a3e] to-[#1f4d2c] p-8 text-white">
            <div className="text-xs font-bold uppercase tracking-[0.12em] opacity-85">
              Horario de recepción
            </div>
            <h3 className="mt-1.5 text-2xl font-bold text-white">Todos los días</h3>
            <div className="font-sans text-2xl font-bold">Lunes a domingo</div>
            <div className="mt-1.5 opacity-90">8:00 a.m. — 5:00 p.m.</div>
            <svg
              className="pointer-events-none absolute -bottom-8 -right-7 h-[190px] w-[190px] opacity-[.16]"
              viewBox="0 0 100 100"
              fill="none"
              stroke="#fff"
              strokeWidth={4}
              strokeLinecap="round"
              aria-hidden="true"
            >
              <circle cx="50" cy="52" r="36" />
              <circle cx="50" cy="52" r="29" strokeWidth={1.5} />
              <path d="M50 32 L50 52 L64 60" />
              <path d="M38 10 L62 10" />
            </svg>
          </div>

          <div className="relative overflow-hidden rounded-[22px] bg-gradient-to-br from-[#6a5aa8] to-[#453a7a] p-8 text-white">
            <div className="text-xs font-bold uppercase tracking-[0.12em] opacity-85">
              Punto de recepción
            </div>
            <h3 className="mt-1.5 text-2xl font-bold text-white">Campus La Nubia</h3>
            <div className="font-sans text-2xl font-bold">Edificio S3B</div>
            <div className="mt-1.5 opacity-90">
              Universidad Nacional de Colombia · Sede Manizales
            </div>
            <svg
              className="pointer-events-none absolute -bottom-8 -right-7 h-[190px] w-[190px] opacity-[.16]"
              viewBox="0 0 100 100"
              fill="none"
              stroke="#fff"
              strokeWidth={4}
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M14 26 L38 16 L62 26 L86 16 L86 78 L62 88 L38 78 L14 88 Z" />
              <path d="M38 16 L38 78" strokeWidth={2.5} />
              <path d="M62 26 L62 88" strokeWidth={2.5} />
              <circle cx="50" cy="44" r="9" />
              <path d="M50 53 L50 66" />
            </svg>
          </div>
        </div>

        <div className="relative z-[2] mx-auto mt-11 flex max-w-[820px] items-end justify-center gap-5 px-6 sm:gap-9">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/packet_1.svg" alt="" className="h-[100px] w-auto sm:h-[150px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/packet_2.svg" alt="" className="h-[120px] w-auto sm:h-[180px]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/landing/packet_3.svg" alt="" className="h-[100px] w-auto sm:h-[150px]" />
        </div>
      </section>

      {/* ---------- VOLUNTARIADO ---------- */}
      <section className="relative overflow-hidden bg-[#eaf6df] py-16 pb-24 text-center sm:py-20 sm:pb-[120px]">
        <div className="relative z-[2] mx-auto max-w-3xl px-6">
          <h2 className="font-serif font-bold italic text-[#1f4d2c]" style={{ fontSize: "clamp(1.9rem,4.5vw,2.8rem)" }}>
            Inscríbete como voluntario
          </h2>
          <p className="mx-auto mt-3 max-w-[560px] text-[1.05rem] text-[#33452f]">
            Tu tiempo también es una donación.{" "}
            <span className="font-bold text-[#1f4d2c]">
              Docentes, egresados, estudiantes, contratistas y administrativos UNAL
            </span>{" "}
            pueden ser parte de esta iniciativa.
          </p>
          <a
            href="https://forms.gle/E5auD4SxJSJRFhiw9"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-full bg-[#d9603a] px-10 py-4 text-lg font-bold text-white shadow-[0_12px_26px_rgba(217,96,58,0.35)] transition-transform hover:-translate-y-1 hover:shadow-[0_16px_32px_rgba(217,96,58,0.45)]"
          >
            Inscribirme como voluntario
          </a>
          <p className="mt-4 text-sm text-[#557a4e]">
            Diligencia el formulario de Google — toma menos de 2 minutos.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/flowers_corner_bottom_left.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 w-[min(420px,38vw)]"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/landing/flowers_corner_bottom_rigth.svg"
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 right-0 w-[min(380px,34vw)]"
        />
      </section>
    </div>
  );
}
