"use client";

import { useCallback, useState } from "react";
import { currentUser, errorMessage, pb, type UserRole } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine, Spinner } from "@/components/ui/spinner";

interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  active: boolean;
  firebase_uid?: string;
}

/*
 * Gestión real: lee y escribe la colección `users` de verdad, no una
 * lista de muestra. `users.updateRule` ya exige rol admin en el backend
 * — esta pantalla no reemplaza esa comprobación, solo le da una cara.
 *
 * Las cuentas con `active: false` son casi siempre registros recién
 * llegados por Firebase (ver /registro y /api/auth/firebase) esperando
 * que alguien las revise; van primero y destacadas.
 */
export default function UsuariosPage() {
  const admin = currentUser();
  const [version, setVersion] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchUsers = useCallback(async () => {
    const page = await pb.collection("users").getList<ManagedUser>(1, 200, {
      sort: "-created",
    });
    return { items: page.items, version };
  }, [version]);

  const { data, error: loadError } = useAsyncData(fetchUsers);
  const users = data?.items ?? null;

  async function setActive(user: ManagedUser, active: boolean) {
    setBusyId(user.id);
    setError(null);
    try {
      await pb.collection("users").update(user.id, { active });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function setRole(user: ManagedUser, role: UserRole) {
    setBusyId(user.id);
    setError(null);
    try {
      await pb.collection("users").update(user.id, { role });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (admin && admin.role !== "admin") {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es solo para administradores.
      </p>
    );
  }

  if (loadError) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {loadError}
      </p>
    );
  }

  if (!users) {
    return <LoadingLine />;
  }

  const pending = users.filter((user) => !user.active);
  const active = users.filter((user) => user.active);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Usuarios</h1>
          <p className="mt-1 text-(--muted)">
            Quién puede operar AKOPIA, y con qué rol.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="rounded bg-unal-green-dark px-4 py-2.5 font-bold text-white hover:bg-unal-green"
        >
          Vincular correo
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      {showCreate ? (
        <LinkEmailForm
          onCreated={() => {
            setShowCreate(false);
            setVersion((v) => v + 1);
          }}
          onError={setError}
        />
      ) : null}

      {pending.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold text-unal-orange">
            Pendientes de activar ({pending.length})
          </h2>
          <ul className="space-y-2">
            {pending.map((user) => (
              <li
                key={user.id}
                className="flex flex-wrap items-center gap-3 rounded border border-unal-yellow bg-(--surface) p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{user.full_name}</p>
                  <p className="text-sm text-(--muted)">
                    {user.email}
                    {user.firebase_uid ? " · registrada por Firebase" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busyId === user.id}
                  onClick={() => setActive(user, true)}
                  className="flex items-center gap-2 rounded bg-unal-green-dark px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {busyId === user.id ? <Spinner /> : null}
                  Activar
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold">Cuentas activas ({active.length})</h2>
        <ul className="divide-y divide-(--rule) overflow-hidden rounded border border-(--rule) bg-(--surface)">
          {active.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{user.full_name}</p>
                <p className="text-sm text-(--muted)">
                  {user.email}
                  {user.firebase_uid ? " · Firebase" : ""}
                </p>
              </div>

              <select
                value={user.role}
                disabled={busyId === user.id || user.id === admin?.id}
                onChange={(event) => setRole(user, event.target.value as UserRole)}
                className="rounded border border-(--rule) bg-(--surface) px-2 py-1.5 text-sm"
              >
                <option value="operator">Operador</option>
                <option value="admin">Administrador</option>
              </select>

              <button
                type="button"
                disabled={busyId === user.id || user.id === admin?.id}
                onClick={() => setActive(user, false)}
                className="flex items-center gap-2 rounded border border-(--rule) px-3 py-1.5 text-sm font-bold text-unal-red disabled:opacity-50"
              >
                {busyId === user.id ? <Spinner /> : null}
                Desactivar
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/*
 * "Vincular correo" reserva el nombre y el rol de alguien que todavía no
 * ha entrado nunca — sin pedirle una contraseña, porque esa cuenta nunca
 * va a usar una: la contraseña real la pone la persona misma al entrar
 * por primera vez con Google o el enlace de Firebase a ese correo.
 *
 * El registro se crea aquí con una contraseña aleatoria que nadie
 * conoce ni necesita (existe solo porque el esquema de PocketBase la
 * exige en una colección de auth) — el mismo truco que ya usa
 * `/api/auth/firebase/route.ts` para las cuentas que se crean solas. El
 * puente de Firebase enlaza por correo la primera vez que esa persona
 * entra: encuentra este registro, le asigna su `firebase_uid` y
 * conserva el nombre, el rol y `active` tal como quedaron aquí — nunca
 * los pisa. `active: true` de una vez: elegir el rol ya es la
 * aprobación, no hace falta un segundo paso.
 */
function LinkEmailForm({
  onCreated,
  onError,
}: {
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("operator");
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!fullName.trim() || !email.trim()) {
      onError("Escribe el nombre y el correo de la persona.");
      return;
    }

    setSaving(true);
    onError("");

    try {
      const password = crypto.randomUUID();
      await pb.collection("users").create({
        full_name: fullName,
        email,
        password,
        passwordConfirm: password,
        role,
        active: true,
      });
      setFullName("");
      setEmail("");
      onCreated();
    } catch (err) {
      const data = (err as { response?: { data?: Record<string, { code?: string }> } })
        ?.response?.data;
      if (data?.email?.code === "validation_not_unique") {
        onError(
          "Ya existe una cuenta con ese correo — probablemente ya se registró. Actívala o cámbiale el rol en la lista de abajo."
        );
      } else {
        onError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
      <h2 className="mb-1 text-sm font-bold">Vincular correo</h2>
      <p className="mb-3 text-xs text-(--muted)">
        La persona entra con este correo (Google o Firebase) y pone su propia
        contraseña ahí — aquí solo se reserva su nombre y su rol para cuando
        llegue.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="cu-nombre" className="mb-1 block text-sm font-bold">
            Nombre
          </label>
          <input
            id="cu-nombre"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
        </div>
        <div>
          <label htmlFor="cu-correo" className="mb-1 block text-sm font-bold">
            Correo
          </label>
          <input
            id="cu-correo"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          />
        </div>
        <div>
          <label htmlFor="cu-rol" className="mb-1 block text-sm font-bold">
            Rol
          </label>
          <select
            id="cu-rol"
            value={role}
            onChange={(event) => setRole(event.target.value as UserRole)}
            className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
          >
            <option value="operator">Operador</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={create}
        className="mt-4 flex items-center gap-2 rounded bg-unal-green-dark px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        {saving ? <Spinner /> : null}
        {saving ? "Vinculando…" : "Vincular correo"}
      </button>
    </div>
  );
}
