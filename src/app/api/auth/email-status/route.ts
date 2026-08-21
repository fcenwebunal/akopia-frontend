import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/pocketbase-service";

export const runtime = "nodejs";

/*
 * De cara al usuario, "usuario y contraseña" en AKOPIA en realidad pasa
 * por Firebase (ver src/lib/firebase.ts) — no por PocketBase nativo
 * directamente. Firebase deliberadamente no deja consultar desde el
 * navegador si un correo ya existe ni con qué proveedor (protección
 * anti-enumeración: `fetchSignInMethodsForEmail`/`createAuthUri`
 * devuelven siempre la misma respuesta genérica, verificado contra el
 * proyecto real de AKOPIA antes de intentar construir nada sobre esa
 * base — ver CLAUDE.md del frontend).
 *
 * Lo que SÍ podemos consultar es PocketBase: como todo inicio de sesión
 * real (Google o contraseña) pasa por /api/auth/firebase antes de
 * terminar, `users.firebase_uid` queda como una señal fiel de "esta
 * persona ya completó un inicio de sesión con Firebase alguna vez" —
 * sin necesitar el Admin SDK de Firebase (una cuenta de servicio nueva,
 * que este proyecto evita a propósito — ver firebase-server.ts).
 *
 * `fullName` solo se devuelve para el caso que /registro necesita
 * mostrarlo (un correo que un admin ya vinculó, con nombre y rol
 * listos, pero que todavía no ha entrado nunca) — en cualquier otro
 * caso se omite, para no ampliar más de lo necesario qué revela este
 * endpoint público.
 */
export async function POST(request: NextRequest) {
  let body: { email?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Cuerpo inválido." }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ message: "Falta el correo." }, { status: 400 });
  }

  try {
    const pb = await serviceClient();
    const user = await pb
      .collection("users")
      .getFirstListItem(pb.filter("email = {:email}", { email }))
      .catch(() => null);

    if (!user) {
      return NextResponse.json({ exists: false, linked: false, fullName: null });
    }

    const linked = Boolean(user.firebase_uid);
    return NextResponse.json({
      exists: true,
      linked,
      fullName: linked ? null : (user.full_name as string),
    });
  } catch (err) {
    console.error("Error consultando el estado de un correo:", err);
    return NextResponse.json(
      { message: "No se pudo comprobar el correo. Intenta de nuevo." },
      { status: 500 }
    );
  }
}
