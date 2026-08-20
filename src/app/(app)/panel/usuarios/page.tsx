"use client";

import { useCallback, useState } from "react";
import { UserPlus } from "lucide-react";
import { currentUser, errorMessage, pb, type UserRole } from "@/lib/pb";
import { ALL_ROLES, ROLE_LABELS, assignableRoles, hasAnyRole } from "@/lib/roles";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine, Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";

interface ManagedUser {
  id: string;
  full_name: string;
  email: string;
  role: UserRole[];
  active: boolean;
  firebase_uid?: string;
}

/*
 * Gestión real: lee y escribe la colección `users` de verdad, no una
 * lista de muestra. `users.updateRule` y el hook
 * `09_users_role_guard.pb.js` ya exigen la jerarquía de roles en el
 * backend — esta pantalla no reemplaza esa comprobación, solo le da
 * una cara: los controles de rol se limitan a `assignableRoles()`
 * (espejo de la misma tabla de niveles) para no ofrecer un botón que
 * el servidor de todas formas va a rechazar.
 *
 * Coordinación administra cuentas igual que Administrador, con dos
 * límites: no puede tocar ninguna cuenta que ya sea Administrador
 * (decisión de Juan Manuel, 20 ago 2026 — la ve, no la edita), y no
 * puede asignar el rol Administrador ni Coordinación a nadie.
 *
 * Las cuentas con `active: false` son casi siempre registros recién
 * llegados por Firebase (ver /registro y /api/auth/firebase) esperando
 * que alguien las revise; van primero y destacadas.
 */
export default function UsuariosPage() {
  const admin = currentUser();
  const actorRoles = admin?.role ?? [];
  const assignable = assignableRoles(actorRoles);

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

  async function toggleRole(user: ManagedUser, role: UserRole, checked: boolean) {
    const nextRoles = checked
      ? [...user.role, role]
      : user.role.filter((r) => r !== role);

    if (nextRoles.length === 0) {
      setError("Una cuenta necesita al menos un rol.");
      return;
    }

    setBusyId(user.id);
    setError(null);
    try {
      await pb.collection("users").update(user.id, { role: nextRoles });
      setVersion((v) => v + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (admin && !hasAnyRole(admin.role, ["admin", "coordinacion"])) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es solo para administración y coordinación.
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
            Quién puede operar AKOPIA, y con qué rol o roles.
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)} icon={UserPlus}>
          Vincular correo
        </Button>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      {showCreate ? (
        <LinkEmailForm
          assignable={assignable}
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
          {active.map((user) => {
            const isSelf = user.id === admin?.id;
            const isUntouchableAdmin =
              user.role.includes("admin") && !actorRoles.includes("admin");
            const canEdit = !isSelf && !isUntouchableAdmin;

            return (
              <li key={user.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{user.full_name}</p>
                  <p className="text-sm text-(--muted)">
                    {user.email}
                    {user.firebase_uid ? " · Firebase" : ""}
                  </p>
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {ALL_ROLES.map((role) => {
                    const checked = user.role.includes(role);
                    // Se ofrece si ya está marcado (para poder
                    // quitarlo) o si el actor tiene permiso para
                    // asignarlo — nunca un rol de poder igual o mayor
                    // al suyo.
                    const offered = checked || assignable.includes(role);
                    if (!offered) return null;

                    return (
                      <label
                        key={role}
                        className="flex items-center gap-1.5 text-xs font-medium"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={busyId === user.id || !canEdit || !assignable.includes(role) && !checked}
                          onChange={(event) => toggleRole(user, role, event.target.checked)}
                        />
                        {ROLE_LABELS[role]}
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={busyId === user.id || !canEdit}
                  onClick={() => setActive(user, false)}
                  className="flex items-center gap-2 rounded border border-(--rule) px-3 py-1.5 text-sm font-bold text-unal-red disabled:opacity-50"
                >
                  {busyId === user.id ? <Spinner /> : null}
                  Desactivar
                </button>
              </li>
            );
          })}
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
  assignable,
  onCreated,
  onError,
}: {
  assignable: UserRole[];
  onCreated: () => void;
  onError: (message: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [saving, setSaving] = useState(false);

  function toggleRole(role: UserRole, checked: boolean) {
    setRoles((current) =>
      checked ? [...current, role] : current.filter((r) => r !== role)
    );
  }

  async function create() {
    if (!fullName.trim() || !email.trim()) {
      onError("Escribe el nombre y el correo de la persona.");
      return;
    }
    if (roles.length === 0) {
      onError("Elige al menos un rol.");
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
        role: roles,
        active: true,
      });
      setFullName("");
      setEmail("");
      setRoles([]);
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
        <div className="sm:col-span-2">
          <span className="mb-1 block text-sm font-bold">Rol o roles</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {assignable.map((role) => (
              <label key={role} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={roles.includes(role)}
                  onChange={(event) => toggleRole(role, event.target.checked)}
                />
                {ROLE_LABELS[role]}
              </label>
            ))}
          </div>
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
