"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  firebaseErrorMessage,
  registerWithFirebase,
  signInWithGoogle,
} from "@/lib/firebase";
import { errorMessage, establishFirebaseSession } from "@/lib/pb";
import { GoogleButton } from "@/components/public/google-button";
import { Spinner } from "@/components/ui/spinner";

/*
 * El registro es real, pero no da acceso inmediato: crea la cuenta en
 * Firebase y AKOPIA la enlaza, con `active: false` salvo para
 * admin@akopia.org. Es la misma regla que ya aplican todas las reglas de
 * acceso del backend — sin `active` no se puede hacer nada — solo que
 * ahora quien lo activa es un administrador desde /panel/usuarios, en
 * vez de crear la cuenta él mismo desde cero.
 */
export default function RegistroPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGoogle() {
    setError(null);
    setGooglePending(true);

    try {
      const idToken = await signInWithGoogle();
      const user = await establishFirebaseSession(idToken);
      router.push(user.active ? "/panel" : "/panel/pendiente");
    } catch (err) {
      setError(firebaseErrorMessage(err));
    } finally {
      setGooglePending(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setPending(true);

    try {
      const idToken = await registerWithFirebase(fullName, email, password);
      const user = await establishFirebaseSession(idToken);

      router.push(user.active ? "/panel" : "/panel/pendiente");
    } catch (err) {
      setError(
        (err as { code?: string }).code
          ? firebaseErrorMessage(err)
          : errorMessage(err)
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-black tracking-tight">Crear una cuenta</h1>
      <p className="mt-2 text-[var(--ink-2)]">
        Un administrador debe activarla antes de que puedas entrar a operar.
      </p>

      <div className="mt-8">
        <GoogleButton
          label={googlePending ? "Conectando…" : "Continuar con Google"}
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
        />
        <Field
          id="correo"
          label="Correo"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          id="clave"
          label="Contraseña"
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
            className="rounded border-l-4 border-unal-red bg-[var(--surface-2)] px-4 py-3 text-sm"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={pending || googlePending}
          className="flex w-full items-center justify-center gap-2 rounded bg-unal-green-dark px-6 py-3 font-bold text-white hover:bg-unal-green disabled:opacity-60"
        >
          {pending ? <Spinner /> : null}
          {pending ? "Creando cuenta…" : "Crear cuenta"}
        </button>
      </form>

      <p className="mt-8 text-[var(--ink-2)]">
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
  autoComplete,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
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
        autoComplete={autoComplete}
        required
        minLength={type === "password" ? 6 : undefined}
        className="w-full rounded border border-[var(--rule)] bg-[var(--surface)] px-3 py-2.5 focus:border-unal-green-dark"
      />
    </div>
  );
}
