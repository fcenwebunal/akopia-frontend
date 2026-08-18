import Image from "next/image";
import Link from "next/link";

/*
 * Cabecera institucional. El escudo enlaza a unal.edu.co y conserva su
 * área de protección; no se recorta, no se recolorea y no se mezcla con
 * el nombre de la aplicación (directriz B1 de identidad visual).
 */
export function InstitutionalHeader() {
  return (
    <header className="border-b border-(--rule) bg-(--surface)">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4">
        <a
          href="https://unal.edu.co"
          className="shrink-0"
          aria-label="Universidad Nacional de Colombia"
        >
          <Image
            src="/unal/escudo-unal.svg"
            alt="Escudo de la Universidad Nacional de Colombia"
            width={280}
            height={147}
            priority
            className="h-16 w-auto sm:h-20"
          />
        </a>

        <div className="min-w-0 flex-1 self-stretch border-l border-(--rule) py-1 pl-6">
          <Link href="/" className="inline-block">
            <Image
              src="/brand/akopia-logo.svg"
              alt="AKOPIA"
              width={6292}
              height={1844}
              className="h-7 w-auto sm:h-8"
            />
            <span className="block text-xs leading-tight text-(--muted) sm:text-sm">
              Centro de acopio · Sede Manizales
            </span>
          </Link>
        </div>

        <nav className="flex items-center gap-2" aria-label="Acceso">
          <Link
            href="/login"
            className="rounded px-3 py-2 text-sm font-bold text-unal-green-dark hover:bg-unal-green-soft"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="rounded bg-unal-green-dark px-4 py-2 text-sm font-bold text-white hover:bg-unal-green"
          >
            Registrarse
          </Link>
        </nav>
      </div>
    </header>
  );
}
