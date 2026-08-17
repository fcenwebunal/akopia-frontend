import { createRemoteJWKSet, jwtVerify } from "jose";

// No lleva "server-only" como guarda de import porque no se agregó esa
// dependencia extra; en la práctica solo lo importa la ruta de API de
// abajo, que ya corre exclusivamente en el servidor.

/*
 * Verifica un ID token de Firebase sin el Admin SDK y sin credenciales de
 * servicio: solo hacen falta las llaves públicas de Google y el
 * project_id, que no son secretos. El Admin SDK completo (con cuenta de
 * servicio) sirve para más cosas — enviar notificaciones, administrar
 * usuarios desde el backend de Firebase — pero para lo único que
 * necesitamos, comprobar que el token es auténtico, esto basta y no
 * exige guardar una llave privada en el servidor.
 *
 * Referencia: https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!PROJECT_ID) {
  throw new Error(
    "Falta NEXT_PUBLIC_FIREBASE_PROJECT_ID: no se puede verificar tokens de Firebase sin saber a qué proyecto pertenecen."
  );
}

const JWKS = createRemoteJWKSet(
  new URL(
    "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
  )
);

export interface FirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  fullName: string;
}

export class FirebaseTokenError extends Error {}

export async function verifyFirebaseToken(
  idToken: string
): Promise<FirebaseIdentity> {
  let payload;

  try {
    ({ payload } = await jwtVerify(idToken, JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    }));
  } catch {
    throw new FirebaseTokenError("El token de Firebase no es válido o expiró.");
  }

  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new FirebaseTokenError("El token de Firebase no trae correo.");
  }

  return {
    uid: payload.sub,
    email: payload.email,
    emailVerified: Boolean(payload.email_verified),
    fullName: typeof payload.name === "string" ? payload.name : payload.email,
  };
}
