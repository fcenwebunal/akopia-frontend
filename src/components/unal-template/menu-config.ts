import type { UserRole } from "@/lib/pb";

/*
 * Agrupación del menú principal de la app, decidida con Juan Manuel para
 * respetar el límite de la plantilla (máx. 6 elementos de primer nivel
 * incluyendo "Sedes", máx. 8 de segundo). No se incluye ningún enlace a
 * "Inicio": la directriz B3 lo prohíbe explícitamente (el escudo ya
 * cumple esa función).
 */
export interface AppMenuLink {
  label: string;
  href: string;
}

export interface AppMenuItem {
  label: string;
  href?: string;
  children?: AppMenuLink[];
  adminOnly?: boolean;
}

export const APP_MENU: AppMenuItem[] = [
  { label: "Panel", href: "/panel" },
  {
    label: "Operación",
    children: [
      { label: "Donaciones", href: "/panel/donaciones" },
      { label: "Solicitudes", href: "/panel/solicitudes" },
      { label: "Despachos", href: "/panel/despachos" },
    ],
  },
  {
    label: "Inventario",
    children: [
      { label: "Inventario", href: "/panel/inventario" },
      { label: "Ubicaciones", href: "/panel/ubicaciones" },
    ],
  },
  {
    label: "Administración",
    adminOnly: true,
    children: [
      { label: "Usuarios", href: "/panel/usuarios" },
      { label: "Historial", href: "/panel/historial" },
      { label: "Respaldos", href: "/panel/respaldos" },
    ],
  },
];

export function menuForRole(role: UserRole | undefined): AppMenuItem[] {
  return APP_MENU.filter((item) => !item.adminOnly || role === "admin");
}
