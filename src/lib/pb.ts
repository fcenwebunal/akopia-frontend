import PocketBase from "pocketbase";

/*
 * Cliente único de PocketBase.
 *
 * La URL nunca se escribe en el código: el mismo build tiene que servir
 * en local, en el Ubuntu de pruebas y en la infraestructura de la UNAL.
 */
export const POCKETBASE_URL =
  process.env.NEXT_PUBLIC_PB_URL ?? "http://127.0.0.1:8090";

export const pb = new PocketBase(POCKETBASE_URL);

// El SDK reintenta las peticiones canceladas por su propio auto-cancel,
// que en React 18+ dispara dos veces cada efecto en desarrollo.
pb.autoCancellation(false);

// Los únicos dos valores que admite users.role en el esquema.
export type UserRole = "admin" | "operator";

export interface AkopiaUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  active: boolean;
}

export function currentUser(): AkopiaUser | null {
  if (!pb.authStore.isValid || !pb.authStore.record) {
    return null;
  }
  return pb.authStore.record as unknown as AkopiaUser;
}

/*
 * PocketBase devuelve los errores de validación campo por campo, dentro
 * de `data`. Sacamos el primero porque es el único que el operador
 * necesita leer para corregir el formulario.
 */
export function errorMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "Ocurrió un error inesperado. Intenta de nuevo.";
  }

  const response = (error as { response?: Record<string, unknown> }).response;
  const fields = response?.data as
    | Record<string, { message?: string }>
    | undefined;

  if (fields) {
    const first = Object.values(fields)[0];
    if (first?.message) {
      return first.message;
    }
  }

  if (typeof response?.message === "string" && response.message) {
    return response.message;
  }

  const status = (error as { status?: number }).status;
  if (status === 400) {
    return "Los datos enviados no son válidos.";
  }
  if (status === 0) {
    return "No se pudo conectar con el servidor. ¿Está corriendo PocketBase?";
  }

  return "Ocurrió un error inesperado. Intenta de nuevo.";
}
