"use client";

import { useCallback, useState } from "react";
import { callRoute, currentUser, errorMessage, pb, RouteError } from "@/lib/pb";
import { useAsyncData } from "@/lib/use-async-data";
import { LoadingLine, Spinner } from "@/components/ui/spinner";
import { DatabaseBackup, Download, Lock, X } from "lucide-react";

interface Backup {
  key: string;
  size: number;
  modified: string | null;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit += 1;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(1)} ${units[unit]}`;
}

async function downloadBackup(key: string, password: string) {
  const response = await fetch(
    pb.buildURL(`/api/akopia-backups/${encodeURIComponent(key)}/download`),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: pb.authStore.token,
      },
      body: JSON.stringify({ password }),
    }
  );

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new RouteError(response.status, payload);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = key;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type PasswordAction = { kind: "create" } | { kind: "download"; key: string };

/*
 * Respaldo manual de la base completa, para cualquier admin de la app —
 * la API nativa de PocketBase (/_/ → Settings → Backups) exige un
 * superusuario real de `_superusers`, que nuestros admins no son. Las
 * rutas propias (pb_hooks/07_backups.pb.js) reexigen la contraseña
 * nativa de PocketBase en cada acción: la sesión de la app por sí sola
 * no basta para crear o descargar una copia completa de todo.
 *
 * Restaurar NO está aquí a propósito: sobreescribe la base entera y
 * reinicia el servidor, cortando a cualquiera conectado en ese momento.
 * Sigue siendo, deliberadamente, solo desde /_/ con un superusuario real.
 */
export default function RespaldosPage() {
  const admin = currentUser();
  const [version, setVersion] = useState(0);
  const [action, setAction] = useState<PasswordAction | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBackups = useCallback(async () => {
    const response = await callRoute<{ backups: Backup[] }>("/api/akopia-backups");
    return { backups: response.backups, version };
  }, [version]);

  const { data, error } = useAsyncData(fetchBackups);

  function openCreate() {
    setPassword("");
    setFormError(null);
    setAction({ kind: "create" });
  }

  function openDownload(key: string) {
    setPassword("");
    setFormError(null);
    setAction({ kind: "download", key });
  }

  async function confirm() {
    if (!action) return;
    if (!password) {
      setFormError("Ingresa la contraseña para confirmar.");
      return;
    }

    setBusy(true);
    setFormError(null);
    try {
      if (action.kind === "create") {
        await callRoute("/api/akopia-backups", { method: "POST", body: { password } });
        setVersion((v) => v + 1);
      } else {
        await downloadBackup(action.key, password);
      }
      setAction(null);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (admin && admin.role !== "admin") {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        Esta sección es solo para administradores.
      </p>
    );
  }

  if (error) {
    return (
      <p role="alert" className="rounded border-l-4 border-unal-red bg-(--surface) px-4 py-3">
        {error}
      </p>
    );
  }

  if (!data) {
    return <LoadingLine />;
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Respaldos</h1>
          <p className="mt-1 text-(--muted)">
            Copia completa de la base de datos, lista para restaurar. Manual:
            todavía no hay respaldos programados.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="flex shrink-0 items-center gap-1.5 rounded bg-unal-green-dark px-4 py-2.5 font-bold text-white hover:opacity-90"
        >
          <DatabaseBackup size={16} strokeWidth={2.5} aria-hidden="true" />
          Crear respaldo
        </button>
      </div>

      <p className="mt-4 rounded border-l-4 border-unal-yellow bg-(--surface) px-4 py-3 text-sm text-(--ink-2)">
        Restaurar un respaldo reemplaza toda la base y reinicia el servidor —
        no se hace desde aquí. Si hace falta, un superusuario real lo restaura
        desde <span className="font-mono">/_/ → Settings → Backups</span>, con
        el archivo que descargues en esta pantalla.
      </p>

      {data.backups.length === 0 ? (
        <div className="mt-6 rounded border border-(--rule) bg-(--surface) p-6">
          <p className="font-bold">Todavía no hay ningún respaldo.</p>
          <p className="mt-1 text-sm text-(--muted)">Crea el primero con el botón de arriba.</p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-(--rule) rounded border border-(--rule) bg-(--surface)">
          {data.backups.map((backup) => (
            <li key={backup.key} className="flex flex-wrap items-center gap-3 p-4">
              <div className="flex-1">
                <p className="font-mono text-sm font-bold">{backup.key}</p>
                <p className="text-xs text-(--muted)">
                  {formatSize(backup.size)}
                  {backup.modified
                    ? " · " +
                      new Date(backup.modified).toLocaleString("es-CO", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => openDownload(backup.key)}
                className="flex items-center gap-1.5 rounded border border-(--rule) px-3 py-2 text-sm font-bold hover:bg-(--surface-2)"
              >
                <Download size={14} strokeWidth={2.5} aria-hidden="true" />
                Descargar
              </button>
            </li>
          ))}
        </ul>
      )}

      {action ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-sm rounded border border-(--rule) bg-(--surface) p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-1.5 font-bold">
                  <Lock size={16} aria-hidden="true" />
                  {action.kind === "create" ? "Crear respaldo" : "Descargar respaldo"}
                </h2>
                <p className="mt-1 text-sm text-(--muted)">
                  {action.kind === "create"
                    ? "Confirma con tu contraseña de PocketBase."
                    : `Confirma con tu contraseña para descargar ${action.key}.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAction(null)}
                aria-label="Cerrar"
                className="text-(--muted) hover:text-(--ink)"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <label className="mt-4 block text-sm font-bold" htmlFor="backup-password">
              Contraseña
            </label>
            <input
              id="backup-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirm();
              }}
              autoComplete="current-password"
              autoFocus
              className="mt-1 w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
            />

            {formError ? (
              <p role="alert" className="mt-2 text-sm text-unal-red">
                {formError}
              </p>
            ) : null}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setAction(null)}
                className="flex-1 rounded border border-(--rule) px-4 py-2.5 font-bold hover:bg-(--surface-2)"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirm}
                className="flex-1 rounded bg-unal-green-dark px-4 py-2.5 font-bold text-white disabled:opacity-50"
              >
                {busy ? <Spinner /> : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
