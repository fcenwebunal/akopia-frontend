"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { pb } from "@/lib/pb";

/*
 * "Volver al panel" (con sesión) o "Inicio" (sin ella) — pedido
 * explícito del 19 de agosto: la portada, /login, /registro y las
 * páginas de ayuda del pie de página no tenían ninguna forma de volver
 * a /panel una vez adentro — la única salida era cerrar sesión y
 * volver a entrar. Se autooculta en dos casos: dentro de la app
 * (`/panel/...`, donde "Panel" ya cumple ese papel) y en la portada
 * sin sesión (ya se está en el inicio).
 *
 * Vive como componente aparte, no como prop estática de cada layout,
 * porque necesita saber si hay sesión — dato que solo existe en el
 * cliente (`pb.authStore`), igual que <AccountBar>.
 */
export function HomeNavItem() {
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    function sync() {
      setLoggedIn(pb.authStore.isValid);
    }
    sync();
    return pb.authStore.onChange(sync);
  }, []);

  if (pathname?.startsWith("/panel")) return null;
  if (loggedIn === null) return null;
  if (!loggedIn && pathname === "/") return null;

  const href = loggedIn ? "/panel" : "/";
  const label = loggedIn ? "Volver al panel" : "Inicio";

  return (
    <div className="btn-group">
      <Link href={href} className="btn btn-default">
        {label}
      </Link>
    </div>
  );
}
