"use client";

import { useRouter } from "next/navigation";
import { currentUser, pb } from "@/lib/pb";

/*
 * A donde llega una cuenta recién registrada por Firebase mientras nadie
 * la ha activado. El token es válido —Firebase ya confirmó quién es—
 * pero PocketBase le niega todo hasta que un admin la active desde
 * /panel/usuarios: es la misma regla `active = true` que ya exige cada
 * colección, no una comprobación nueva inventada aquí.
 */
export default function PendientePage() {
  const router = useRouter();
  const user = currentUser();

  function signOut() {
    pb.authStore.clear();
    router.replace("/login");
  }

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <h1 className="text-2xl font-black tracking-tight">
        Tu cuenta está pendiente de activación
      </h1>
      <p className="mt-3 text-(--ink-2)">
        {user?.full_name ? `Hola, ${user.full_name}. ` : ""}
        Ya creaste tu cuenta, pero un administrador todavía tiene que
        activarla antes de que puedas entrar a operar.
      </p>
      <p className="mt-2 text-sm text-(--muted)">
        Avísale al administrador del centro de acopio para que la revise en
        Usuarios.
      </p>
      <button
        type="button"
        onClick={signOut}
        className="mt-6 rounded border border-(--rule) px-4 py-2.5 font-bold"
      >
        Salir
      </button>
    </div>
  );
}
