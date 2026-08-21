"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  firebaseErrorMessage,
  isAccountExistsWithDifferentCredential,
  linkGoogleAfterPasswordCollision,
  loginWithFirebase,
  signInWithGoogle,
} from "@/lib/firebase";
import { establishFirebaseSession, pb } from "@/lib/pb";
import { checkEmailStatus, type EmailStatus } from "@/lib/auth-status";
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
 * no existe como si la contraseña está mal, para no revelar cuentas — por
 * eso el mensaje final no sale de ese error, sino de consultar
 * /api/auth/email-status (que sí puede distinguir, mirando PocketBase en
 * vez de a Firebase — ver el comentario de ese endpoint).
 *
 * AKOPIA es un sistema aislado: su pantalla de entrada se parece a la del
 * SSO real de la UNAL (@unal.edu.co), pero no comparte esa base de datos.
 * Los mensajes de aquí están para que eso quede claro en el momento en
 * que alguien se confunde, no antes.
 */
function loginFailureMessage(status: EmailStatus): string {
  if (!status.exists) {
    return "No encontramos una cuenta de AKOPIA con ese correo — este sistema es independiente del usuario y contraseña de la UNAL. Regístrate y pide a un administrador que active los permisos para tu cuenta.";
  }
  if (!status.linked) {
    return "Ya tienes una cuenta preparada en AKOPIA, pero todavía sin contraseña propia. Ve a Registro con este mismo correo para crearla.";
  }
  return "No pudimos entrar con esa contraseña. Si sueles entrar con Google, usa \"Continuar con Google\" arriba — o ve a Registro para crear una contraseña nueva. Si ya tienes una, revisa que esté bien escrita.";
}

export default function LoginPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [googlePending, setGooglePending] = useState(false);
  const [googleLinkError, setGoogleLinkError] = useState<unknown>(null);

  function afterSession(active: boolean) {
    router.push(active ? "/panel" : "/panel/pendiente");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setGoogleLinkError(null);
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
    } catch {
      pb.authStore.clear();
      const status = await checkEmailStatus(identity);
      setError(loginFailureMessage(status));
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
      setGoogleLinkError(null);
      afterSession(user.active);
    } catch (err) {
      pb.authStore.clear();
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
      afterSession(user.active);
    } catch (err) {
      pb.authStore.clear();
      setError(
        firebaseErrorMessage(err) === "Ocurrió un error inesperado. Intenta de nuevo."
          ? "La contraseña no es correcta."
          : firebaseErrorMessage(err)
      );
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
      <p className="mt-1 text-xs text-(--muted)">
        AKOPIA es un sistema propio, independiente del usuario y contraseña de
        la UNAL — el correo puede ser el mismo, la cuenta no.
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
