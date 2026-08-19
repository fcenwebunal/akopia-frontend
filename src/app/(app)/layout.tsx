"use client";

import { usePathname } from "next/navigation";
import { menuForRole } from "@/components/unal-template/menu-config";
import { UnalShell } from "@/components/unal-template/unal-shell";
import { useSessionGuard } from "@/lib/use-session-guard";

/*
 * Momento 3: la app de bodega. Ya no lleva su propio cromo (AppShell,
 * retirado) — usa el mismo <UnalShell> que la portada y el login, con
 * el menú principal agrupado por rol (menuForRole) resolviendo el
 * límite de 6 elementos de primer nivel de la plantilla. La guarda de
 * sesión es la misma de siempre, ahora en el hook useSessionGuard.
 *
 * /panel/pendiente es la excepción: una cuenta sin activar SÍ pasa por
 * este layout (el guard la deja entrar, solo la encierra en esta
 * ruta), así que con menuForRole normal vería el menú completo de la
 * app — Panel, Operación, Inventario — pero cada uno de esos enlaces
 * la rebota de vuelta aquí mismo, porque nada funciona todavía sin
 * `active`. Confuso, no roto (el guard evita que quede realmente
 * atrapada en otro lado), pero un menú sin ninguna opción usable no
 * ayuda — se le pasa un menú vacío en su lugar.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, checked } = useSessionGuard();
  const pathname = usePathname();

  if (!checked || !user) {
    return null;
  }

  const menuItems = pathname === "/panel/pendiente" ? [] : menuForRole(user.role);

  return <UnalShell menuItems={menuItems}>{children}</UnalShell>;
}
