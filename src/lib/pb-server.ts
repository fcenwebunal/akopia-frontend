import PocketBase from "pocketbase";

// Servidor a servidor: siempre local, nunca la URL pública que ve el
// navegador (ver src/lib/pb.ts sobre por qué esa se deja vacía/relativa).
const POCKETBASE_URL = process.env.PB_INTERNAL_URL ?? "http://127.0.0.1:8090";

export class UnauthorizedError extends Error {}

/*
 * Valida el token de un usuario en una ruta de servidor (Route Handler),
 * donde no hay `pb.authStore` de navegador que consultar.
 *
 * `authRefresh()` no es un capricho aquí: en vez de confiar en el rol
 * que mande el cliente, le pregunta a PocketBase el estado ACTUAL del
 * registro con ese token. Si alguien fue desactivado hace un segundo,
 * esto lo refleja; un objeto armado a mano en el cliente no lo haría.
 */
export async function requireAdmin(token: string | null) {
  if (!token) {
    throw new UnauthorizedError("Falta la sesión.");
  }

  const pb = new PocketBase(POCKETBASE_URL);
  pb.authStore.save(token, null);

  try {
    const { record } = await pb.collection("users").authRefresh();
    const roles: string[] = Array.isArray(record.role) ? record.role : [];

    if (!roles.includes("admin") || !record.active) {
      throw new UnauthorizedError("Esta acción requiere un administrador activo.");
    }

    return record;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError("La sesión no es válida.");
  }
}

// Igual que `requireAdmin`, pero para cualquiera de los roles en
// `allowed` — como firmar la subida de la foto de un producto: la
// firma no puede ser más permisiva que `products.updateRule` en el
// backend (los roles que tocan inventario, ver INVENTORY_ROLES en
// utils/roles.js), o alguien sin permiso conseguiría una firma válida
// y solo fallaría después, al intentar guardar `photo_url`.
export async function requireRole(token: string | null, allowed: string[]) {
  if (!token) {
    throw new UnauthorizedError("Falta la sesión.");
  }

  const pb = new PocketBase(POCKETBASE_URL);
  pb.authStore.save(token, null);

  try {
    const { record } = await pb.collection("users").authRefresh();
    const roles: string[] = Array.isArray(record.role) ? record.role : [];

    if (!record.active) {
      throw new UnauthorizedError("Esta cuenta está desactivada.");
    }
    if (!roles.some((role) => allowed.includes(role))) {
      throw new UnauthorizedError("Tu rol no tiene permiso para esta acción.");
    }

    return record;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError("La sesión no es válida.");
  }
}
