import PocketBase from "pocketbase";

/*
 * Cliente único de PocketBase, para el navegador.
 *
 * La URL nunca se escribe en el código: el mismo build tiene que servir
 * en local, en el Ubuntu de pruebas y en la infraestructura de la UNAL.
 *
 * En producción, `NEXT_PUBLIC_PB_URL` se deja sin definir a propósito:
 * así el SDK resuelve contra el origen desde el que se cargó la
 * página — el mismo host y protocolo, sea la IP (`http://172.23.177.12`)
 * o el dominio (`https://acopio.manizales.unal.edu.co`) — sin fijar de
 * antemano cuál va a usar el navegador (ver DESPLIEGUE.md, el NAT
 * pendiente con OTIC). Fijarlo a un host concreto rompía el login en
 * cuanto se accedía por el otro — ver bitácora 19 ago 2026.
 *
 * BUG REAL encontrado el 20 de agosto, con un login real desde `/login`
 * en producción (no solo desde la portada): el SDK de PocketBase arma
 * la URL base mirando si `baseURL` empieza por "/" — un string VACÍO
 * ("") no cuenta como que sí, así que además de `location.origin` le
 * pega `location.pathname` antes del resto ("/login/api/collections/...",
 * un 404). Con baseURL = "/" sí empieza por "/", y esa rama nunca se
 * ejecuta — por eso aquí se normaliza cualquier valor vacío a "/" en
 * vez de dejarlo como "", que es indistinguible a simple vista pero se
 * comporta distinto dentro del SDK.
 */
const configuredPbUrl = process.env.NEXT_PUBLIC_PB_URL;
export const POCKETBASE_URL =
  configuredPbUrl === undefined ? "http://127.0.0.1:8090" : configuredPbUrl || "/";

export const pb = new PocketBase(POCKETBASE_URL);

// El SDK reintenta las peticiones canceladas por su propio auto-cancel,
// que en React 18+ dispara dos veces cada efecto en desarrollo.
pb.autoCancellation(false);

// Los seis roles que admite users.role en el esquema (selección
// múltiple desde la migración 044 del backend — una cuenta puede
// tener varios a la vez, por eso AkopiaUser.role es un arreglo).
export type UserRole =
  | "admin"
  | "coordinacion"
  | "transporte_distribucion"
  | "voluntariado"
  | "comunicaciones"
  | "salida";

export interface AkopiaUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole[];
  phone?: string;
  active: boolean;
}

export function currentUser(): AkopiaUser | null {
  if (!pb.authStore.isValid || !pb.authStore.record) {
    return null;
  }
  return pb.authStore.record as unknown as AkopiaUser;
}

export class RouteError extends Error {
  status: number;
  response: Record<string, unknown>;

  constructor(status: number, response: Record<string, unknown>) {
    super(typeof response.message === "string" ? response.message : "Error");
    this.status = status;
    this.response = response;
  }
}

/*
 * Cambia un ID token de Firebase por una sesión real de AKOPIA, llamando
 * al puente del propio frontend (src/app/api/auth/firebase). Lo usan
 * /login y /registro por igual, para no repetir el POST y el guardado en
 * pb.authStore en cada uno.
 */
export async function establishFirebaseSession(
  idToken: string
): Promise<AkopiaUser> {
  const response = await fetch("/api/auth/firebase", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new RouteError(response.status, payload);
  }

  pb.authStore.save(payload.token, payload.record);
  return payload.record as AkopiaUser;
}

/*
 * Llama a una ruta propia del backend (pb_hooks/05_routes.pb.js).
 *
 * El SDK de PocketBase no expone un método genérico para rutas fuera de
 * las colecciones, así que estas hablan por fetch directo. El error se
 * relanza con la misma forma que usan los errores del SDK
 * (`error.response.message`, `error.status`) para que errorMessage() y
 * cualquier otro código que lea errores del backend sirvan igual aquí.
 */
export async function callRoute<T>(
  path: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  const response = await fetch(pb.buildURL(path), {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: pb.authStore.token,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new RouteError(response.status, payload);
  }

  return payload as T;
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
