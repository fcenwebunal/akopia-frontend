"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pb, type AkopiaUser } from "@/lib/pb";

const NAV = [
  { href: "/panel", label: "Panel" },
  { href: "/panel/donaciones", label: "Donaciones" },
  { href: "/panel/solicitudes", label: "Solicitudes" },
  { href: "/panel/despachos", label: "Despachos" },
  { href: "/panel/inventario", label: "Inventario" },
];

/*
 * Guarda de sesión y cromo de la app de bodega.
 *
 * pb.authStore vive en el navegador, así que la comprobación es de cliente:
 * un componente de servidor no la ve. Mientras resuelve no se pinta nada,
 * para que una pantalla con datos no aparezca un instante antes del
 * redirect a /login.
 */
export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AkopiaUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function sync() {
      if (pb.authStore.isValid && pb.authStore.record) {
        setUser(pb.authStore.record as unknown as AkopiaUser);
      } else {
        setUser(null);
        router.replace("/login");
      }
      setChecked(true);
    }

    sync();
    return pb.authStore.onChange(sync);
  }, [router]);

  if (!checked || !user) {
    return null;
  }

  function signOut() {
    pb.authStore.clear();
    router.replace("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-(--surface-2)">
      <header className="sticky top-0 z-10 border-b border-(--rule) bg-(--surface)">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link href="/panel" className="text-lg font-black text-unal-green-dark">
            AKOPIA
          </Link>

          <span className="ml-auto hidden text-sm text-(--muted) sm:inline">
            {user.full_name}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded border border-(--rule) px-3 py-1.5 text-sm font-bold hover:bg-(--surface-2)"
          >
            Salir
          </button>
        </div>

        <nav
          className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2"
          aria-label="Secciones"
        >
          {NAV.map((item) => {
            const active =
              item.href === "/panel"
                ? pathname === "/panel"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "whitespace-nowrap rounded bg-unal-green-soft px-3 py-1.5 text-sm font-bold text-unal-green-dark"
                    : "whitespace-nowrap rounded px-3 py-1.5 text-sm font-bold text-(--ink-2) hover:bg-(--surface-2)"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
