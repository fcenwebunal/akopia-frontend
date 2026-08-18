"use client";

import { menuForRole } from "@/components/unal-template/menu-config";
import { UnalShell } from "@/components/unal-template/unal-shell";
import { useSessionGuard } from "@/lib/use-session-guard";

/*
 * Momento 3: la app de bodega. Ya no lleva su propio cromo (AppShell,
 * retirado) — usa el mismo <UnalShell> que la portada y el login, con
 * el menú principal agrupado por rol (menuForRole) resolviendo el
 * límite de 6 elementos de primer nivel de la plantilla. La guarda de
 * sesión es la misma de siempre, ahora en el hook useSessionGuard.
 */
export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { user, checked } = useSessionGuard();

  if (!checked || !user) {
    return null;
  }

  return <UnalShell menuItems={menuForRole(user.role)}>{children}</UnalShell>;
}
