"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  firebaseErrorMessage,
  isAccountExistsWithDifferentCredential,
  linkGoogleAfterPasswordCollision,
  linkPasswordAfterGoogle,
  registerWithFirebase,
  signInWithGoogle,
} from "@/lib/firebase";
import { errorMessage, establishFirebaseSession } from "@/lib/pb";
import { checkEmailStatus, type EmailStatus } from "@/lib/auth-status";
import { GoogleButton } from "@/components/public/google-button";
import { Spinner } from "@/components/ui/spinner";

/*
 * El registro es real, pero no da acceso inmediato: crea la cuenta en
 * Firebase y AKOPIA la enlaza, con `active: false` salvo para
 * admin@akopia.org. Es la misma regla que ya aplican todas las reglas de
 * acceso del backend — sin `active` no se puede hacer nada — solo que
 * ahora quien lo activa es un administrador desde /panel/usuarios, en
 * vez de crear la cuenta él mismo desde cero.
 *
 * El correo se comprueba al salir del campo (/api/auth/email-status) para
 * adaptar el formulario a tres situaciones reales, distintas de "correo
 * nuevo":
 *
 *   1. Un admin ya vinculó este correo (nombre y rol listos, pero nunca
 *      entró) — el nombre se hereda y no se puede editar aquí: cambiarlo
 *      en este formulario no tendría ningún efecto (el puente nunca pisa
 *      un `full_name` ya existente), así que mejor no ofrecer un campo
 *      que en realidad no hace nada.
 *   2. El correo ya tiene cuenta en AKOPIA (con Google, con contraseña, o
 *      las dos). Crear una cuenta nueva no aplica — se ofrece iniciar
 *      sesión, o confirmar con Google para agregarle esta contraseña si
 *      todavía no la tenía.
 *   3. Correo nuevo del todo — el formulario de siempre.
 */
function isPreLinkedByAdmin(status: EmailStatus): boolean {
  return status.exists && !status.linked;
}

function alreadyHasAccount(status: EmailStatus): boolean {
  return status.exists && status.linked;
}

