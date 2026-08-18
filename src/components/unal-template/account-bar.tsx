"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pb, type AkopiaUser } from "@/lib/pb";

/*
 * Franja de cuenta — "Iniciar sesión"/"Registrarse" sin sesión, o
 * "Hola, {nombre} · Salir" con sesión activa — flotando a la
 * izquierda dentro de la misma fila que "Panel de Accesibilidad"
 * (montado desde <AccessibilityPanel>, antes de #pestania-
 * accesibilidad, que ya trae `float:right`). Presente en los tres
 * momentos (portada, login/registro, app), pedido explícito del
 * 2026-08-18; movida de su propia franja a esta fila el mismo día,
 * a pedido de Juan Manuel.
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
    <div
      className="akopia-content float-left flex items-center gap-3 pl-4 font-sans text-sm text-(--ink)"
      style={{ height: 35 }}
    >
      {!checked ? null : user ? (
        <>
          <span className="text-(--ink-2)">
            Hola, <strong className="text-(--ink)">{user.full_name}</strong>
          </span>
          <button
            type="button"
            onClick={signOut}
            className="rounded border border-(--rule) px-3 py-1 font-bold hover:bg-(--surface-2)"
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
