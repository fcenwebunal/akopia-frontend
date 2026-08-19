import Link from "next/link";
import { UnalShell } from "@/components/unal-template/unal-shell";

/*
 * 404 propia — la de Next.js por defecto es una página en blanco, en
 * inglés, sin cabezote ni pie ni ninguna forma de volver más que el
 * botón "atrás" del navegador. Encontrada en el sondeo de
 * navegabilidad del 19 de agosto. Usa <UnalShell> sin `menuItems`
 * (nadie sabe en qué momento — portada, app, ayuda — estaba el usuario
 * cuando se perdió) y deja que <HomeNavItem>, ya dentro del cabezote,
 * decida solo si el enlace de vuelta debe ir a "/" o a "/panel".
 */
export default function NotFound() {
  return (
    <UnalShell>
      <div className="mx-auto max-w-md px-5 py-20 text-center">
        <p className="text-sm font-bold text-unal-green-dark">Error 404</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          Esta página no existe
        </h1>
        <p className="mt-4 text-(--ink-2)">
          Puede que el enlace esté roto o que la dirección tenga un error.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block rounded bg-unal-green-dark px-6 py-3 font-bold text-white hover:bg-unal-green"
        >
          Ir a la portada
        </Link>
      </div>
    </UnalShell>
  );
}