export default function RegistroPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<EmailStatus | null>(null);
  const [googleLinkError, setGoogleLinkError] = useState<unknown>(null);

  async function checkEmail() {
    if (!email.trim() || !email.includes("@")) {
      setEmailStatus(null);
      return;
    }
    const status = await checkEmailStatus(email.trim());
    setEmailStatus(status);
    if (isPreLinkedByAdmin(status) && status.fullName) {
      setFullName(status.fullName);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGoogleLinkError(null);
    setGooglePending(true);

    if (emailStatus && alreadyHasAccount(emailStatus) && password && password !== confirm) {
      setError("Las contraseñas no coinciden.");
      setGooglePending(false);
      return;
    }

    try {
      let idToken = await signInWithGoogle();

      if (emailStatus && alreadyHasAccount(emailStatus) && password) {
        idToken = await linkPasswordAfterGoogle(email.trim(), password);
      }

      const user = await establishFirebaseSession(idToken);
      router.push(user.active ? "/panel" : "/panel/pendiente");
    } catch (err) {
      if (isAccountExistsWithDifferentCredential(err)) {
        setGoogleLinkError(err);
        setError(
          "Ya existe una cuenta con contraseña para este correo. Escribe tu contraseña abajo y presiona \"Vincular con Google\" para confirmarlo."
        );
      } else {
        setError(firebaseErrorMessage(err));
      }
    } finally {
      setGooglePending(false);
    }
  }

  async function handleLinkGoogle() {
    if (!googleLinkError) return;
    if (!password) {
      setError("Escribe tu contraseña para confirmar la vinculación.");
      return;
    }

    setError(null);
    setGooglePending(true);

    try {
      const idToken = await linkGoogleAfterPasswordCollision(googleLinkError, password);
      const user = await establishFirebaseSession(idToken);
      setGoogleLinkError(null);
      router.push(user.active ? "/panel" : "/panel/pendiente");
    } catch (err) {
      setError(
        firebaseErrorMessage(err) === "Ocurrió un error inesperado. Intenta de nuevo."
          ? "La contraseña no es correcta."
          : firebaseErrorMessage(err)
      );
    } finally {
      setGooglePending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (emailStatus && alreadyHasAccount(emailStatus)) {
      setError(
        "Ya existe una cuenta de AKOPIA con este correo. Inicia sesión, o confírmalo con Google para agregarle esta contraseña."
      );
      return;
    }

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);

    try {
      const inheritedName = emailStatus && isPreLinkedByAdmin(emailStatus)
        ? emailStatus.fullName ?? fullName
        : fullName;
      const idToken = await registerWithFirebase(inheritedName, email, password);
      const user = await establishFirebaseSession(idToken);

      router.push(user.active ? "/panel" : "/panel/pendiente");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "auth/email-already-in-use") {
        // Salvaguarda: si por lo que sea no se llegó a comprobar el
        // correo al salir del campo (autocompletado, envío directo), el
        // propio intento de Firebase ya deja claro que existe — se
        // refleja aquí para que el formulario reaccione igual que si se
        // hubiera detectado a tiempo.
        setEmailStatus({ exists: true, linked: true, fullName: null });
        setError(
          "Ya existe una cuenta de AKOPIA con este correo. Inicia sesión, o confírmalo con Google para agregarle esta contraseña."
        );
      } else {
        setError(code ? firebaseErrorMessage(err) : errorMessage(err));
      }
    } finally {
      setPending(false);
    }
  }

  const linked = emailStatus ? alreadyHasAccount(emailStatus) : false;
  const preLinked = emailStatus ? isPreLinkedByAdmin(emailStatus) : false;

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-black tracking-tight">Crear una cuenta</h1>
      <p className="mt-2 text-(--ink-2)">
        Un administrador debe activarla antes de que puedas entrar a operar.
      </p>
      <p className="mt-1 text-xs text-(--muted)">
        AKOPIA es un sistema propio, independiente del usuario y contraseña de
        la UNAL — el correo puede ser el mismo, la cuenta no.
      </p>

      <div className="mt-8">
        <GoogleButton
          label={
            googlePending
              ? "Conectando…"
              : linked
                ? "Confirmar con Google"
                : "Continuar con Google"
          }
          disabled={googlePending || pending}
          loading={googlePending}
          onClick={handleGoogle}
        />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs font-bold uppercase tracking-wider text-(--muted)">
        <span className="h-px flex-1 bg-(--rule)" />o<span className="h-px flex-1 bg-(--rule)" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field
          id="nombre"
          label="Nombre completo"
          type="text"
          value={fullName}
          onChange={setFullName}
          autoComplete="name"
          disabled={preLinked}
          hint={
            preLinked
              ? "Ya te registró un administrador con este nombre — no se puede cambiar aquí."
              : undefined
          }
        />
        <Field
          id="correo"
          label="Correo"
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setEmailStatus(null);
          }}
          onBlur={checkEmail}
          autoComplete="email"
          hint={
            linked
              ? "Ya existe una cuenta de AKOPIA con este correo."
              : undefined
          }
        />
        <Field
          id="clave"
          label={linked ? "Contraseña que quieres agregar" : "Contraseña"}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <Field
          id="confirmar"
          label="Confirmar contraseña"
          type="password"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
        />

        {error ? (
          <p
            role="alert"
            className="rounded border-l-4 border-unal-red bg-(--surface-2) px-4 py-3 text-sm"
          >
            {error}
          </p>
        ) : null}

        {googleLinkError ? (
          <button
            type="button"
            disabled={pending || googlePending}
            onClick={handleLinkGoogle}
            className="flex w-full items-center justify-center gap-2 rounded border-2 border-unal-green-dark px-6 py-3 font-bold text-unal-green-dark hover:bg-(--surface-2) disabled:opacity-60"
          >
            {googlePending ? <Spinner /> : null}
            {googlePending ? "Vinculando…" : "Vincular con Google"}
          </button>
        ) : null}

        {linked ? (
          <p className="text-sm text-(--ink-2)">
            Escribe la contraseña arriba y usa &quot;Confirmar con Google&quot;
            — o{" "}
            <Link href="/login" className="font-bold text-unal-green-dark underline">
              inicia sesión
            </Link>{" "}
            si ya la tienes.
          </p>
        ) : (
          <button
            type="submit"
            disabled={pending || googlePending}
            className="flex w-full items-center justify-center gap-2 rounded bg-unal-green-dark px-6 py-3 font-bold text-white hover:bg-unal-green disabled:opacity-60"
          >
            {pending ? <Spinner /> : null}
            {pending ? "Creando cuenta…" : "Crear cuenta"}
          </button>
        )}
      </form>

      <p className="mt-8 text-(--ink-2)">
        ¿Ya tienes una cuenta?{" "}
        <Link href="/login" className="font-bold text-unal-green-dark underline">
          Inicia sesión
        </Link>
        .
      </p>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
  onBlur,
  autoComplete,
  disabled = false,
  hint,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete: string;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold">
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        autoComplete={autoComplete}
        required
        disabled={disabled}
        minLength={type === "password" ? 6 : undefined}
        className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5 focus:border-unal-green-dark disabled:opacity-70"
      />
      {hint ? <p className="mt-1 text-xs text-(--muted)">{hint}</p> : null}
    </div>
  );
}
