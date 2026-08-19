"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pb } from "@/lib/pb";

/*
 * Botón visible dentro del contenido de las páginas de ayuda del pie
 * de página — "← Volver al panel" (con sesión) o "← Inicio" (sin
 * ella). <HomeNavItem>, en el cabezote, ya resuelve lo mismo, pero en
 * móvil vive escondido dentro del menú de hamburguesa: hay que abrirlo
 * para encontrarlo. Pedido explícito del 19 de agosto — un botón a la
 * vista, sin tener que abrir nada. `md:hidden`: en escritorio el
 * cabezote ya lo muestra directamente, sin necesidad de este segundo.
 */
export function HomeNavButton() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    function sync() {
      setLoggedIn(pb.authStore.isValid);
    }
    sync();
    return pb.authStore.onChange(sync);
  }, []);

  if (loggedIn === null) return null;

  const href = loggedIn ? "/panel" : "/";
  const label = loggedIn ? "Volver al panel" : "Inicio";

  return (
    <Link
      href={href}
      className="mb-6 inline-flex items-center gap-1.5 rounded border border-(--rule) px-4 py-2 text-sm font-bold hover:bg-(--surface-2) md:hidden"
    >
      ← {label}
    </Link>
  );
}
