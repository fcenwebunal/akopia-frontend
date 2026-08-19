"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { pb, type AkopiaUser } from "@/lib/pb";

/*
 * Franja de cuenta — "Iniciar sesión"/"Registrarse" sin sesión, o
 * "Hola, {nombre} · Cerrar sesión" con sesión activa — junto a "Panel de
 * Accesibilidad" (montada desde <AccessibilityPanel>, después de
 * #pestania-accesibilidad en el DOM). Ambos en `float:right`: la
 * pestaña llega primero al borde, esto se acomoda pegado a su
 * izquierda — no en el extremo opuesto de la fila, que es como quedó
 * en el primer intento. Presente en los tres momentos (portada,
 * login/registro, app), pedido explícito del 2026-08-18.
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
    // A la portada, no a /login: cerrar sesión saca al usuario de la
    // app, no lo manda de vuelta a un formulario que ya no necesita —
    // pedido explícito del 19 de agosto.
    router.push("/");
  }

  return (
    // "akopia-content": AccountBar es interfaz propia (Tailwind), no de
    // la plantilla — sin esta clase, vive dentro de `.unal-chrome` pero
    // fuera de la exclusión que arma scripts/scope-unal-template-css.mjs,
    // así que reglas genéricas de la plantilla como `a{...}` (sin capa,
    // le gana a cualquier clase de Tailwind) le borraban el fondo verde
    // y el texto blanco al botón "Registrarse".
    //
    // md:mr-10: en escritorio, #pestania-accesibilidad (el botón azul
    // "Panel de Accesibilidad") dibuja su ícono con un ::before movido
    // 35px hacia su propia izquierda — como esto queda flotado justo a
    // la izquierda de esa pestaña (ver el comentario más abajo), sin
    // este margen el ícono se dibujaba encima de "Salir".
    <div
      className="akopia-content float-right flex items-center gap-3 pr-4 md:mr-10 font-sans text-sm text-(--ink)"
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
            Cerrar sesión
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
