"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  EmailAuthProvider,
  linkWithCredential,
  updateProfile,
  type AuthError,
} from "firebase/auth";

/*
 * Firebase solo hace una cosa aquí: verificar credenciales y emitir un
 * ID token. No es la fuente de verdad de quién es cada usuario ni de qué
 * puede hacer — eso lo sigue decidiendo PocketBase, con su columna
 * `role` y `active`, exactamente como antes.
 *
 * La configuración de un proyecto web de Firebase no es secreta: está
 * pensada para viajar en el bundle del cliente y se restringe por
 * dominio desde la consola de Firebase, no ocultándola.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

/*
 * Registra una cuenta nueva en Firebase y devuelve su ID token. La cuenta
 * en AKOPIA (rol, si puede entrar) la crea el backend en el siguiente
 * paso, no Firebase — ver /api/auth/firebase.
 */
export async function registerWithFirebase(
  fullName: string,
  email: string,
  password: string
): Promise<string> {
  const credential = await createUserWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );
  await updateProfile(credential.user, { displayName: fullName });
  return credential.user.getIdToken();
}

export async function loginWithFirebase(
  email: string,
  password: string
): Promise<string> {
  const credential = await signInWithEmailAndPassword(
    firebaseAuth,
    email,
    password
  );
  return credential.user.getIdToken();
}

const googleProvider = new GoogleAuthProvider();

/*
 * Sirve igual para registrar que para entrar: Google no distingue "cuenta
 * nueva" de "cuenta existente", y el puente del backend tampoco —
 * /api/auth/firebase crea el registro en `users` si es la primera vez
 * que ve ese correo o ese uid, y si no lo enlaza al que ya existía.
 *
 * Usa una ventana emergente en vez de redirigir a la página de Google y
 * volver. Es más simple de seguir en el código, y funciona bien en
 * escritorio y en Chrome para Android. Si algún navegador (Safari en
 * iOS dentro de una app, por ejemplo) bloquea la ventana emergente, la
 * solución conocida es cambiar a signInWithRedirect — no se hizo aquí
 * para no complicar el flujo mientras no haga falta.
 */
export async function signInWithGoogle(): Promise<string> {
  const credential = await signInWithPopup(firebaseAuth, googleProvider);
  return credential.user.getIdToken();
}

export function isAccountExistsWithDifferentCredential(error: unknown): boolean {
  return (error as { code?: string })?.code === "auth/account-exists-with-different-credential";
}

/*
 * Recuperación de la colisión de proveedores: alguien ya se registró con
 * correo y contraseña, y ahora intenta entrar con Google usando ese mismo
 * correo. `signInWithPopup` para Google no fusiona sola dos proveedores
 * distintos — lanza `auth/account-exists-with-different-credential`, con
 * la credencial de Google ya lista dentro del propio error
 * (`credentialFromError`). Para vincularla hace falta primero demostrar
 * que la contraseña es de verdad suya: se inicia sesión con ella, y
 * recién ahí se adjunta la credencial de Google a esa cuenta ya
 * autenticada — nunca al revés, porque `linkWithCredential` exige una
 * sesión activa.
 */
export async function linkGoogleAfterPasswordCollision(
  error: unknown,
  password: string
): Promise<string> {
  const authError = error as AuthError;
  const email = authError.customData?.email as string | undefined;
  const pendingCredential = GoogleAuthProvider.credentialFromError(authError);

  if (!email || !pendingCredential) {
    throw error;
  }

  const userCredential = await signInWithEmailAndPassword(firebaseAuth, email, password);
  await linkWithCredential(userCredential.user, pendingCredential);
  return userCredential.user.getIdToken();
}

/*
 * El camino inverso: alguien ya entra con Google y quiere poder entrar
 * también con contraseña. Solo se puede llamar con una sesión de Google
 * recién establecida (`firebaseAuth.currentUser` ya poblado) — es esa
 * sesión la que prueba que el correo es suyo, no la contraseña que está
 * a punto de fijar. Si el proveedor ya estaba vinculado de antes (alguien
 * repite el intento, o ya tenía las dos formas), no es un error real: ya
 * puede entrar con Google de todas formas, así que se deja pasar.
 */
export async function linkPasswordAfterGoogle(
  email: string,
  password: string
): Promise<string> {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new Error("No hay una sesión de Google activa para vincular la contraseña.");
  }

  try {
    await linkWithCredential(user, EmailAuthProvider.credential(email, password));
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code !== "auth/provider-already-linked" && code !== "auth/credential-already-in-use") {
      throw err;
    }
  }

  return user.getIdToken(true);
}

/*
 * Traduce los códigos de error de Firebase Auth a mensajes en español
 * para un operador, en vez de dejar pasar el "auth/email-already-in-use"
 * en inglés que da el SDK.
 */
export function firebaseErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? "";

  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/user-not-found": "No hay ninguna cuenta con ese correo.",
    "auth/wrong-password": "La contraseña no es correcta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests":
      "Demasiados intentos. Espera un momento y vuelve a intentar.",
    "auth/popup-closed-by-user": "Cerraste la ventana antes de terminar.",
    "auth/popup-blocked":
      "El navegador bloqueó la ventana de Google. Permite ventanas emergentes para este sitio e intenta de nuevo.",
    "auth/cancelled-popup-request": "Se canceló el intento anterior.",
    "auth/credential-already-in-use": "Esa cuenta de Google ya está vinculada a otro correo.",
    "auth/requires-recent-login":
      "Por seguridad, vuelve a iniciar sesión antes de hacer este cambio.",
  };

  return messages[code] ?? "Ocurrió un error inesperado. Intenta de nuevo.";
}
