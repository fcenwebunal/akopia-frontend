import PocketBase from "pocketbase";

/*
 * Cliente de PocketBase autenticado como el superusuario de servicio,
 * para rutas del servidor que necesitan leer/escribir `users` sin ser
 * la sesión de nadie en particular — hoy lo usan el puente de Firebase
 * (/api/auth/firebase) y la comprobación de estado de un correo
 * (/api/auth/email-status). Nunca se expone al navegador: las
 * credenciales viven solo en variables de entorno del servidor.
 */

const POCKETBASE_URL = process.env.PB_INTERNAL_URL ?? "http://127.0.0.1:8090";

export async function serviceClient(): Promise<PocketBase> {
  const email = process.env.POCKETBASE_SERVICE_EMAIL;
  const password = process.env.POCKETBASE_SERVICE_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Faltan POCKETBASE_SERVICE_EMAIL / POCKETBASE_SERVICE_PASSWORD en el servidor. " +
        "Crea el superusuario con `pocketbase superuser upsert` y configura estas variables."
    );
  }

  const pb = new PocketBase(POCKETBASE_URL);
  await pb.collection("_superusers").authWithPassword(email, password);
  return pb;
}
