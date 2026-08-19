import Link from "next/link";
import type { Metadata } from "next";
import { HomeNavButton } from "@/components/unal-template/home-nav-button";

export const metadata: Metadata = {
  title: "Acerca de este sitio web",
  description: "Qué es AKOPIA, quién lo mantiene y con qué se construyó.",
};

export default function AcercaDeEsteSitioPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <HomeNavButton />
      <p className="text-sm font-bold text-unal-green-dark">Ayuda</p>
      <h1 className="mt-1 text-3xl font-black tracking-tight">Acerca de este sitio web</h1>

      <div className="mt-8 space-y-8 text-(--ink-2)">
        <section>
          <h2 className="text-xl font-bold text-(--ink)">Qué es AKOPIA</h2>
          <p className="mt-2">
            AKOPIA es el sistema del centro de acopio de la Facultad de Ciencias Exactas y
            Naturales (FCEN), Universidad Nacional de Colombia, sede Manizales. Recibe
            donaciones, las clasifica, controla cuánto hay disponible en bodega y organiza
            su entrega — con un registro completo de cada movimiento, para que en cualquier
            momento se pueda explicar de dónde salió cada saldo del inventario.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-(--ink)">Por qué existe</h2>
          <p className="mt-2">
            Un centro de acopio llevado en papel o en una hoja de cálculo tiende a fallar en
            tres cosas: no se sabe con certeza qué hay en bodega, no queda registro de quién
            movió qué, y lo que ya se le prometió a alguien puede terminar entregado a otra
            persona. AKOPIA resuelve esto con un principio simple: un saldo de inventario
            nunca se edita a mano — se registra un movimiento, y el saldo es su consecuencia.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-(--ink)">Identidad institucional</h2>
          <p className="mt-2">
            Este sitio usa la plantilla web oficial de la Universidad Nacional de Colombia,
            de acuerdo con la{" "}
            <a
              href="https://identidad.unal.edu.co/guia-web/"
              target="_blank"
              rel="noreferrer"
              className="font-bold text-unal-green-dark underline"
            >
              Guía de Identidad Visual
            </a>{" "}
            de Unimedios — mismo encabezado, pie de página, tipografía (Ancízar) y paleta de
            colores del resto de sitios de la Universidad.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-(--ink)">Con qué se construyó</h2>
          <p className="mt-2">
            El backend corre sobre PocketBase; el frontend, sobre Next.js y Tailwind CSS. El
            código de los dos repositorios (backend y frontend) es público, bajo la
            organización de la Facultad en GitHub.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-(--ink)">Créditos</h2>
          <p className="mt-2">
            Desarrollado para el centro de acopio de la FCEN, sede Manizales, como respuesta
            a la emergencia del 10 de agosto de 2026 en la ciudad.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-bold text-(--ink)">Más información</h2>
          <p className="mt-2">
            Para conocer todas las secciones del sitio, visita el{" "}
            <Link href="/mapa-del-sitio" className="font-bold text-unal-green-dark underline">
              mapa del sitio
            </Link>
            . Para dudas comunes, revisa las{" "}
            <Link href="/faq" className="font-bold text-unal-green-dark underline">
              preguntas frecuentes
            </Link>{" "}
            o el{" "}
            <Link href="/glosario" className="font-bold text-unal-green-dark underline">
              glosario
            </Link>
            . Los datos de contacto del centro de acopio están en el pie de esta página.
          </p>
        </section>
      </div>
    </div>
  );
}
