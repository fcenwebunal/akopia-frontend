import type { UserRole } from "@/lib/pb";

/*
 * Espejo del catálogo de roles y su jerarquía en
 * akopia-backend/pb_hooks/utils/roles.js — mismos niveles, mismas
 * reglas. El backend es quien de verdad decide (esto es solo para que
 * la interfaz no ofrezca botones que el servidor va a rechazar), así
 * que si algún día se agrega un rol hay que tocar los dos lados.
 */
export const ROLE_LEVELS: Record<UserRole, number> = {
  admin: 3,
  coordinacion: 2,
  transporte_distribucion: 1,
  voluntariado: 1,
  comunicaciones: 1,
  salida: 1,
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  coordinacion: "Coordinación",
  transporte_distribucion: "Transporte y distribución",
  voluntariado: "Voluntariado",
  comunicaciones: "Comunicaciones",
  salida: "Salida",
};

export const ALL_ROLES = Object.keys(ROLE_LEVELS) as UserRole[];

export function hasAnyRole(
  roles: UserRole[] | undefined,
  allowed: UserRole[]
): boolean {
  if (!roles) return false;
  return roles.some((role) => allowed.includes(role));
}

export function isAdmin(roles: UserRole[] | undefined): boolean {
  return hasAnyRole(roles, ["admin"]);
}

function maxLevel(roles: UserRole[]): number {
  return roles.reduce((max, role) => Math.max(max, ROLE_LEVELS[role] ?? 0), 0);
}

/*
 * Roles que quien tiene `actorRoles` puede asignar — Administrador
 * puede asignar cualquiera (incluido Administrador); cualquier otro
 * actor solo roles de nivel estrictamente menor al suyo. Espejo de
 * `canAssignRoles` en el backend, usado aquí solo para no ofrecer en
 * la interfaz un rol que el servidor de todas formas va a rechazar.
 */
export function assignableRoles(actorRoles: UserRole[]): UserRole[] {
  if (isAdmin(actorRoles)) return ALL_ROLES;
  const ceiling = maxLevel(actorRoles);
  return ALL_ROLES.filter((role) => ROLE_LEVELS[role] < ceiling);
}
