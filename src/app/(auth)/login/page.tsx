"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { firebaseErrorMessage, loginWithFirebase, signInWithGoogle } from "@/lib/firebase";
import { errorMessage, establishFirebaseSession, pb } from "@/lib/pb";
import { GoogleButton } from "@/components/public/google-button";
import { Spinner } from "@/components/ui/spinner";

/*
 * Un solo formulario para las dos formas de entrar que puede tener una
 * cuenta: registrada por Firebase, o creada directamente por un admin
 * antes de que existiera esa opción (como admin@akopia.org, que solo
 * tiene contraseña nativa de PocketBase).
 *
 * Se intenta primero con Firebase; si falla por lo que sea, se reintenta
 * con la contraseña nativa antes de rendirse. No se distingue el motivo
 * del primer fallo porque Firebase ya no lo deja saber — desde hace
 * tiempo devuelve el mismo "auth/invalid-credential" tanto si el correo
 * no existe como si la contraseña está mal, para no revelar cuentas.
 */
export default function LoginPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);

  function afterSession(active: boolean) {
    router.push(active ? "/panel" : "/panel/pendiente");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      let active: boolean;

      try {
        const idToken = await loginWithFirebase(identity, password);
        const user = await establishFirebaseSession(idToken);
        active = user.active;
      } catch {
        const auth = await pb.collection("users").authWithPassword(identity, password);
        active = auth.record.active;
      }

      afterSession(active);
    } catch (err) {
      pb.authStore.clear();
      setError(
        errorMessage(err) === "Ocurrió un error inesperado. Intenta de nuevo."
          ? "Correo o contraseña incorrectos."
          : errorMessage(err)
      );
    } finally {
      setPending(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setGooglePending(true);

    try {
      const idToken = await signInWithGoogle();
      const user = await establishFirebaseSession(idToken);
      afterSession(user.active);
    } catch (err) {
      pb.authStore.clear();
      setError(firebaseErrorMessage(err));
    } finally {
      setGooglePending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-black tracking-tight">Iniciar sesión</h1>
      <p className="mt-2 text-(--ink-2)">
        Acceso para operadores del centro de acopio.
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
          id="identity"
          label="Correo"
          type="email"
          value={identity}
          onChange={setIdentity}
          autoComplete="username"
        />
        <Field
          id="password"
          label="Contraseña"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error ? (
          <p
            role="alert"
            className="rounded border-l-4 border-unal-red bg-(--surface-2) px-4 py-3 text-sm"
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
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-8 text-(--ink-2)">
        ¿No tienes una cuenta?{" "}
        <Link href="/registro" className="font-bold text-unal-green-dark underline">
          Regístrate
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
        className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5 focus:border-unal-green-dark"
      />
    </div>
  );
}
