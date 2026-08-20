import { NextRequest, NextResponse } from "next/server";
import PocketBase from "pocketbase";
import { FirebaseTokenError, verifyFirebaseToken } from "@/lib/firebase-server";

export const runtime = "nodejs";

// Servidor a servidor: siempre local, nunca la URL pública que ve el
// navegador (ver src/lib/pb.ts sobre por qué esa se deja vacía/relativa).
const POCKETBASE_URL = process.env.PB_INTERNAL_URL ?? "http://127.0.0.1:8090";

/*
 * Puente entre Firebase Authentication y la sesión real de AKOPIA.
 *
 * Firebase solo prueba que alguien controla un correo y una contraseña.
 * Quién es esa persona dentro de AKOPIA — su rol, si está activa, todo lo
 * que las 18 colecciones consultan en cada regla de acceso — lo sigue
 * decidiendo exclusivamente PocketBase. Este endpoint es el único lugar
 * donde ambos mundos se tocan:
 *
 *   1. Verifica el ID token de Firebase (src/lib/firebase-server.ts).
 *   2. Busca o crea el registro correspondiente en `users`, usando
 *      primero el uid de Firebase y si no, el correo — así una cuenta
 *      creada por un admin antes de que existiera Firebase (como
 *      admin@akopia.org) se enlaza sola la primera vez que esa persona
 *      entra con Firebase, sin perder su rol.
 *   3. Usa `impersonate`, exclusivo de un superusuario real de
 *      PocketBase, para emitir un token válido de ese usuario sin
 *      conocer ni necesitar su contraseña.
 *
 * El superusuario de servicio vive solo en variables de entorno del
 * servidor (nunca NEXT_PUBLIC_*) y no se expone al navegador en ningún
 * momento.
 */

const ADMIN_BOOTSTRAP_EMAIL = "admin@akopia.org";
const IMPERSONATE_DURATION_SECONDS = 3600 * 12;

// Un solo UUID: 36 caracteres, muy por debajo del máximo de 71 que pone
// PocketBase al campo password (bcrypt trunca en 72 bytes, y de ahí sale
// ese límite). Dos UUID concatenados lo superan y el alta falla con
// validation_max_text_constraint — pasó en la primera prueba real.
function randomPassword(): string {
  return crypto.randomUUID();
}

async function serviceClient(): Promise<PocketBase> {
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

export async function POST(request: NextRequest) {
  let body: { idToken?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Cuerpo inválido." }, { status: 400 });
  }

  if (!body.idToken) {
    return NextResponse.json(
      { message: "Falta el token de Firebase." },
      { status: 400 }
    );
  }

  let identity;
  try {
    identity = await verifyFirebaseToken(body.idToken);
  } catch (err) {
    if (err instanceof FirebaseTokenError) {
      return NextResponse.json({ message: err.message }, { status: 401 });
    }
    throw err;
  }

  let pb: PocketBase;
  try {
    pb = await serviceClient();
  } catch (err) {
    console.error("No se pudo autenticar el superusuario de servicio:", err);
    return NextResponse.json(
      { message: "El servidor no pudo completar el inicio de sesión. Avisa al administrador." },
      { status: 500 }
    );
  }

  try {
    // Enlazar por uid primero: es estable aunque el correo cambie en
    // Firebase. Los valores ya vienen de un JWT verificado, pero se pasan
    // como parámetros igual — es el mismo hábito que siguen los hooks del
    // backend, y no cuesta nada aplicarlo aquí también.
    let user = await pb
      .collection("users")
      .getFirstListItem(pb.filter("firebase_uid = {:uid}", { uid: identity.uid }))
      .catch(() => null);

    if (!user) {
      user = await pb
        .collection("users")
        .getFirstListItem(pb.filter("email = {:email}", { email: identity.email }))
        .catch(() => null);

      if (user && !user.firebase_uid) {
        user = await pb
          .collection("users")
          .update(user.id, { firebase_uid: identity.uid });
      }
    }

    if (!user) {
      const isBootstrapAdmin = identity.email === ADMIN_BOOTSTRAP_EMAIL;
      // Nadie va a usar esta contraseña nunca: la credencial real es
      // Firebase. Existe solo porque el campo lo exige el esquema.
      const password = randomPassword();

      user = await pb.collection("users").create({
        email: identity.email,
        password,
        passwordConfirm: password,
        full_name: identity.fullName || identity.email,
        // Rol de arranque, sin más significado que "algo válido hasta
        // que un admin/coordinación revise la cuenta" — queda inactiva
        // de todas formas (ver `active` abajo), así que este valor no
        // otorga ningún acceso real por sí solo.
        role: isBootstrapAdmin ? ["admin"] : ["voluntariado"],
        // Las cuentas nuevas quedan pendientes de que un admin las active,
        // salvo el correo de arranque del proyecto. Es la misma regla que
        // ya aplican todas las reglas de acceso del backend: sin `active`
        // no se puede hacer nada.
        active: isBootstrapAdmin,
        firebase_uid: identity.uid,
      });
    }

    if (!user) {
      // Inalcanzable: la rama de arriba siempre crea un registro cuando
      // no encontró ninguno. Sirve para que TypeScript no dude, y como
      // red si alguna vez se reordena el código de arriba por error.
      throw new Error("No se pudo resolver el usuario de AKOPIA.");
    }

    const impersonated = await pb
      .collection("users")
      .impersonate(user.id, IMPERSONATE_DURATION_SECONDS);

    return NextResponse.json({
      token: impersonated.authStore.token,
      record: impersonated.authStore.record,
    });
  } catch (err) {
    console.error("Error en el puente Firebase -> AKOPIA:", err);
    return NextResponse.json(
      { message: "No se pudo completar el inicio de sesión. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
