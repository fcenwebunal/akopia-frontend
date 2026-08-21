"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { errorMessage } from "@/lib/pb";
import {
  checkDeletable,
  deleteRecordWithReason,
  editRecordWithReason,
} from "@/lib/record-actions";
import { Button } from "@/components/ui/button";

/*
 * Editar y eliminar con motivo obligatorio, solo admin/coordinación
 * (11_edit_delete_with_reason.pb.js en el backend). Dos componentes
 * genéricos en vez de un formulario por colección: el backend ya es
 * config-driven (EDITABLE_RECORDS en utils/config.js), así que la
 * interfaz solo necesita describir qué campos mostrar — la lista
 * blanca real de qué se puede tocar la sigue imponiendo el backend.
 */

export interface EditableField {
  name: string;
  label: string;
  type?: "text" | "textarea" | "number" | "tel" | "email" | "date" | "select" | "checkbox";
  options?: { value: string; label: string }[];
}

export function EditRecordButton({
  collection,
  id,
  fields,
  values,
  onSaved,
  label = "Editar",
  size = "sm",
}: {
  collection: string;
  id: string;
  fields: EditableField[];
  values: Record<string, string | number | boolean | null | undefined>;
  onSaved: () => void;
  label?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function defaultFor(field: EditableField) {
    if (field.type === "number") return 0;
    if (field.type === "checkbox") return false;
    return "";
  }

  function openDialog() {
    const initial: Record<string, string | number | boolean> = {};
    for (const field of fields) {
      initial[field.name] = values[field.name] ?? defaultFor(field);
    }
    setForm(initial);
    setReason("");
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (reason.trim().length < 5) {
      setError("Escribe un motivo (mínimo 5 caracteres).");
      return;
    }

    const changes: Record<string, unknown> = {};
    for (const field of fields) {
      const before = values[field.name] ?? defaultFor(field);
      const after = form[field.name];
      if (String(before) !== String(after)) {
        changes[field.name] = field.type === "number" ? Number(after) : after;
      }
    }

    if (Object.keys(changes).length === 0) {
      setError("No cambiaste ningún dato.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await editRecordWithReason(collection, id, reason, changes);
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="outline" size={size} icon={Pencil} onClick={openDialog}>
        {label}
      </Button>

      {open ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="max-h-[90vh] w-full overflow-y-auto rounded-t-lg bg-(--surface) p-5 sm:max-w-md sm:rounded-lg">
            <h2 className="text-lg font-bold">Editar</h2>

            <div className="mt-3 space-y-3">
              {fields.map((field) => (
                <div key={field.name}>
                  {field.type === "checkbox" ? (
                    <label className="flex items-center gap-2 text-sm font-bold">
                      <input
                        id={`edit-${field.name}`}
                        type="checkbox"
                        checked={Boolean(form[field.name])}
                        onChange={(event) =>
                          setForm((f) => ({ ...f, [field.name]: event.target.checked }))
                        }
                      />
                      {field.label}
                    </label>
                  ) : (
                    <>
                      <label
                        htmlFor={`edit-${field.name}`}
                        className="mb-1 block text-sm font-bold"
                      >
                        {field.label}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          id={`edit-${field.name}`}
                          value={String(form[field.name] ?? "")}
                          onChange={(event) =>
                            setForm((f) => ({ ...f, [field.name]: event.target.value }))
                          }
                          rows={2}
                          className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                        />
                      ) : field.type === "select" ? (
                        <select
                          id={`edit-${field.name}`}
                          value={String(form[field.name] ?? "")}
                          onChange={(event) =>
                            setForm((f) => ({ ...f, [field.name]: event.target.value }))
                          }
                          className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                        >
                          {(field.options ?? []).map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id={`edit-${field.name}`}
                          type={field.type ?? "text"}
                          value={String(form[field.name] ?? "")}
                          onChange={(event) =>
                            setForm((f) => ({
                              ...f,
                              [field.name]:
                                field.type === "number"
                                  ? Number(event.target.value)
                                  : event.target.value,
                            }))
                          }
                          className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4">
              <label htmlFor="edit-reason" className="mb-1 block text-sm font-bold">
                Motivo del cambio <span className="text-unal-red">*</span>
              </label>
              <textarea
                id="edit-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="Ej.: se cometió un error al ingresar el producto"
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              />
              <p className="mt-1 text-xs text-(--muted)">
                Queda guardado en el historial, con tu nombre y la fecha.
              </p>
            </div>

            {error ? <p className="mt-3 text-sm text-unal-red">{error}</p> : null}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded border border-(--rule) px-4 py-3 font-bold"
              >
                Cancelar
              </button>
              <Button
                onClick={save}
                disabled={saving}
                loading={saving}
                className="flex-1 justify-center"
              >
                Guardar cambios
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function DeleteRecordButton({
  collection,
  id,
  onDeleted,
  label = "Eliminar",
  size = "sm",
  itemDescription,
}: {
  collection: string;
  id: string;
  onDeleted: () => void;
  label?: string;
  size?: "sm" | "md";
  /** Texto corto de qué se va a eliminar, para el título del diálogo. */
  itemDescription?: string;
}) {
  const [checking, setChecking] = useState(false);
  const [dialog, setDialog] = useState<{
    mode: "delete" | "deactivate";
  } | null>(null);
  const [blockedReason, setBlockedReason] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startDelete() {
    setChecking(true);
    setError(null);
    setBlockedReason(null);
    try {
      const result = await checkDeletable(collection, id);
      if (result.blocked) {
        setBlockedReason(result.reason ?? "No se puede eliminar este registro.");
      } else {
        setReason("");
        setDialog({ mode: result.mode });
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setChecking(false);
    }
  }

  async function confirmDelete() {
    if (reason.trim().length < 5) {
      setError("Escribe un motivo (mínimo 5 caracteres).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await deleteRecordWithReason(collection, id, reason);
      setDialog(null);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const actionWord = dialog?.mode === "deactivate" ? "Desactivar" : "Eliminar";

  return (
    <>
      <Button
        variant="danger"
        size={size}
        icon={Trash2}
        onClick={startDelete}
        disabled={checking}
        loading={checking}
      >
        {label}
      </Button>

      {blockedReason ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-lg bg-(--surface) p-5 sm:max-w-sm sm:rounded-lg">
            <h2 className="text-lg font-bold text-unal-red">No se puede eliminar</h2>
            <p className="mt-2 text-sm">{blockedReason}</p>
            <button
              type="button"
              onClick={() => setBlockedReason(null)}
              className="mt-5 w-full rounded bg-unal-green-dark px-4 py-3 font-bold text-white"
            >
              Entendido
            </button>
          </div>
        </div>
      ) : null}

      {dialog ? (
        <div className="fixed inset-0 z-20 flex items-end bg-black/40 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-lg bg-(--surface) p-5 sm:max-w-sm sm:rounded-lg">
            <h2 className="text-lg font-bold">
              {actionWord}
              {itemDescription ? ` — ${itemDescription}` : ""}
            </h2>
            {dialog.mode === "deactivate" ? (
              <p className="mt-1 text-sm text-(--muted)">
                No se borra: deja de ofrecerse para registros nuevos, pero lo
                que ya existe con esto no se toca.
              </p>
            ) : (
              <p className="mt-1 text-sm text-(--muted)">
                Esta acción borra el registro por completo. Queda un rastro en
                el historial, con el motivo.
              </p>
            )}

            <div className="mt-4">
              <label htmlFor="delete-reason" className="mb-1 block text-sm font-bold">
                Motivo <span className="text-unal-red">*</span>
              </label>
              <textarea
                id="delete-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={2}
                placeholder="Ej.: producto de prueba"
                className="w-full rounded border border-(--rule) bg-(--surface) px-3 py-2.5"
              />
            </div>

            {error ? <p className="mt-3 text-sm text-unal-red">{error}</p> : null}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="rounded border border-(--rule) px-4 py-3 font-bold"
              >
                Cancelar
              </button>
              <Button
                variant="danger-solid"
                onClick={confirmDelete}
                disabled={saving}
                loading={saving}
                className="flex-1 justify-center"
              >
                {actionWord}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
