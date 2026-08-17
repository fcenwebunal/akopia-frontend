"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { errorMessage, pb } from "@/lib/pb";

export default function LoginPage() {
  const router = useRouter();
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const auth = await pb
        .collection("users")
        .authWithPassword(identity, password);

      // El servidor ya bloquea a los usuarios inactivos en cada regla de
      // acceso; esto solo evita entrar a un panel que se vería vacío.
      if (!auth.record.active) {
        pb.authStore.clear();
        setError("Tu cuenta está desactivada. Contacta al administrador.");
        return;
      }

      router.push("/panel");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl font-black tracking-tight">Iniciar sesión</h1>
      <p className="mt-2 text-(--ink-2)">
        Acceso para operadores del centro de acopio.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <Field
          id="identity"
          label="Correo institucional"
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
          disabled={pending}
          className="w-full rounded bg-unal-green-dark px-6 py-3 font-bold text-white hover:bg-unal-green disabled:opacity-60"
        >
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
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
