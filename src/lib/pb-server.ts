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

    if (record.role !== "admin" || !record.active) {
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

// Igual que `requireAdmin`, pero para operaciones que ambos roles pueden
// hacer — como crear una ubicación con su foto: `locations.createRule`
// ya lo permite a cualquier operador activo, así que la firma de subida
// no puede ser más estricta que la regla que de todas formas se va a
// aplicar al crear el registro.
export async function requireActiveUser(token: string | null) {
  if (!token) {
    throw new UnauthorizedError("Falta la sesión.");
  }

  const pb = new PocketBase(POCKETBASE_URL);
  pb.authStore.save(token, null);

  try {
    const { record } = await pb.collection("users").authRefresh();

    if (!record.active) {
      throw new UnauthorizedError("Esta cuenta está desactivada.");
    }

    return record;
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      throw err;
    }
    throw new UnauthorizedError("La sesión no es válida.");
  }
}
