"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pb, type AkopiaUser } from "@/lib/pb";

/*
 * Franja de cuenta, en el área de contenido (no en el cabezote fijo de
 * la plantilla): "Iniciar sesión"/"Registrarse" sin sesión, o
 * "Hola, {nombre} · Salir" con sesión activa. Presente en los tres
 * momentos (portada, login/registro, app), pedido explícito del
 * 2026-08-18.
 */
export function AccountBar() {
  const router = useRouter();
  const [user, setUser] = useState<AkopiaUser | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    function sync() {
      setUser(
        pb.authStore.isValid && pb.authStore.record
          ? (pb.authStore.record as unknown as AkopiaUser)
          : null
      );
      setChecked(true);
    }
    sync();
    return pb.authStore.onChange(sync);
  }, []);

  function signOut() {
    pb.authStore.clear();
    router.push("/login");
  }

  return (
    // "akopia-content": AccountBar es interfaz propia (Tailwind), no de
    // la plantilla — sin esta clase, vive dentro de `.unal-chrome` pero
    // fuera de la exclusión que arma scripts/scope-unal-template-css.mjs,
    // así que reglas genéricas de la plantilla como `a{...}` (sin capa,
    // le gana a cualquier clase de Tailwind) le borraban el fondo verde
    // y el texto blanco al botón "Registrarse".
    <div className="akopia-content flex min-h-[42px] items-center justify-end gap-3 border-b border-(--rule) bg-(--surface-2) px-5 py-2 font-sans text-sm text-(--ink)">
      {!checked ? null : user ? (
        <>
          <span className="text-(--ink-2)">
            Hola, <strong className="text-(--ink)">{user.full_name}</strong>
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded border border-(--rule) px-3 py-1 font-bold hover:bg-(--surface)"
          >
            Salir
          </button>
        </>
      ) : (
        <>
          <Link
            href="/login"
            className="rounded px-3 py-1 font-bold text-unal-green-dark hover:bg-unal-green-soft"
          >
            Iniciar sesión
          </Link>
          <Link
            href="/registro"
            className="rounded bg-unal-green-dark px-3 py-1 font-bold text-white hover:bg-unal-green"
          >
            Registrarse
          </Link>
        </>
      )}
    </div>
  );
}
