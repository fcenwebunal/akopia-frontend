"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Info, UserPlus, X } from "lucide-react";
import { currentUser, errorMessage, pb, type UserRole } from "@/lib/pb";
import { ALL_ROLES, ROLE_LABELS, ROLE_LEVELS, assignableRoles, hasAnyRole } from "@/lib/roles";
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
  const [showGuide, setShowGuide] = useState(false);
  const [query, setQuery] = useState("");

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

  const q = query.trim().toLowerCase();
  const matchesQuery = (user: ManagedUser) =>
    !q ||
    user.full_name.toLowerCase().includes(q) ||
    user.email.toLowerCase().includes(q);

  const pending = users.filter((user) => !user.active && matchesQuery(user));
  const active = users.filter((user) => user.active && matchesQuery(user));
  const totalShown = pending.length + active.length;
  const hasQuery = q.length > 0;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Usuarios</h1>
          <p className="mt-1 text-(--muted)">
            Quién puede operar AKOPIA, y con qué rol o roles.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => setShowGuide((v) => !v)}
            icon={Info}
            variant="outline"
          >
            {showGuide ? "Ocultar guía de roles" : "¿Qué puede hacer cada rol?"}
          </Button>
          <Button onClick={() => setShowCreate((v) => !v)} icon={UserPlus}>
            Vincular correo
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-4 rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
          {error}
        </p>
      ) : null}

      {showGuide ? <RoleGuide /> : null}

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

      <div className="mt-6">
        <label className="sr-only" htmlFor="buscar-usuario">
          Buscar usuario
        </label>
        <input
          id="buscar-usuario"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          autoComplete="off"
          className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5 sm:max-w-sm"
        />
        {hasQuery ? (
          <div className="mt-2 flex items-center justify-between text-sm text-(--muted)">
            <span>
              {totalShown} de {users.length} usuarios
            </span>
            <button
              type="button"
              onClick={() => setQuery("")}
              className="font-bold text-unal-green-dark hover:underline"
            >
              Quitar búsqueda
            </button>
          </div>
        ) : null}
      </div>

      {hasQuery && totalShown === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">Nadie coincide con &quot;{query.trim()}&quot;.</p>
          <p className="mt-1 text-sm text-(--muted)">
            Busca por nombre completo o por correo.
          </p>
        </div>
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

/*
 * Contenido verificado contra el código real, no contra la propuesta
 * original (PROPUESTA-ROLES-PERMISOS.md tenía puntos "por confirmar"
 * que se resolvieron después sin volver a ese documento):
 *
 *   - migración 045_role_based_access_rules.js — quién ve/crea/edita
 *     cada colección.
 *   - pb_hooks/05_routes.pb.js — el rol exacto que exige cada ruta
 *     propia (approve/reject/cancel, confirm-delivery, relocate, reject
 *     de cuarentena).
 *   - pb_hooks/07_backups.pb.js — respaldos exige `requireAdmin`, ni
 *     siquiera Coordinación entra.
 *
 * Si el backend cambia una regla, esta guía queda desactualizada en
 * silencio — no hay forma de derivarla en vivo desde el cliente, las
 * reglas de acceso no se pueden leer por la API. Toca acordarse de
 * tocar los dos lados.
 */
const ROLE_GUIDE: Record<UserRole, { can: string[]; cannot: string[] }> = {
  admin: {
    can: [
      "Ve y gestiona todo: donaciones, inventario, solicitudes, despachos, catálogo, usuarios, respaldos e historial.",
      "Único que puede asignar el rol Administrador o Coordinación a alguien.",
      "Edita o elimina cualquier registro del catálogo maestro completo, no solo la foto.",
      "Único rol con acceso a Respaldos (crear y descargar la base).",
    ],
    cannot: [],
  },
  coordinacion: {
    can: [
      "Ve el ciclo completo: donaciones, inventario, solicitudes, despachos e historial.",
      "Clasifica cualquier donación y decide en Inventario — reubicar, liberar o rechazar cuarentena de cualquier remesa, no solo la propia.",
      "Crea, aprueba, rechaza y cancela solicitudes.",
      "Da de alta catálogo nuevo (producto, categoría, grupo, ubicación) y cambia fotos de lo existente.",
      "Gestiona usuarios: activa cuentas y asigna roles de nivel 1 (Transporte y distribución, Voluntariado, Comunicaciones, Salida).",
    ],
    cannot: [
      "No registra una donación nueva — eso es de Voluntariado o Administrador.",
      "No asigna el rol Administrador ni Coordinación, y no puede editar ni desactivar una cuenta Administrador (solo verla).",
      "Sin acceso a Respaldos ni a editar/eliminar por completo el catálogo maestro.",
    ],
  },
  transporte_distribucion: {
    can: [
      "Arma despachos y confirma entregas.",
      "Ve solicitudes y saldos de inventario, para saber qué llevar.",
      "Da de alta catálogo nuevo y cambia fotos de lo existente.",
    ],
    cannot: [
      "No crea ni decide solicitudes.",
      "No ve ni clasifica donaciones.",
      "Sin acceso a usuarios, respaldos ni historial.",
    ],
  },
  voluntariado: {
    can: [
      "Registra donaciones nuevas (recepción) y clasifica las que recibió — disponible o cuarentena.",
      "Da de alta catálogo nuevo y cambia fotos de lo existente.",
      "Ve los saldos de inventario.",
    ],
    cannot: [
      "No reubica ni rechaza cuarentena de forma definitiva — eso es de Coordinación/Administrador.",
      "Sin acceso a solicitudes, despachos ni usuarios.",
    ],
  },
  comunicaciones: {
    can: [
      "Consulta donaciones, inventario, solicitudes, despachos e historial — para reportar y difundir.",
    ],
    cannot: [
      "No crea ni edita nada: ni catálogo, ni inventario, ni solicitudes, ni despachos.",
    ],
  },
  salida: {
    can: [
      "Crea, aprueba, rechaza y cancela solicitudes — la misma decisión que Coordinación, pero solo sobre solicitudes.",
      "Arma despachos y confirma entregas.",
      "Da de alta catálogo nuevo y cambia fotos de lo existente.",
      "Ve solicitudes, despachos e inventario.",
    ],
    cannot: [
      "No ve ni clasifica donaciones.",
      "No reubica ni rechaza cuarentena en Inventario.",
      "Sin acceso a usuarios, respaldos ni historial.",
    ],
  },
};

function RoleGuide() {
  const rolesByLevel = useMemo(
    () => ALL_ROLES.slice().sort((a, b) => ROLE_LEVELS[b] - ROLE_LEVELS[a]),
    []
  );

  return (
    <div className="mt-4 rounded border border-(--rule) bg-(--surface) p-4">
      <h2 className="mb-1 text-sm font-bold">Qué puede hacer cada rol</h2>
      <p className="mb-4 text-xs text-(--muted)">
        Una cuenta puede tener varios roles a la vez — sus permisos se suman.
        Nadie puede asignar un rol de poder igual o mayor al suyo (Administrador
        es la única excepción).
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rolesByLevel.map((role) => {
          const guide = ROLE_GUIDE[role];
          return (
            <div key={role} className="rounded border border-(--rule) p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-bold">{ROLE_LABELS[role]}</span>
                <span className="shrink-0 rounded-full bg-(--surface-2) px-2 py-0.5 text-[11px] font-bold text-(--muted)">
                  Nivel {ROLE_LEVELS[role]}
                </span>
              </div>
              <ul className="space-y-1.5 text-xs">
                {guide.can.map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <Check
                      size={14}
                      strokeWidth={3}
                      className="mt-0.5 shrink-0 text-unal-green-dark"
                      aria-hidden="true"
                    />
                    <span className="text-(--ink-2)">{line}</span>
                  </li>
                ))}
                {guide.cannot.map((line) => (
                  <li key={line} className="flex gap-1.5">
                    <X
                      size={14}
                      strokeWidth={3}
                      className="mt-0.5 shrink-0 text-unal-red"
                      aria-hidden="true"
                    />
                    <span className="text-(--muted)">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
