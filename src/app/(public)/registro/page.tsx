import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solicitar acceso",
};

/*
 * La maqueta ofrecía registro público, pero users.createRule del backend
 * es `@request.auth.role = 'admin'`: solo un administrador crea cuentas.
 * Un formulario aquí fallaría con 400 en cada envío, así que la página
 * explica el camino real en vez de simularlo.
 *
 * Decisión de producto pendiente: o se abre el registro en el backend,
 * o esta pantalla se queda como está. Ver CLAUDE.md.
 */
export default function RegistroPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-3xl font-black tracking-tight">Solicitar acceso</h1>

      <p className="mt-4 text-lg leading-relaxed text-(--ink-2)">
        Las cuentas de AKOPIA las crea un administrador del centro de acopio.
        No hay registro abierto: cada operador queda asociado a una persona
        responsable, porque todo movimiento de inventario se atribuye a quien
        lo hizo.
      </p>

      <div className="mt-8 rounded border-l-4 border-unal-aqua bg-(--surface-2) p-5">
        <h2 className="font-bold">Cómo obtener una cuenta</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-(--ink-2)">
          <li>
            Escribe al responsable del centro de acopio indicando tu nombre
            completo, tu correo institucional y la labor que vas a desempeñar.
          </li>
          <li>
            El administrador crea la cuenta y te asigna un rol: operador,
            consulta o administrador.
          </li>
          <li>
            Recibirás una contraseña temporal para el primer ingreso.
          </li>
        </ol>
      </div>

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
