import Image from "next/image";
import type { Metadata } from "next";
import { MissingWanted } from "@/components/landing/missing-wanted";
import { fetchPublicMissingProducts } from "@/lib/public-missing-products";

export const metadata: Metadata = {
  title: "Unidos por Manizales · Centro de Acopio",
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

        {/*
          "Unidos por Manizales" pasa a ser el titular grande — es el
          nombre real de la campaña (así la llama la propia noticia de
          la Universidad sobre el sismo del 10 de agosto), no un
          subtítulo. "Centro de Acopio" baja a una línea de contexto
          arriba, junto con "Comunidad académica UNAL" — sigue
          diciendo qué es esta página, solo que ya no es lo primero
          que grita. Pedido explícito del 19 de agosto.
        */}
        <div className="relative z-[2] mx-auto max-w-4xl px-6 pt-20 sm:pt-[120px]">
          <p className="text-center text-xs font-bold uppercase tracking-[0.14em] text-[#3f7a3e]">
            Comunidad académica UNAL · Sede Manizales
          </p>
          <p className="mt-2 text-center font-serif text-lg font-bold italic text-[#1f4d2c] sm:text-xl">
            Centro de Acopio
          </p>
          <h1
            className="mt-2 text-center font-serif font-bold italic leading-[1.08] text-[#1f4d2c]"
            style={{ fontSize: "clamp(2.4rem,6vw,4.2rem)" }}
          >
            Unidos por
            <span
              className="block text-[#8fc93a]"
              style={{
                fontSize: "clamp(3.2rem,9vw,5.6rem)",
                WebkitTextStroke: "1px #1f4d2c",
                textShadow: "2px 2px 0 rgba(31,77,44,.15)",
              }}
            >
              Manizales
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-[600px] text-center text-[1.05rem] font-bold text-[#1f4d2c]">
            Solidaridad que mueve, comunidad que transforma
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
            <a
              href="https://maps.app.goo.gl/MtoRGGaPCNxBgMNMA"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Cómo llegar en Google Maps"
              title="Cómo llegar en Google Maps"
              className="absolute right-4 top-4 z-1 flex items-center rounded-lg bg-white/90 px-2 py-1.5 shadow-sm ring-1 ring-white/40 backdrop-blur-[2px] transition-colors hover:bg-white"
            >
              <svg width="72" height="36" viewBox="0 0 120 60" aria-hidden="true">
                <g fillRule="evenodd">
                  <path d="M6.7 45.533v-28.97a3.05 3.05 0 0 1 3.05-3.05h28.97z" fill="#1ea361" />
                  <path
                    d="M6.7 46.14v-.608l32.02-32.02h.608a3.05 3.05 0 0 1 3.05 3.05v.6l-32.02 32.02H9.76a3.05 3.05 0 0 1-3.05-3.05"
                    fill="#fedb43"
                  />
                  <path d="M10.37 49.192l14.18-14.18 14.18 14.18z" fill="#5384c4" />
                  <path
                    d="M38.73 49.192L24.55 35l3.66-3.66L42.4 45.53v.608c0 1.684-1.367 3.05-3.052 3.05h-.608z"
                    fill="#fff"
                  />
                  <path d="M42.4 45.533L28.2 31.353l14.18-14.18z" fill="#c2c2c1" />
                </g>
                <path
                  d="M13.075 17.456c1.815-.83 4.087-.492 5.56.868l-1.4 1.387c-1.474-1.464-4.245-.77-4.936 1.167-.904 1.905.598 4.4 2.723 4.437 1.4.162 2.778-.77 3.07-2.155-.97.002-1.94-.007-2.9.007l-.018-1.797 4.883.066c.122 1.186.038 2.446-.6 3.487-1 1.863-3.363 2.676-5.362 2.206-2.472-.512-4.322-3.048-3.984-5.56.173-1.772 1.37-3.378 2.982-4.112"
                  fill="#efefef"
                />
                <path
                  d="M36.16 8.488h1.16c2.9.166 5.717 1.578 7.47 3.9 1.148 1.468 1.788 3.3 1.932 5.14v.687c-.067 3.586-2.362 6.53-4.35 9.32-2.23 3.152-4.292 6.587-4.864 10.472-.153.658.03 1.58-.756 1.877-.185-.144-.4-.263-.53-.465-.233-2.172-.776-4.317-1.702-6.3-1.05-2.3-2.515-4.4-4.002-6.443-.905-1.226-1.76-2.494-2.466-3.846-1.1-2.026-1.523-4.42-1.07-6.694.372-1.795 1.3-3.458 2.612-4.744 1.752-1.713 4.12-2.75 6.566-2.903m-.226 6.317c-1.37.306-2.522 1.52-2.638 2.94-.144 1.322.63 2.663 1.814 3.247 1.284.68 2.97.47 4.043-.5 1.002-.886 1.366-2.416.843-3.654-.62-1.55-2.456-2.432-4.063-2.02"
                  fill="#dc4b3e"
                />
                <path
                  d="M35.933 14.805c1.606-.4 3.444.47 4.063 2.02.523 1.238.158 2.768-.843 3.654-1.073.982-2.76 1.2-4.043.5-1.185-.584-1.958-1.925-1.814-3.247.116-1.42 1.267-2.633 2.638-2.94"
                  fill="#802c27"
                />
                <path
                  d="M54.817 47.63V34.766h1.653l4.474 7.834H61l4.487-7.834h1.653V47.63h-1.653v-7.637l.066-2.156h-.066l-4.024 7.054h-.978l-4.025-7.054h-.07l.066 2.156v7.636zm17.142.288c-.935 0-1.716-.264-2.345-.81s-.943-1.25-.943-2.137c0-.958.372-1.7 1.12-2.255s1.66-.818 2.75-.818c.97 0 1.767.18 2.39.54v-.25c0-.647-.222-1.165-.665-1.555s-.99-.583-1.635-.583c-.48 0-.914.113-1.303.34s-.656.54-.8.935l-1.516-.646c.203-.527.604-1.015 1.204-1.464s1.388-.674 2.37-.674c1.125 0 2.06.33 2.802.99s1.12 1.588 1.12 2.785v5.318H74.93v-1.226h-.066c-.66 1.006-1.622 1.516-2.892 1.516zm.27-1.516c.683 0 1.303-.254 1.86-.763s.836-1.11.836-1.805c-.467-.384-1.168-.575-2.1-.575-.803 0-1.408.173-1.815.527s-.61.755-.61 1.222c0 .43.186.773.557 1.024s.796.377 1.276.377zm10.725 1.516c-.67 0-1.272-.144-1.806-.43s-.93-.647-1.195-1.08h-.066l.066 1.222v3.88H78.3V38.827h1.582v1.222h.066c.264-.432.662-.79 1.195-1.078s1.134-.43 1.806-.43c1.138 0 2.12.45 2.947 1.348s1.24 2.01 1.24 3.343-.413 2.443-1.24 3.343-1.81 1.347-2.947 1.347zm-.264-1.516c.766 0 1.424-.3 1.977-.872s.827-1.35.827-2.308-.276-1.727-.827-2.3-1.2-.87-1.977-.87a2.63 2.63 0 0 0-1.985.862c-.545.575-.818 1.348-.818 2.318s.273 1.743.818 2.317a2.62 2.62 0 0 0 1.978.857zm9.146 1.516c-.99 0-1.795-.24-2.435-.725s-1.112-1.078-1.41-1.797l1.474-.61c.462 1.1 1.264 1.653 2.39 1.653.514 0 .936-.114 1.266-.342s.494-.527.494-.9c0-.575-.4-.964-1.204-1.167l-1.78-.43a4.22 4.22 0 0 1-1.599-.818c-.503-.402-.754-.943-.754-1.626 0-.778.344-1.41 1.033-1.896s1.506-.727 2.453-.727c.778 0 1.474.177 2.085.53s1.055.86 1.32 1.518l-1.437.593c-.33-.778-.994-1.167-2.012-1.167-.49 0-.905.102-1.24.305s-.504.48-.504.826c0 .503.396.844 1.167 1.024l1.743.413c.826.198 1.437.527 1.833.99a2.37 2.37 0 0 1 .593 1.582c0 .79-.33 1.45-.97 1.976s-1.48.79-2.497.79zM69.192 20.94h-6.824v2.024h4.84c-.24 2.84-2.602 4.05-4.83 4.05a5.32 5.32 0 0 1-5.342-5.39c0-3.064 2.373-5.425 5.348-5.425 2.294 0 3.648 1.464 3.648 1.464l1.417-1.468s-1.82-2.025-5.138-2.025c-4.225 0-7.494 3.573-7.494 7.418 0 3.774 3.075 7.455 7.602 7.455 3.982 0 6.903-2.728 6.903-6.762 0-.857-.123-1.342-.123-1.342zm5.588-1.466c-2.8 0-4.813 2.19-4.813 4.742 0 2.59 1.946 4.813 4.84 4.813 2.62 0 4.764-2.002 4.764-4.764 0-3.167-2.496-4.797-4.797-4.797zm.028 1.878c1.377 0 2.68 1.113 2.68 2.906 0 1.756-1.3 2.9-2.688 2.9-1.526 0-2.73-1.222-2.73-2.914 0-1.656 1.19-2.892 2.736-2.892zm10.425-1.878c-2.8 0-4.813 2.19-4.813 4.742 0 2.59 1.946 4.813 4.84 4.813 2.62 0 4.764-2.002 4.764-4.764 0-3.167-2.495-4.797-4.797-4.797zm.028 1.878c1.377 0 2.68 1.113 2.68 2.906 0 1.756-1.3 2.9-2.687 2.9-1.526 0-2.73-1.222-2.73-2.914 0-1.656 1.19-2.892 2.736-2.892zm10.224-1.872c-2.57 0-4.59 2.25-4.59 4.777 0 2.878 2.342 4.787 4.545 4.787 1.363 0 2.087-.54 2.622-1.162v.943c0 1.65-1.002 2.637-2.513 2.637-1.46 0-2.193-1.086-2.447-1.702l-1.837.768c.65 1.385 1.965 2.815 4.3 2.815 2.555 0 4.503-1.61 4.503-4.984v-8.59h-2.004v.8c-.616-.664-1.46-1.097-2.57-1.097zm.187 1.874c1.253 0 2.553 1.076 2.553 2.913 0 1.868-1.29 2.897-2.582 2.897-1.37 0-2.637-1.112-2.637-2.88 0-1.835 1.324-2.93 2.673-2.93zm13.308-1.886c-2.424 0-4.46 1.928-4.46 4.775 0 3.01 2.268 4.797 4.692 4.797 2.024 0 3.264-1.106 4.005-2.098l-1.652-1.1c-.43.66-1.146 1.316-2.342 1.316-1.344 0-1.96-.736-2.344-1.448l6.4-2.66-.333-.78c-.62-1.526-2.064-2.802-3.976-2.802zm.084 1.846c.874 0 1.502.464 1.77 1.02l-4.28 1.79c-.185-1.385 1.12-2.8 2.505-2.8zm-7.6 7.442h2.106v-14.09h-2.106z"
                  fill="#63666a"
                />
              </svg>
            </a>
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
            Diligencia el formulario de Google, te toma menos de 2 minutos.
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
