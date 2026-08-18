"use client";

import {
  Gift,
  History,
  Home,
  ClipboardList,
  Package,
  Truck,
  Users,
  type LucideIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pb, type AkopiaUser } from "@/lib/pb";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/panel", label: "Panel", icon: Home },
  { href: "/panel/donaciones", label: "Donaciones", icon: Gift },
  { href: "/panel/solicitudes", label: "Solicitudes", icon: ClipboardList },
  { href: "/panel/despachos", label: "Despachos", icon: Truck },
  { href: "/panel/inventario", label: "Inventario", icon: Package },
];

const ADMIN_NAV: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/panel/usuarios", label: "Usuarios", icon: Users },
  { href: "/panel/historial", label: "Historial", icon: History },
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
        const record = pb.authStore.record as unknown as AkopiaUser;
        setUser(record);

        // Una cuenta sin activar tiene token válido — Firebase no exige
        // aprobación de admin, eso lo decide PocketBase — pero cada
        // regla de acceso del backend exige `active = true`, así que
        // aquí solo vería listas vacías sin entender por qué.
        if (!record.active && pathname !== "/panel/pendiente") {
          router.replace("/panel/pendiente");
        }
      } else {
        setUser(null);
        router.replace("/login");
      }
      setChecked(true);
    }

    sync();
    return pb.authStore.onChange(sync);
  }, [router, pathname]);

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
          <Link href="/panel" className="shrink-0">
            <Image src="/brand/akopia-logo.svg" alt="AKOPIA" width={6292} height={1844} className="h-6 w-auto" />
          </Link>

          <span className="ml-auto hidden text-sm text-(--muted) sm:inline">
            {user.full_name}
          </span>
          <ThemeToggle />
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
          {(user.role === "admin" ? [...NAV, ...ADMIN_NAV] : NAV).map((item) => {
            const active =
              item.href === "/panel"
                ? pathname === "/panel"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={
                  active
                    ? "flex items-center gap-1.5 whitespace-nowrap rounded bg-unal-green-soft px-3 py-1.5 text-sm font-bold text-unal-green-dark"
                    : "flex items-center gap-1.5 whitespace-nowrap rounded px-3 py-1.5 text-sm font-bold text-(--ink-2) hover:bg-(--surface-2)"
                }
              >
                <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
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
