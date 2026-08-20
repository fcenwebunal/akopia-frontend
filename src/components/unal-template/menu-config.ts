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
  // Roles que ven este enlace. Sin esto, cualquier sesión activa lo ve
  // (igual que antes de los roles múltiples) — solo se declara donde
  // hace falta restringir.
  roles?: UserRole[];
}

export interface AppMenuItem {
  label: string;
  href?: string;
  children?: AppMenuLink[];
  roles?: UserRole[];
}

export const APP_MENU: AppMenuItem[] = [
  { label: "Panel", href: "/panel" },
  {
    label: "Operación",
    children: [
      { label: "Donaciones", href: "/panel/donaciones" },
      { label: "Solicitudes", href: "/panel/solicitudes" },
      { label: "Despachos", href: "/panel/despachos" },
      {
        label: "Kits",
        href: "/panel/kits",
        roles: ["admin", "coordinacion", "salida"],
      },
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
    // Coordinación administra usuarios y consulta el historial, pero
    // no respalda la base — eso queda exclusivo de Administrador (ver
    // la matriz de permisos acordada con Juan Manuel, 20 ago 2026).
    children: [
      { label: "Usuarios", href: "/panel/usuarios", roles: ["admin", "coordinacion"] },
      {
        label: "Historial",
        href: "/panel/historial",
        roles: ["admin", "coordinacion", "comunicaciones"],
      },
      { label: "Respaldos", href: "/panel/respaldos", roles: ["admin"] },
    ],
  },
];

export function menuForRole(role: UserRole[] | undefined): AppMenuItem[] {
  const roles = role ?? [];
  const visible = (allowed: UserRole[] | undefined) =>
    !allowed || allowed.some((r) => roles.includes(r));

  return APP_MENU.map((item) => {
    if (!item.children) return item;
    const children = item.children.filter((child) => visible(child.roles));
    return children.length > 0 ? { ...item, children } : null;
  }).filter((item): item is AppMenuItem => item !== null && visible(item.roles));
}
