"use client";

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  updateProfile,
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
  };

  return messages[code] ?? "Ocurrió un error inesperado. Intenta de nuevo.";
}
